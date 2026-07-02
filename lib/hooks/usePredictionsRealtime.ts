'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ensurePredictions,
  getCachedPredictions,
  getMyPredictions,
  subscribeToPredictionInvalidations,
  acquirePredictionCache,
  releasePredictionCache,
  clearPredictionCache,
} from '@/lib/cache/prediction-cache'
import type { CachedPrediction } from '@/lib/cache/prediction-cache'

export interface Prediction {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

/**
 * Hook que fornece acesso reativo aos palpites de uma data e grupo.
 * Usa PredictionCache centralizado com Realtime + Polling 60s de fallback.
 *
 * - Palpites de outros usuários chegam instantaneamente via Realtime
 * - Cache entre datas — navegar entre datas mantém dados em memória
 * - Polling 60s só ativo enquanto há jogos pending (fallback)
 *
 * @param groupId - grupo ativo
 * @param selectedDate - data no formato YYYY-MM-DD
 * @param currentUserId - ID do usuário logado (para myPredictions)
 */
export function usePredictionsRealtime(
  groupId: string,
  selectedDate: string,
  currentUserId: string
): {
  predictionsByGame: Map<string, Map<string, Prediction>>
  myPredictions: Map<string, Prediction>
  loading: boolean
  hasData: boolean
  error: string | null
} {
  const [predictionsByGame, setPredictionsByGame] = useState<
    Map<string, Map<string, Prediction>>
  >(() => getCachedPredictions(groupId))

  const [myPredictions, setMyPredictions] = useState<Map<string, Prediction>>(
    () => getMyPredictions(groupId, currentUserId)
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Limpar cache ao trocar de grupo
  useEffect(() => {
    clearPredictionCache(groupId)
  }, [groupId])

  // Carregar dados da data
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        await ensurePredictions(groupId, selectedDate)
        if (cancelled) return
        const all = getCachedPredictions(groupId)
        const mine = getMyPredictions(groupId, currentUserId)
        setPredictionsByGame(all)
        setMyPredictions(mine)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar palpites')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Verificar se já há cache para esta data
    const cached = getCachedPredictions(groupId)
    if (cached.size > 0) {
      setPredictionsByGame(cached)
      setMyPredictions(getMyPredictions(groupId, currentUserId))
      setLoading(false)
    } else {
      void load()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groupId, currentUserId])

  // Subscrever a invalidações do cache (Realtime + polling)
  useEffect(() => {
    acquirePredictionCache(groupId)

    const unsub = subscribeToPredictionInvalidations(groupId, () => {
      // Recarregar após invalidação
      ensurePredictions(groupId, selectedDate).then(() => {
        setPredictionsByGame(getCachedPredictions(groupId))
        setMyPredictions(getMyPredictions(groupId, currentUserId))
      })
    })

    return () => {
      unsub()
      releasePredictionCache(groupId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selectedDate, currentUserId])

  return {
    predictionsByGame,
    myPredictions,
    loading,
    hasData: predictionsByGame.size > 0,
    error,
  }
}
