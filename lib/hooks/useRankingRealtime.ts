'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RankingEntry } from '@/lib/types/ranking'

/**
 * Hook que busca o ranking de um grupo específico e subscreve ao canal
 * Realtime do Supabase para a tabela `scores`, filtrado por `group_id`.
 *
 * Quando qualquer mudança ocorre em `scores` daquele grupo (INSERT ou UPDATE —
 * quando um jogo é encerrado e o trigger calcula pontuações), o ranking é
 * rebuscado automaticamente via GET /api/ranking?group_id=.
 *
 * Configuração necessária no Supabase (migration 20260614_enable_realtime_publications.sql):
 *   ALTER TABLE scores REPLICA IDENTITY FULL;
 *   ALTER PUBLICATION supabase_realtime ADD TABLE scores;
 *
 * @param groupId grupo ativo — trocar de grupo desmonta a subscription antiga
 * e cria uma nova (incluído no array de dependências do useEffect).
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

    // Subscription Supabase Realtime: qualquer mudança em scores DESTE grupo
    // refaz o fetch. Canal escopado por groupId para não colidir com outras
    // instâncias do hook (ex: troca rápida de grupo) e para reduzir ruído de
    // eventos de outros grupos.
    const supabase = createClient()
    let debounceTimer: number | undefined

    const channel = supabase
      .channel(`ranking-scores-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'scores',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          // Ao detectar qualquer mudança em scores deste grupo, rebusca o
          // ranking completo. Usamos debounce para evitar avalanche de
          // requests quando muitos usuários pontuam ao mesmo tempo.
          window.clearTimeout(debounceTimer)
          debounceTimer = window.setTimeout(() => {
            void fetchRanking()
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [fetchRanking, groupId])

  return { ranking, loading, error, lastUpdatedAt }
}
