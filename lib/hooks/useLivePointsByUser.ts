'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'

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
 * Busca todos os jogos com status 'live' e os palpites de todos os usuários para esses jogos,
 * calcula a pontuação parcial client-side via `calculateLiveScore`, e soma por usuário.
 *
 * Usado pelo ranking (`/ranking`) para somar à pontuação oficial (tabela `scores`,
 * jogos `finished`) a pontuação provisória de jogos em andamento — sem nenhuma escrita
 * em `scores` e sem novo endpoint Ruby/Next.
 *
 * Subscreve ao canal `live-points-games` (tabela `games`, evento UPDATE, sem filtro de
 * coluna) para recalcular quando o status ou o placar de qualquer jogo mudar — com
 * debounce de 1000ms, mesmo padrão usado em `useRankingRealtime`.
 *
 * Em caso de erro de rede/consulta, falha de forma graciosa: loga no console e mantém
 * `livePoints` no último valor calculado com sucesso (ou `{}` se nunca calculou),
 * permitindo que o ranking degrade para exibir apenas a pontuação oficial.
 *
 * @returns { livePoints, loading }
 */
export function useLivePointsByUser(): { livePoints: LivePointsByUser; loading: boolean } {
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
  }, [])

  useEffect(() => {
    // Busca inicial
    const initialFetchTimer = window.setTimeout(() => {
      void fetchLivePoints()
    }, 0)

    // Subscription Realtime: qualquer UPDATE em games pode mudar quem está `live`
    // ou o placar de quem já está — sem filtro de coluna/id.
    const supabase = createClient()
    let debounceTimer: number | undefined

    const channel = supabase
      .channel('live-points-games')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        () => {
          window.clearTimeout(debounceTimer)
          debounceTimer = window.setTimeout(() => {
            void fetchLivePoints()
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [fetchLivePoints])

  return { livePoints, loading }
}
