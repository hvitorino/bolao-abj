'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  acquirePointsCache,
  releasePointsCache,
  subscribeToPointsInvalidations,
} from '@/lib/cache/points-cache'
import type { RankingEntry } from '@/lib/types/ranking'

/**
 * Hook que busca o ranking de um grupo específico e se inscreve no event-bus
 * do PointsCache para receber invalidações da tabela `scores`.
 *
 * Quando qualquer mudança ocorre em `scores` daquele grupo (INSERT ou UPDATE —
 * quando um jogo é encerrado e o trigger calcula pontuações), o PointsCache
 * notifica este hook via `subscribeToPointsInvalidations`, e o ranking é
 * rebuscado automaticamente via GET /api/ranking?group_id= com debounce de 1s.
 *
 * O hook não abre canal Realtime próprio — usa o canal `points-${groupId}`
 * gerenciado pelo PointsCache (centralizar-cache-v2, Stage 2).
 *
 * @param groupId grupo ativo — trocar de grupo desmonta o efeito anterior
 * e adquire/registra no PointsCache do novo grupo.
 * @returns { ranking, loading, error, lastUpdatedAt }
 */
export function useRankingRealtime(groupId: string): {
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
  lastUpdatedAt: Date | null
} {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const fetchRanking = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Sessão expirada. Faça login novamente.')
        setLoading(false)
        return
      }

      const res = await fetch(`/api/ranking?group_id=${groupId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Erro ao carregar ranking (${res.status}).`)
        setLoading(false)
        return
      }

      const data: RankingEntry[] = await res.json()
      setRanking(data)
      setLastUpdatedAt(new Date())
      setError(null)
    } catch {
      setError('Erro de rede ao carregar ranking.')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    // Busca inicial do ranking
    const initialFetchTimer = window.setTimeout(() => {
      void fetchRanking()
    }, 0)

    // Usa o PointsCache em vez de abrir canal Realtime próprio para `scores`.
    // O PointsCache já mantém 1 canal `points-${groupId}` assinando a tabela
    // `scores` filtrada por group_id. Qualquer mudança nesse canal dispara os
    // listeners registrados via subscribeToPointsInvalidations — incluindo este.
    // Debounce de 1s para evitar avalanche de requests quando o trigger Postgres
    // calcula pontuações de múltiplos usuários ao final de um jogo.
    acquirePointsCache(groupId)
    let debounceTimer: number | undefined

    const unsub = subscribeToPointsInvalidations(
      groupId,
      'useRankingRealtime',
      () => {
        window.clearTimeout(debounceTimer)
        debounceTimer = window.setTimeout(() => {
          void fetchRanking()
        }, 1000)
      }
    )

    return () => {
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceTimer)
      unsub()
      releasePointsCache(groupId)
    }
  }, [fetchRanking, groupId])

  return { ranking, loading, error, lastUpdatedAt }
}
