'use client'

import { useEffect, useState } from 'react'
import {
  ensurePredictions,
  getCachedPredictions,
  getMyPredictions,
  subscribeToPredictionInvalidations,
  subscribeToPredictionUpdates,
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
      // Cache hit: usar imediatamente (deferido para evitar setState síncrono no effect)
      window.setTimeout(() => {
        setPredictionsByGame(cached)
        setMyPredictions(getMyPredictions(groupId, currentUserId))
        setLoading(false)
      }, 0)
    } else {
      void load()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groupId, currentUserId])

  // Subscrever a atualizações do cache — granular (Realtime) + fallback (polling)
  useEffect(() => {
    acquirePredictionCache(groupId)

    // Listener granular: atualiza estado diretamente sem refetch
    const unsubDetail = subscribeToPredictionUpdates(groupId, "usePredictionsRealtime", (pred: CachedPrediction, eventType: string) => {
      const ts = new Date().toLocaleTimeString('pt-BR')
      console.log(`%c[usePredictionsRealtime] %c↻ ATUALIZANDO %c| ${eventType} ${pred.home_score}×${pred.away_score} %c| ${ts}`,
        'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')

      setPredictionsByGame((prev) => {
        const next = new Map(prev)
        const gameMap = next.get(pred.game_id)
        if (eventType === 'DELETE') {
          gameMap?.delete(pred.user_id)
          if (gameMap && gameMap.size === 0) next.delete(pred.game_id)
        } else {
          if (!gameMap) next.set(pred.game_id, new Map([[pred.user_id, pred]]))
          else gameMap.set(pred.user_id, pred)
        }
        return next
      })

      if (pred.user_id === currentUserId) {
        setMyPredictions((prev) => {
          const next = new Map(prev)
          if (eventType === 'DELETE') next.delete(pred.game_id)
          else next.set(pred.game_id, pred)
          return next
        })
      }
    })

    // Fallback: refetch completo no polling (60s)
    const unsubFallback = subscribeToPredictionInvalidations(groupId, "usePredictionsRealtime", () => {
      const ts = new Date().toLocaleTimeString('pt-BR')
      console.log(`%c[usePredictionsRealtime] %c↻ REFETCH %c| fallback %c| ${ts}`,
        'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')
      ensurePredictions(groupId, selectedDate).then(() => {
        setPredictionsByGame(getCachedPredictions(groupId))
        setMyPredictions(getMyPredictions(groupId, currentUserId))
      })
    })

    return () => {
      unsubDetail()
      unsubFallback()
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
