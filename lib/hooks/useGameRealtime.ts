'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Game } from '@/lib/types/game'

/**
 * Hook que subscreve ao canal Realtime do Supabase para um jogo específico.
 * Retorna o estado atualizado do jogo em tempo real via WAL replication.
 *
 * @param gameId - UUID do jogo a observar
 * @param initialGame - estado inicial do jogo (vindo do Server Component)
 * @returns Game atualizado em tempo real
 */
export function useGameRealtime(gameId: string, initialGame: Game): Game {
  const [gameState, setGameState] = useState<Game>(initialGame)

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
          setGameState(payload.new as Game)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return gameState
}
