'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRankingRealtime } from './useRankingRealtime'
import type { RankingEntry } from '@/lib/types/ranking'

/**
 * Hook que gerencia o ranking por rodada.
 *
 * - No modo "GERAL" (padrão), delega ao useRankingRealtime existente,
 *   mantendo o Realtime ativo e o comportamento idêntico ao atual.
 * - No modo por rodada (qualquer round !== "GERAL"), faz um fetch estático
 *   em GET /api/ranking?group_id=&round= e não subscreve ao Realtime.
 *   Isso é intencional: fases encerradas não mudam, e o caso de uso
 *   primário é análise histórica.
 *
 * Também busca as fases disponíveis via GET /api/ranking/rounds?group_id=
 * para popular os chips de filtro.
 */

export interface UseRoundRankingResult {
  selectedRound: string
  setSelectedRound: (round: string) => void
  availableRounds: string[]
  roundsLoading: boolean
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
  lastUpdatedAt: Date | null
}

// Hook intermediário que busca ranking por rodada específica (não GERAL)
function useRankingByRound(groupId: string, round: string): {
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
} {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRankingByRound = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRanking([])

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Sessão expirada. Faça login novamente.')
        setLoading(false)
        return
      }

      const encodedRound = encodeURIComponent(round)
      const res = await fetch(`/api/ranking?group_id=${groupId}&round=${encodedRound}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Erro ao carregar ranking da fase (${res.status}).`)
        setLoading(false)
        return
      }

      const data: RankingEntry[] = await res.json()
      setRanking(data)
      setError(null)
    } catch {
      setError('Erro de rede ao carregar ranking da fase.')
    } finally {
      setLoading(false)
    }
  }, [groupId, round])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRankingByRound()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchRankingByRound])

  return { ranking, loading, error }
}

// Hook principal exportado
export function useRoundRanking(groupId: string): UseRoundRankingResult {
  const [selectedRound, setSelectedRound] = useState<string>('GERAL')
  const [availableRounds, setAvailableRounds] = useState<string[]>([])
  const [roundsLoading, setRoundsLoading] = useState(true)

  // Modo GERAL: usa Realtime
  const geralResult = useRankingRealtime(groupId)

  // Modo por rodada: fetch estático (só ativo quando round !== GERAL)
  const roundResult = useRankingByRound(
    groupId,
    selectedRound !== 'GERAL' ? selectedRound : '__noop__'
  )

  // Busca fases disponíveis no mount
  useEffect(() => {
    let cancelled = false

    async function fetchRounds() {
      setRoundsLoading(true)

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          if (!cancelled) setRoundsLoading(false)
          return
        }

        const res = await fetch(`/api/ranking/rounds?group_id=${groupId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!res.ok) {
          if (!cancelled) setRoundsLoading(false)
          return
        }

        const data: { rounds: string[] } = await res.json()
        if (!cancelled) {
          setAvailableRounds(data.rounds ?? [])
          setRoundsLoading(false)
        }
      } catch {
        if (!cancelled) setRoundsLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void fetchRounds()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [groupId])

  if (selectedRound === 'GERAL') {
    return {
      selectedRound,
      setSelectedRound,
      availableRounds,
      roundsLoading,
      ranking: geralResult.ranking,
      loading: geralResult.loading,
      error: geralResult.error,
      lastUpdatedAt: geralResult.lastUpdatedAt,
    }
  }

  return {
    selectedRound,
    setSelectedRound,
    availableRounds,
    roundsLoading,
    ranking: roundResult.ranking,
    loading: roundResult.loading,
    error: roundResult.error,
    lastUpdatedAt: null,
  }
}
