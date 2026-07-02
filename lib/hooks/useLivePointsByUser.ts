'use client'

import { useEffect, useState } from 'react'
import { calculateLiveScore } from '@/lib/scoring'
import {
  acquireGlobalChannel,
  releaseGlobalChannel,
  subscribeToGameUpdates,
  getLiveGames,
} from '@/lib/cache/score-cache'
import {
  acquirePredictionCache,
  releasePredictionCache,
  ensurePredictions,
  getCachedPredictions,
} from '@/lib/cache/prediction-cache'
import {
  acquirePointsCache,
  releasePointsCache,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'

export interface LivePointsByUser {
  [userId: string]: number // soma de pontos parciais de todos os jogos `live` para aquele usuário
}

/**
 * Calcula pontuação parcial de todos os jogos ao vivo para um grupo,
 * lendo exclusivamente dos caches centralizados (ScoreCache + PredictionCache).
 * Não abre queries diretas a Supabase.
 *
 * Reage a:
 * - ScoreCache: placar de jogo atualizado / jogo transitando para live
 * - PointsCache: score oficial calculado (jogo finalizando)
 *
 * @param groupId grupo ativo
 * @returns { livePoints, loading }
 */
export function useLivePointsByUser(groupId: string): { livePoints: LivePointsByUser; loading: boolean } {
  const [livePoints, setLivePoints] = useState<LivePointsByUser>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) {
      setLoading(false)
      return
    }

    let cancelled = false

    // Acquire dos três caches
    acquireGlobalChannel()
    acquirePredictionCache(groupId)
    acquirePointsCache(groupId)

    // Função de cálculo síncrona — sem IO
    function computeLivePoints(): LivePointsByUser {
      const liveGames = getLiveGames()
      if (liveGames.length === 0) return {}

      const allPredictions = getCachedPredictions(groupId)
      const totals: LivePointsByUser = {}

      for (const game of liveGames) {
        const userPreds = allPredictions.get(game.id)
        if (!userPreds) continue
        for (const [userId, pred] of userPreds) {
          const result = calculateLiveScore(game, { home_score: pred.home_score, away_score: pred.away_score })
          if (result === null) continue
          totals[userId] = (totals[userId] ?? 0) + result.points
        }
      }

      return totals
    }

    async function initialize() {
      try {
        const liveGames = getLiveGames()

        if (liveGames.length === 0) {
          if (!cancelled) {
            setLivePoints({})
            setLoading(false)
          }
          return
        }

        // Coletar datas únicas dos jogos live
        const dates = [...new Set(liveGames.map((g) => g.match_date.slice(0, 10)))]

        // Garantir palpites carregados para cada data
        await Promise.all(dates.map((d) => ensurePredictions(groupId, d)))

        if (!cancelled) {
          setLivePoints(computeLivePoints())
          setLoading(false)
        }
      } catch (err) {
        console.error('[useLivePointsByUser] erro na inicialização:', err)
        if (!cancelled) setLoading(false)
      }
    }

    void initialize()

    // Debounce compartilhado para ambos os listeners
    let debounceGameTimer: number | undefined
    let debouncePointsTimer: number | undefined

    const unsubGame = subscribeToGameUpdates('useLivePointsByUser', () => {
      window.clearTimeout(debounceGameTimer)
      debounceGameTimer = window.setTimeout(() => {
        if (!cancelled) setLivePoints(computeLivePoints())
      }, 1000)
    })

    const unsubPoints = subscribeToPointsUpdates(groupId, 'useLivePointsByUser', () => {
      window.clearTimeout(debouncePointsTimer)
      debouncePointsTimer = window.setTimeout(() => {
        if (!cancelled) setLivePoints(computeLivePoints())
      }, 1000)
    })

    return () => {
      cancelled = true
      window.clearTimeout(debounceGameTimer)
      window.clearTimeout(debouncePointsTimer)
      unsubGame()
      unsubPoints()
      releaseGlobalChannel()
      releasePredictionCache(groupId)
      releasePointsCache(groupId)
    }
  }, [groupId])

  return { livePoints, loading }
}
