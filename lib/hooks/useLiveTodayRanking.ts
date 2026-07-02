'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import {
  acquireGlobalChannel,
  releaseGlobalChannel,
  subscribeToGameUpdates,
  ensureDate,
  getCachedGames,
} from '@/lib/cache/score-cache'
import {
  acquirePredictionCache,
  releasePredictionCache,
  ensurePredictions,
  getCachedPredictions,
  subscribeToPredictionUpdates,
} from '@/lib/cache/prediction-cache'
import {
  acquirePointsCache,
  releasePointsCache,
  ensurePoints,
  getCachedPoints,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'

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

  const today = useMemo(() => getESPNToday(), [])

  // Ref estável para membros — evita re-registrar listeners ao mudar members
  const membersRef = useRef<Array<{ userId: string; name: string }>>([])

  useEffect(() => {
    if (!groupId) {
      queueMicrotask(() => setLoading(false))
      return
    }

    let cancelled = false

    // Acquire dos três caches
    acquireGlobalChannel()
    acquirePredictionCache(groupId)
    acquirePointsCache(groupId)

    // Função de cálculo síncrona — sem IO
    function computeAndSetEntries(
      members: Array<{ userId: string; name: string }>,
      fallbackGames: LiveTodayGame[],
    ): void {
      // Atualiza games a partir do cache (placar pode ter mudado)
      const freshGames = getCachedGames(today) as LiveTodayGame[]
      const displayGames = freshGames.length > 0 ? freshGames : fallbackGames
      setGames(displayGames)

      const finishedIds = displayGames.filter((g) => g.status === 'finished').map((g) => g.id)
      const liveGamesArr = displayGames.filter((g) => g.status === 'live')
      const liveGamesById = Object.fromEntries(liveGamesArr.map((g) => [g.id, g]))

      // Pontuação oficial: ler do PointsCache (jogos finished)
      const officialPoints: Record<string, number> = {}
      if (finishedIds.length > 0) {
        const pointsMap = getCachedPoints(groupId)
        for (const gameId of finishedIds) {
          const gamePoints = pointsMap.get(gameId)
          if (!gamePoints) continue
          for (const [userId, cached] of gamePoints) {
            officialPoints[userId] = (officialPoints[userId] ?? 0) + cached.points
          }
        }
      }

      // Pontuação ao vivo: ler do PredictionCache (jogos live)
      const livePointsMap: Record<string, number> = {}
      const usersWithLiveGame = new Set<string>()
      if (liveGamesArr.length > 0) {
        const allPredictions = getCachedPredictions(groupId)
        for (const game of liveGamesArr) {
          const userPreds = allPredictions.get(game.id)
          if (!userPreds) continue
          for (const [userId, pred] of userPreds) {
            const gameData = liveGamesById[game.id]
            if (!gameData) continue
            usersWithLiveGame.add(userId)
            const result = calculateLiveScore(gameData, { home_score: pred.home_score, away_score: pred.away_score })
            if (result === null) continue
            livePointsMap[userId] = (livePointsMap[userId] ?? 0) + result.points
          }
        }
      }

      // Montar + ordenar + rankear
      const unsorted = members.map((m) => ({
        userId: m.userId,
        name: m.name,
        points: (officialPoints[m.userId] ?? 0) + (livePointsMap[m.userId] ?? 0),
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
        const rankPosition =
          previousPoints !== null && entry.points === previousPoints ? previousRank : index + 1
        previousRank = rankPosition
        previousPoints = entry.points
        return { ...entry, rankPosition }
      })

      setEntries(ranked)
    }

    async function fetchData() {
      try {
        const supabase = createClient()

        // Executa em paralelo: fetch de membros + carregamento de jogos no cache
        const [membersResult] = await Promise.all([
          supabase.from('group_members').select('user_id, profiles(name)').eq('group_id', groupId),
          ensureDate(today),
        ])

        if (cancelled) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const members = ((membersResult.data ?? []) as any[]).map((m: any) => ({
          userId: m.user_id as string,
          name: (m.profiles?.name ?? m.user_id) as string,
        }))

        membersRef.current = members

        const todayGames = getCachedGames(today) as LiveTodayGame[]

        if (todayGames.length === 0) {
          setHasGamesToday(false)
          setGames([])
          setEntries([])
          setLoading(false)
          return
        }

        setHasGamesToday(true)
        setGames(todayGames)

        if (members.length === 0) {
          setEntries([])
          setLoading(false)
          return
        }

        const liveGamesArr = todayGames.filter((g) => g.status === 'live')

        // Carregar pontuações oficiais (finished) e palpites (live) em paralelo
        const ensurePromises: Promise<unknown>[] = [ensurePoints(groupId, today)]
        if (liveGamesArr.length > 0) {
          ensurePromises.push(ensurePredictions(groupId, today))
        }

        await Promise.all(ensurePromises)

        if (cancelled) return

        computeAndSetEntries(members, todayGames)
      } catch (err) {
        console.error('[useLiveTodayRanking] erro inesperado:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()

    // Timers de debounce para cada tipo de evento
    let debounceGameTimer: number | undefined
    let debouncePointsTimer: number | undefined
    let debouncePredTimer: number | undefined

    const unsubGame = subscribeToGameUpdates('useLiveTodayRanking', () => {
      window.clearTimeout(debounceGameTimer)
      debounceGameTimer = window.setTimeout(() => {
        if (!cancelled) {
          computeAndSetEntries(membersRef.current, getCachedGames(today) as LiveTodayGame[])
        }
      }, 1000)
    })

    const unsubPoints = subscribeToPointsUpdates(groupId, 'useLiveTodayRanking', () => {
      window.clearTimeout(debouncePointsTimer)
      debouncePointsTimer = window.setTimeout(() => {
        if (!cancelled) {
          computeAndSetEntries(membersRef.current, getCachedGames(today) as LiveTodayGame[])
        }
      }, 1000)
    })

    const unsubPred = subscribeToPredictionUpdates(groupId, 'useLiveTodayRanking', () => {
      window.clearTimeout(debouncePredTimer)
      debouncePredTimer = window.setTimeout(() => {
        if (!cancelled) {
          computeAndSetEntries(membersRef.current, getCachedGames(today) as LiveTodayGame[])
        }
      }, 1000)
    })

    return () => {
      cancelled = true
      window.clearTimeout(debounceGameTimer)
      window.clearTimeout(debouncePointsTimer)
      window.clearTimeout(debouncePredTimer)
      unsubGame()
      unsubPoints()
      unsubPred()
      releaseGlobalChannel()
      releasePredictionCache(groupId)
      releasePointsCache(groupId)
    }
  }, [groupId, today])

  return { entries, games, loading, hasGamesToday }
}
