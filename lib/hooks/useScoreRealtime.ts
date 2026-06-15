'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Score } from '@/lib/types/score'

/**
 * Hook que subscreve ao canal Realtime do Supabase para a pontuação
 * de um usuário em um jogo específico.
 *
 * Atualiza automaticamente quando o trigger Postgres `on_game_finished` insere
 * ou atualiza um registro na tabela `scores` após o jogo ser encerrado.
 *
 * Configuração manual necessária no Supabase:
 *   ALTER TABLE scores REPLICA IDENTITY FULL;
 *   ALTER PUBLICATION supabase_realtime ADD TABLE scores;
 *
 * @param gameId      - UUID do jogo a observar
 * @param userId      - UUID do usuário (filtra scores do próprio usuário)
 * @param initialScore - estado inicial do score (vindo do Server Component, pode ser null)
 * @returns Score atualizado em tempo real, ou null se ainda não calculado
 */
export function useScoreRealtime(
  gameId: string,
  userId: string,
  initialScore: Score | null
): Score | null {
  const [scoreState, setScoreState] = useState<Score | null>(initialScore)

  // Fetch inicial: garante que o score calculado aparece imediatamente no mount,
  // sem depender de um evento Realtime futuro (scores só mudam quando o jogo
  // encerra, portanto nenhum evento chegaria para jogos já finalizados).
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setScoreState(data as Score)
        }
      })
  }, [gameId, userId])

  useEffect(() => {
    // Early return: não cria subscription sem userId válido.
    // Sem userId, o filtro user_id === userId nunca corresponderia e a subscription
    // seria inútil — além de criar um canal com nome inválido `score-${gameId}-`.
    if (!userId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`score-${gameId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT e UPDATE
          schema: 'public',
          table: 'scores',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newScore = payload.new as Partial<Score>
          // Filtra apenas o score do próprio usuário (segurança dupla além do RLS).
          // Usamos atualização funcional para fundir as mudanças.
          if (newScore.user_id === userId) {
            setScoreState((prev) => (prev ? { ...prev, ...newScore } : (newScore as Score)))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, userId])

  return scoreState
}
