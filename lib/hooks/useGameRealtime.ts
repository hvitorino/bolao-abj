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
          // Guarda defensiva: só atualiza se os campos essenciais estão presentes.
          // Sem REPLICA IDENTITY FULL no banco, payload.new pode chegar como {}
          // e sobrescrever o estado com um objeto vazio, apagando o placar exibido.
          if (newGame.id && newGame.status !== undefined) {
            setGame(newGame as Game)
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
