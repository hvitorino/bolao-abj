'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ParticipantEntry } from '@/lib/types/participant'

interface PredictionPayload {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

/**
 * Hook que gerencia os palpites dos participantes em tempo real para um jogo.
 *
 * Observa `gameStatus` (derivado de `liveGame.status` via useGameRealtime) e dispara
 * fetch quando o status sai de 'pending'. Isso garante que o fallback de polling de
 * useGameRealtime também cubra a revelação de palpites — sem assinatura Realtime
 * duplicada e sem gap quando o evento Realtime é perdido.
 *
 * @param gameId      — UUID do jogo
 * @param groupId     — UUID do grupo ativo
 * @param initialParticipants — array SSR inicial de ParticipantEntry
 * @param gameStatus  — status reativo do jogo (liveGame.status de useGameRealtime)
 * @returns ParticipantEntry[] atualizado com palpites revelados quando o jogo é live/finished
 */
export function useParticipantsRealtime(
  gameId: string,
  groupId: string,
  initialParticipants: ParticipantEntry[],
  gameStatus: 'pending' | 'live' | 'finished'
): ParticipantEntry[] {
  const [participants, setParticipants] = useState<ParticipantEntry[]>(initialParticipants)
  const hasFetchedForLive = useRef(false)

  function mergeWithPredictions(
    current: ParticipantEntry[],
    fetched: PredictionPayload[]
  ): ParticipantEntry[] {
    const byUserId = new Map(fetched.map((p) => [p.user_id, p]))
    return current.map((entry) => {
      const payload = byUserId.get(entry.userId)
      if (!payload) return entry
      return {
        ...entry,
        prediction: {
          id: entry.prediction?.id ?? '',
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
      // Silencia erros de rede — dados SSR mantidos como fallback
    }
  }

  // Dispara fetch sempre que gameStatus sai de 'pending' (transição para live ou finished).
  // Cobre tanto eventos Realtime quanto o fallback de polling de useGameRealtime (30s).
  // hasFetchedForLive garante idempotência — fetch ocorre apenas uma vez por mount.
  useEffect(() => {
    if (gameStatus !== 'pending' && !hasFetchedForLive.current) {
      hasFetchedForLive.current = true
      fetchAndMerge()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, gameId, groupId])

  return participants
}
