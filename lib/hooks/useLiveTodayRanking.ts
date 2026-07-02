'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import { subscribeToGameUpdates, acquireGlobalChannel, releaseGlobalChannel } from '@/lib/cache/score-cache'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface LiveTodayEntry {
  userId: string
  name: string
  points: number
  hasLiveGame: boolean
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
// Helpers
// ---------------------------------------------------------------------------

function getESPNToday(): string {
  const nowUTC = new Date()
  const nowESPN = new Date(nowUTC.getTime() - 5 * 60 * 60 * 1000)
  const yyyy = nowESPN.getUTCFullYear()
  const mm = String(nowESPN.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowESPN.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Hook principal — usa ScoreCache (1 canal global) em vez de 2 canais próprios
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

  const today = useMemo(() => getESPNToday(), [])

  // Fetch dos dados (mantido async pois precisa de members + scores além de games)
  useEffect(() => {
    if (!groupId) {
      queueMicrotask(() => setLoading(false))
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const supabase = createClient()

        const { data: gamesRaw, error: gamesError } = await supabase
          .from('games')
          .select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, match_date')
          .eq('match_day', today)

        if (cancelled) return

        if (gamesError) {
          console.error('[useLiveTodayRanking] erro:', gamesError)
          setLoading(false)
          return
        }

        const gamesData = gamesRaw ?? []

        if (gamesData.length === 0) {
          setHasGamesToday(false)
          setGames([])
          setEntries([])
          setLoading(false)
          return
        }

        setHasGamesToday(true)
        const todayGames: LiveTodayGame[] = gamesData.map((g) => ({
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
        setGames(todayGames)

        const finishedIds = gamesData.filter((g) => g.status === 'finished').map((g) => g.id)
        const liveGamesArr = gamesData
          .filter((g) => g.status === 'live')
          .map((g) => ({ id: g.id, home_score: g.home_score as number | null, away_score: g.away_score as number | null }))

        const { data: membersRaw } = await supabase
          .from('group_members')
          .select('user_id, profiles(name)')
          .eq('group_id', groupId)

        if (cancelled) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const members = ((membersRaw ?? []) as any[]).map((m: any) => ({
          userId: m.user_id as string,
          name: (m.profiles?.name ?? m.user_id) as string,
        }))

        if (members.length === 0) {
          setEntries([])
          setLoading(false)
          return
        }

        const officialPoints: Record<string, number> = {}
        if (finishedIds.length > 0) {
          const { data: scoresRaw } = await supabase
            .from('scores')
            .select('user_id, points')
            .in('game_id', finishedIds)
            .eq('group_id', groupId)

          for (const s of (scoresRaw ?? [])) {
            officialPoints[s.user_id as string] = (officialPoints[s.user_id as string] ?? 0) + (s.points as number)
          }
        }

        const livePoints: Record<string, number> = {}
        const usersWithLiveGame = new Set<string>()
        if (liveGamesArr.length > 0) {
          const liveGameIds = liveGamesArr.map((g) => g.id)
          const { data: predictionsRaw } = await supabase
            .from('predictions')
            .select('user_id, game_id, home_score, away_score')
            .in('game_id', liveGameIds)
            .eq('group_id', groupId)

          const liveGamesById = Object.fromEntries(liveGamesArr.map((g) => [g.id, g]))
          for (const p of (predictionsRaw ?? [])) {
            const uid = p.user_id as string
            const game = liveGamesById[p.game_id as string]
            if (!game) continue
            usersWithLiveGame.add(uid)
            const result = calculateLiveScore(game, { home_score: p.home_score as number, away_score: p.away_score as number })
            if (result === null) continue
            livePoints[uid] = (livePoints[uid] ?? 0) + result.points
          }
        }

        const unsorted = members.map((m) => ({
          userId: m.userId, name: m.name,
          points: (officialPoints[m.userId] ?? 0) + (livePoints[m.userId] ?? 0),
          hasLiveGame: usersWithLiveGame.has(m.userId),
          rankPosition: 0,
        }))

        unsorted.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          return a.name.localeCompare(b.name, 'pt-BR')
        })

        let previousRank = 0
        let previousPoints: number | null = null
        const ranked = unsorted.map((entry, index) => {
          const rankPosition = previousPoints !== null && entry.points === previousPoints ? previousRank : index + 1
          previousRank = rankPosition
          previousPoints = entry.points
          return { ...entry, rankPosition }
        })

        setEntries(ranked)
      } catch (err) {
        console.error('[useLiveTodayRanking] erro inesperado:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const initialFetchTimer = window.setTimeout(() => { void fetchData() }, 0)

    // Usa o canal Realtime global do ScoreCache em vez de 2 canais próprios
    acquireGlobalChannel()
    let debounceTimer: number | undefined

    const unsub = subscribeToGameUpdates('useLiveTodayRanking', () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => { void fetchData() }, 1000)
    })

    return () => {
      cancelled = true
      window.clearTimeout(initialFetchTimer)
      window.clearTimeout(debounceTimer)
      unsub()
      releaseGlobalChannel()
    }
  }, [groupId, today])

  return { entries, games, loading, hasGamesToday }
}
