'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Game } from '@/lib/types/game'

export interface GameRealtimeState {
  game: Game
  lastUpdatedAt: Date | null
  connectionStatus: 'connecting' | 'connected' | 'error'
}

/**
 * Hook que subscreve ao canal Realtime do Supabase para um jogo específico.
 * Retorna o estado atualizado do jogo em tempo real via WAL replication,
 * junto com timestamp da última atualização e status da conexão.
 *
 * @param gameId - UUID do jogo a observar
 * @param initialGame - estado inicial do jogo (vindo do Server Component)
 * @returns GameRealtimeState com { game, lastUpdatedAt, connectionStatus }
 */
export function useGameRealtime(gameId: string, initialGame: Game): GameRealtimeState {
  const [game, setGame] = useState<Game>(initialGame)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  // Fetch inicial: garante dados frescos no mount independente do cache SSR.
  // Sem este fetch, o estado só seria atualizado quando chegasse o próximo
  // evento Realtime — que pode nunca chegar se o jogo não estiver em andamento.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setGame(data as Game)
        }
      })
  }, [gameId])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const newGame = payload.new as Partial<Game>
          // Guarda defensiva mínima: o payload deve ter pelo menos o ID.
          // Usamos atualização funcional (setGame(prev => ...)) para fundir as mudanças
          // em vez de sobrescrever tudo, protegendo contra payloads parciais.
          if (newGame.id) {
            setGame((prev) => ({ ...prev, ...newGame } as Game))
            setLastUpdatedAt(new Date())
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { game, lastUpdatedAt, connectionStatus }
}
