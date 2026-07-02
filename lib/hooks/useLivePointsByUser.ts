'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import { subscribeToGameUpdates, acquireGlobalChannel, releaseGlobalChannel } from '@/lib/cache/score-cache'

export interface LivePointsByUser {
  [userId: string]: number // soma de pontos parciais de todos os jogos `live` para aquele usuário
}

interface LiveGameRow {
  id: string
  home_score: number | null
  away_score: number | null
}

interface PredictionRow {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

/**
 * Busca todos os jogos com status 'live' e os palpites dos membros de um
 * grupo específico para esses jogos, calcula a pontuação parcial client-side
 * via `calculateLiveScore`, e soma por usuário.
 *
 * Usa o canal Realtime global do ScoreCache (em vez de canal próprio) para
 * detectar mudanças em games e recalcular.
 *
 * @param groupId grupo ativo
 * @returns { livePoints, loading }
 */
export function useLivePointsByUser(groupId: string): { livePoints: LivePointsByUser; loading: boolean } {
  const [livePoints, setLivePoints] = useState<LivePointsByUser>({})
  const [loading, setLoading] = useState(true)

  const fetchLivePoints = useCallback(async () => {
    try {
      const supabase = createClient()

      const { data: liveGames, error: gamesError } = await supabase
        .from('games')
        .select('id, home_score, away_score')
        .eq('status', 'live')

      if (gamesError) {
        console.error('[useLivePointsByUser] erro ao buscar jogos live:', gamesError)
        setLoading(false)
        return
      }

      const games = (liveGames ?? []) as LiveGameRow[]

      if (games.length === 0) {
        setLivePoints({})
        setLoading(false)
        return
      }

      const gameIds = games.map((g) => g.id)

      const { data: predictions, error: predictionsError } = await supabase
        .from('predictions')
        .select('user_id, game_id, home_score, away_score')
        .in('game_id', gameIds)
        .eq('group_id', groupId)

      if (predictionsError) {
        console.error('[useLivePointsByUser] erro ao buscar palpites:', predictionsError)
        setLoading(false)
        return
      }

      const gamesById = Object.fromEntries(games.map((g) => [g.id, g]))
      const totals: LivePointsByUser = {}

      for (const prediction of (predictions ?? []) as PredictionRow[]) {
        const game = gamesById[prediction.game_id]
        if (!game) continue

        const result = calculateLiveScore(game, {
          home_score: prediction.home_score,
          away_score: prediction.away_score,
        })
        if (result === null) continue

        totals[prediction.user_id] = (totals[prediction.user_id] ?? 0) + result.points
      }

      setLivePoints(totals)
    } catch (err) {
      console.error('[useLivePointsByUser] erro inesperado:', err)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    // Busca inicial
    const initialFetchTimer = window.setTimeout(() => {
      void fetchLivePoints()
    }, 0)

    // Usa o canal Realtime global do ScoreCache em vez de criar canal próprio
    acquireGlobalChannel()
    let debounceTimer: number | undefined

    const unsub = subscribeToGameUpdates('useLivePointsByUser', () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        void fetchLivePoints()
      }, 1000)
    })

    return () => {
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceTimer)
      unsub()
      releaseGlobalChannel()
    }
  }, [fetchLivePoints, groupId])

  return { livePoints, loading }
}
