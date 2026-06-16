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
 * Busca todos os jogos com status 'live' e os palpites dos membros de um
 * grupo específico para esses jogos, calcula a pontuação parcial client-side
 * via `calculateLiveScore`, e soma por usuário.
 *
 * Usado pelo ranking (`/ranking`) para somar à pontuação oficial (tabela `scores`,
 * jogos `finished`) a pontuação provisória de jogos em andamento — sem nenhuma escrita
 * em `scores` e sem novo endpoint Ruby/Next.
 *
 * Subscreve ao canal `live-points-games-${groupId}` (tabela `games`, evento UPDATE,
 * sem filtro de coluna — games é global, sem group_id) para recalcular quando o
 * status ou o placar de qualquer jogo mudar — com debounce de 1000ms, mesmo padrão
 * usado em `useRankingRealtime`. O recálculo interno após cada evento filtra as
 * predictions pelo `groupId` recebido como argumento do hook.
 *
 * Em caso de erro de rede/consulta, falha de forma graciosa: loga no console e mantém
 * `livePoints` no último valor calculado com sucesso (ou `{}` se nunca calculou),
 * permitindo que o ranking degrade para exibir apenas a pontuação oficial.
 *
 * @param groupId grupo ativo — trocar de grupo desmonta a subscription antiga
 * e cria uma nova (incluído no array de dependências do useEffect).
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

    // Subscription Realtime: qualquer UPDATE em games pode mudar quem está `live`
    // ou o placar de quem já está — sem filtro de coluna/id (games é global,
    // sem group_id). Canal escopado por groupId apenas para nomear a subscription
    // de forma única por instância do hook.
    const supabase = createClient()
    let debounceTimer: number | undefined

    const channel = supabase
      .channel(`live-points-games-${groupId}`)
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
  }, [fetchLivePoints, groupId])

  return { livePoints, loading }
}
