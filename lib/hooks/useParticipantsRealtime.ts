'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ParticipantEntry } from '@/lib/types/participant'

interface PredictionPayload {
  user_id: string
  game_id: string
  home_score: number | null
  away_score: number | null
}

/**
 * Hook que gerencia os palpites dos participantes em tempo real para um jogo.
 *
 * Resolve o bug em que, quando um jogo muda de `pending` para `live` via Realtime,
 * os palpites dos demais participantes continuam exibidos como OCULTO/PENDENTE até
 * que o usuário recarregue a página.
 *
 * Comportamento:
 * 1. Mount com jogo já `live` ou `finished`: dispara fetch imediato de palpites.
 * 2. Jogo muda para `live` via Realtime: dispara fetch de palpites e funde com o estado atual.
 * 3. Merge preserva name, points, breakdown e hasPrediction — apenas atualiza `prediction`.
 * 4. `hasFetchedForLive` garante idempotência (sem fetches duplicados).
 *
 * @param gameId              — UUID do jogo
 * @param groupId             — UUID do grupo ativo
 * @param initialParticipants — array SSR inicial de ParticipantEntry (prop do GameCard)
 * @param initialGameStatus   — status do jogo no momento do SSR
 * @returns ParticipantEntry[] atualizado com palpites revelados quando o jogo é live/finished
 */
export function useParticipantsRealtime(
  gameId: string,
  groupId: string,
  initialParticipants: ParticipantEntry[],
  initialGameStatus: 'pending' | 'live' | 'finished'
): ParticipantEntry[] {
  const [participants, setParticipants] = useState<ParticipantEntry[]>(initialParticipants)
  // Ref para evitar closure stale — usamos ref em vez de state para não re-renderizar
  const hasFetchedForLive = useRef(false)

  /**
   * Funde os palpites recebidos do endpoint com o array de participantes atual.
   * Preserva todos os campos (name, points, breakdown, hasPrediction) —
   * apenas atualiza `prediction` quando home_score/away_score não forem null.
   */
  function mergeWithPredictions(
    current: ParticipantEntry[],
    fetched: PredictionPayload[]
  ): ParticipantEntry[] {
    const byUserId = new Map(fetched.map((p) => [p.user_id, p]))
    return current.map((entry) => {
      const payload = byUserId.get(entry.userId)
      if (!payload) return entry
      // Se home_score ou away_score for null, a RLS ainda bloqueou (jogo pending) —
      // manter o estado atual sem alterar prediction.
      if (payload.home_score === null || payload.away_score === null) return entry
      return {
        ...entry,
        prediction: {
          home_score: payload.home_score,
          away_score: payload.away_score,
        },
        hasPrediction: true,
      }
    })
  }

  async function fetchAndMerge() {
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const url = `/api/participants-predictions?game_id=${gameId}&group_id=${groupId}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) return

      const fetched: PredictionPayload[] = await response.json()
      setParticipants((prev) => mergeWithPredictions(prev, fetched))
    } catch {
      // Silencia erros de rede — os dados SSR são mantidos como fallback
    }
  }

  // Efeito 1: se o jogo já era live/finished no mount, buscar palpites imediatamente.
  // Cobre: usuário abre a página com jogo ao vivo, ou retorna à aba após o jogo ter iniciado.
  useEffect(() => {
    if (initialGameStatus !== 'pending' && !hasFetchedForLive.current) {
      hasFetchedForLive.current = true
      fetchAndMerge()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Efeito 2: subscrição Realtime para detectar transição pending → live.
  // Canal separado de `game-${gameId}` (usado por useGameRealtime) para evitar
  // conflito de estado — este hook gerencia apenas participants, não o estado do jogo.
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`game-participants-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status
          if (newStatus === 'live' && !hasFetchedForLive.current) {
            hasFetchedForLive.current = true
            fetchAndMerge()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, groupId])

  return participants
}
