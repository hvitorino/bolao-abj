'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RankingEntry } from '@/lib/types/ranking'

/**
 * Hook que busca o ranking completo e subscreve ao canal Realtime do Supabase
 * para a tabela `scores`.
 *
 * Quando qualquer mudança ocorre em `scores` (INSERT ou UPDATE — quando um jogo
 * é encerrado e o trigger calcula pontuações), o ranking é rebuscado automaticamente
 * via GET /api/ranking.
 *
 * Configuração necessária no Supabase (migration 20260614_enable_realtime_publications.sql):
 *   ALTER TABLE scores REPLICA IDENTITY FULL;
 *   ALTER PUBLICATION supabase_realtime ADD TABLE scores;
 *
 * @returns { ranking, loading, error, lastUpdatedAt }
 */
export function useRankingRealtime(): {
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

      const res = await fetch('/api/ranking', {
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
  }, [])

  useEffect(() => {
    // Busca inicial do ranking
    fetchRanking()

    // Subscription Supabase Realtime: qualquer mudança em scores refaz o fetch
    const supabase = createClient()
    const channel = supabase
      .channel('ranking-scores')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'scores',
        },
        () => {
          // Ao detectar qualquer mudança em scores, rebusca o ranking completo
          fetchRanking()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRanking])

  return { ranking, loading, error, lastUpdatedAt }
}
