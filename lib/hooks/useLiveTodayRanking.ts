'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface LiveTodayEntry {
  userId: string
  name: string
  points: number       // soma de pontos oficiais (scores, jogos finished do dia) + parciais (live)
  hasLiveGame: boolean // true se há pelo menos um jogo live hoje com palpite deste usuário
  rankPosition: number
}

export interface LiveTodayGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
}

// ---------------------------------------------------------------------------
// Helpers de data — baseados em match_day (dia do calendário ESPN, armazenado no DB)
// ---------------------------------------------------------------------------

/**
 * Retorna "hoje" no calendário ESPN (UTC-5, CDT — fuso mais conservador
 * dos locais da Copa 2026) como YYYY-MM-DD, para filtrar por match_day.
 */
function getESPNToday(): string {
  const nowUTC = new Date()
  const nowESPN = new Date(nowUTC.getTime() - 5 * 60 * 60 * 1000)
  const yyyy = nowESPN.getUTCFullYear()
  const mm = String(nowESPN.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowESPN.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useLiveTodayRanking(groupId: string): {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]
  loading: boolean
  hasGamesToday: boolean
} {
  const [entries, setEntries] = useState<LiveTodayEntry[]>([])
  const [games, setGames] = useState<LiveTodayGame[]>([])
  const [loading, setLoading] = useState(true)
  const [hasGamesToday, setHasGamesToday] = useState(false)

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const today = getESPNToday()

      // 1. Buscar jogos de hoje (filtrado por match_day do calendário ESPN)
      const { data: gamesRaw, error: gamesError } = await supabase
        .from('games')
        .select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, match_date')
        .eq('match_day', today)

      if (gamesError) {
        console.error('[useLiveTodayRanking] erro ao buscar jogos:', gamesError)
        setLoading(false)
        return
      }

      const games = gamesRaw ?? []

      if (games.length === 0) {
        setHasGamesToday(false)
        setGames([])
        setEntries([])
        setLoading(false)
        return
      }

      setHasGamesToday(true)
      setGames(
        (gamesRaw ?? []).map((g) => ({
          id: g.id as string,
          home_team: g.home_team as string,
          away_team: g.away_team as string,
          home_team_code: g.home_team_code as string,
          away_team_code: g.away_team_code as string,
          home_score: g.home_score as number | null,
          away_score: g.away_score as number | null,
          status: g.status as 'pending' | 'live' | 'finished',
          match_date: g.match_date as string,
        }))
      )

      // 2. Separar jogos por status
      const finishedIds = games
        .filter((g) => g.status === 'finished')
        .map((g) => g.id)

      const liveGames = games
        .filter((g) => g.status === 'live')
        .map((g) => ({
          id: g.id,
          home_score: g.home_score as number | null,
          away_score: g.away_score as number | null,
        }))

      // 3. Buscar membros do grupo
      const { data: membersRaw, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, profiles(name)')
        .eq('group_id', groupId)

      if (membersError) {
        console.error('[useLiveTodayRanking] erro ao buscar membros:', membersError)
        setLoading(false)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members = (membersRaw ?? []).map((m: any) => ({
        userId: m.user_id as string,
        name: (m.profiles?.name ?? m.user_id) as string,
      }))

      if (members.length === 0) {
        setEntries([])
        setLoading(false)
        return
      }

      // 4. Buscar pontos oficiais (jogos finished de hoje)
      const officialPoints: Record<string, number> = {}

      if (finishedIds.length > 0) {
        const { data: scoresRaw, error: scoresError } = await supabase
          .from('scores')
          .select('user_id, points')
          .in('game_id', finishedIds)
          .eq('group_id', groupId)

        if (scoresError) {
          console.error('[useLiveTodayRanking] erro ao buscar scores:', scoresError)
        } else {
          for (const s of (scoresRaw ?? [])) {
            const uid = s.user_id as string
            officialPoints[uid] = (officialPoints[uid] ?? 0) + (s.points as number)
          }
        }
      }

      // 5. Calcular pontos parciais (jogos live de hoje)
      const livePoints: Record<string, number> = {}
      // Rastrear quais users têm palpite para jogo live
      const usersWithLiveGame = new Set<string>()

      if (liveGames.length > 0) {
        const liveGameIds = liveGames.map((g) => g.id)

        const { data: predictionsRaw, error: predictionsError } = await supabase
          .from('predictions')
          .select('user_id, game_id, home_score, away_score')
          .in('game_id', liveGameIds)
          .eq('group_id', groupId)

        if (predictionsError) {
          console.error('[useLiveTodayRanking] erro ao buscar predictions live:', predictionsError)
        } else {
          const liveGamesById = Object.fromEntries(liveGames.map((g) => [g.id, g]))

          for (const p of (predictionsRaw ?? [])) {
            const uid = p.user_id as string
            const game = liveGamesById[p.game_id as string]
            if (!game) continue

            usersWithLiveGame.add(uid)

            const result = calculateLiveScore(game, {
              home_score: p.home_score as number,
              away_score: p.away_score as number,
            })
            if (result === null) continue

            livePoints[uid] = (livePoints[uid] ?? 0) + result.points
          }
        }
      }

      // 6. Montar entries e ordenar
      const unsorted = members.map((m) => ({
        userId: m.userId,
        name: m.name,
        points: (officialPoints[m.userId] ?? 0) + (livePoints[m.userId] ?? 0),
        hasLiveGame: usersWithLiveGame.has(m.userId),
        rankPosition: 0, // calculado abaixo
      }))

      unsorted.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return a.name.localeCompare(b.name, 'pt-BR')
      })

      // Aplicar RANK() — mesmas posições para empates, pulo após grupo empatado
      let previousRank = 0
      let previousPoints: number | null = null

      const ranked = unsorted.map((entry, index) => {
        const rankPosition =
          previousPoints !== null && entry.points === previousPoints
            ? previousRank
            : index + 1

        previousRank = rankPosition
        previousPoints = entry.points

        return { ...entry, rankPosition }
      })

      setEntries(ranked)
    } catch (err) {
      console.error('[useLiveTodayRanking] erro inesperado:', err)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      queueMicrotask(() => setLoading(false))
      return
    }

    // Busca inicial (setTimeout 0 para não chamar setState sincronamente no efeito)
    const initialFetchTimer = window.setTimeout(() => {
      void fetchData()
    }, 0)

    const supabase = createClient()
    let debounceGames: number | undefined
    let debounceScores: number | undefined

    // Canal 1: mudanças em games (placar ao vivo)
    const gamesChannel = supabase
      .channel(`live-today-games-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        () => {
          window.clearTimeout(debounceGames)
          debounceGames = window.setTimeout(() => {
            void fetchData()
          }, 1000)
        }
      )
      .subscribe()

    // Canal 2: mudanças em scores (pontuação oficial calculada pelo trigger)
    const scoresChannel = supabase
      .channel(`live-today-scores-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          window.clearTimeout(debounceScores)
          debounceScores = window.setTimeout(() => {
            void fetchData()
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceGames)
      window.clearTimeout(debounceScores)
      supabase.removeChannel(gamesChannel)
      supabase.removeChannel(scoresChannel)
    }
  }, [fetchData, groupId])

  return { entries, games, loading, hasGamesToday }
}
