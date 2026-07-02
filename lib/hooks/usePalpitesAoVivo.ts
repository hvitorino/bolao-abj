'use client'

import { useEffect, useRef, useState } from 'react'
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
import type { ScoreBreakdown } from '@/lib/types/score'
import type { RankingEntry } from '@/lib/types/ranking'

// Tipos exportados
// --------------------------------------------------------------------------

export interface LiveGameWithPrediction {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
  round: string
  phase: string
  myPrediction: { home_score: number; away_score: number } | null
}

export interface GameScoreEntry {
  gameId: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  userPrediction: { home_score: number; away_score: number } | null
  officialPoints: number | null
  officialBreakdown: ScoreBreakdown | null
  livePoints: number | null         // pontos parciais calculados client-side (live only)
  liveBreakdown: ScoreBreakdown | null  // breakdown parcial calculado client-side (live only)
  match_date: string
}

export interface RankingParticipantDetail {
  userId: string
  name: string
  rank_position: number
  total_points: number
  hasLivePoints: boolean
  games: GameScoreEntry[]
}

export interface UsePalpitesAoVivoResult {
  todayGames: LiveGameWithPrediction[]
  rankingWithDetails: RankingParticipantDetail[]
  loading: boolean
  error: string | null
  lastPolledAt: Date | null
  refresh: () => Promise<void>
}

// --------------------------------------------------------------------------
// Ordenação do ranking
// --------------------------------------------------------------------------

function sortRanking(
  items: Array<{ entry: RankingEntry; total_points: number; hasLivePoints: boolean }>
) {
  const sorted = [...items].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return a.entry.participant_name.localeCompare(b.entry.participant_name, 'pt-BR')
  })

  let prevPoints: number | null = null
  let prevRank = 0

  return sorted.map((item, index) => {
    const rank_position =
      prevPoints !== null && item.total_points === prevPoints ? prevRank : index + 1
    prevRank = rank_position
    prevPoints = item.total_points
    return { ...item, rank_position }
  })
}

// --------------------------------------------------------------------------
// Hook principal
// --------------------------------------------------------------------------

export function usePalpitesAoVivo(
  groupId: string,
  currentUserId: string,
  selectedDate: string
): UsePalpitesAoVivoResult {
  const [todayGames, setTodayGames] = useState<LiveGameWithPrediction[]>([])
  const [rankingWithDetails, setRankingWithDetails] = useState<RankingParticipantDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastPolledAt] = useState<Date | null>(null)

  // Controla se é o primeiro fetch (para setLoading correto)
  const isFirstFetch = useRef(true)
  // Fingerprint dos placares do último poll — evita re-render desnecessário
  const prevScoresKey = useRef<string>('')
  // Indica se já temos dados válidos — erros transientes não sobrescrevem a UI
  const hasData = useRef(false)
  // Nomes dos participantes — populado por fetchParticipants(), consumido por computeAndSetState()
  const rankingEntriesRef = useRef<RankingEntry[]>([])

  // Busca os participantes do grupo via /api/ranking (apenas para nomes)
  // Chamado somente no mount e no visibilitychange — nunca em listeners de Realtime
  const fetchParticipants = async (): Promise<void> => {
    const supabase = createClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return
    const res = await fetch(`/api/ranking?group_id=${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      rankingEntriesRef.current = (await res.json()) as RankingEntry[]
    }
  }

  // Recálculo síncrono sem IO — chamado pelos listeners dos caches via debounce
  // Não faz nenhuma chamada a Supabase nem a /api/ranking
  function computeAndSetState(forceUpdate = false): void {
    const games = getCachedGames(selectedDate)                           // ScoreCache
    const allPredictions = getCachedPredictions(groupId)                 // PredictionCache — Map<gameId, Map<userId, CachedPrediction>>
    const allPoints = getCachedPoints(groupId)                           // PointsCache — Map<gameId, Map<userId, CachedPoints>>
    const rankingEntries = rankingEntriesRef.current

    const liveGameIds = games.filter(g => g.status === 'live').map(g => g.id)
    const finishedGameIds = games.filter(g => g.status === 'finished').map(g => g.id)

    // --- todayGames: jogos do dia com palpite do usuário atual ---
    const newTodayGames: LiveGameWithPrediction[] = games.map(g => {
      const myPred = allPredictions.get(g.id)?.get(currentUserId) ?? null
      return {
        id: g.id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_team_code: g.home_team_code,
        away_team_code: g.away_team_code,
        home_score: g.home_score,
        away_score: g.away_score,
        status: g.status,
        match_date: g.match_date,
        round: g.round,
        phase: g.phase,
        myPrediction: myPred
          ? { home_score: myPred.home_score, away_score: myPred.away_score }
          : null,
      }
    })

    // --- Pontos do dia por usuário ---

    // Jogos finalizados: pontuação oficial do PointsCache
    const todayPointsByUser: Record<string, number> = {}
    for (const gameId of finishedGameIds) {
      const gamePoints = allPoints.get(gameId)
      if (!gamePoints) continue
      for (const [userId, cached] of gamePoints) {
        todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + cached.points
      }
    }

    // Jogos ao vivo: pontuação parcial calculada client-side
    const hasLiveByUser: Record<string, boolean> = {}
    for (const gameId of liveGameIds) {
      const game = games.find(g => g.id === gameId)
      if (!game) continue
      const userPreds = allPredictions.get(gameId)
      if (!userPreds) continue
      for (const [userId, pred] of userPreds) {
        const result = calculateLiveScore(
          { home_score: game.home_score, away_score: game.away_score },
          { home_score: pred.home_score, away_score: pred.away_score }
        )
        if (result && result.points > 0) {
          todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + result.points
          hasLiveByUser[userId] = true
        }
      }
    }

    // --- Ranking com detalhes por participante ---
    const adjustedRanking = sortRanking(
      rankingEntries.map(entry => ({
        entry,
        total_points: todayPointsByUser[entry.user_id] ?? 0,
        hasLivePoints: hasLiveByUser[entry.user_id] ?? false,
      }))
    )

    const newRankingWithDetails: RankingParticipantDetail[] = adjustedRanking.map(
      ({ entry, total_points, hasLivePoints, rank_position }) => {
        const userGames: GameScoreEntry[] = games.map(g => {
          const pred = allPredictions.get(g.id)?.get(entry.user_id) ?? null
          const score = allPoints.get(g.id)?.get(entry.user_id) ?? null

          let livePoints: number | null = null
          let liveBreakdown: ScoreBreakdown | null = null
          if (g.status === 'live' && pred) {
            const result = calculateLiveScore(
              { home_score: g.home_score, away_score: g.away_score },
              { home_score: pred.home_score, away_score: pred.away_score }
            )
            livePoints = result?.points ?? null
            liveBreakdown = result?.breakdown ?? null
          }

          return {
            gameId: g.id,
            home_team: g.home_team,
            away_team: g.away_team,
            home_team_code: g.home_team_code,
            away_team_code: g.away_team_code,
            home_score: g.home_score,
            away_score: g.away_score,
            status: g.status,
            match_date: g.match_date,
            userPrediction: pred
              ? { home_score: pred.home_score, away_score: pred.away_score }
              : null,
            officialPoints: score?.points ?? null,
            officialBreakdown: score?.breakdown ?? null,
            livePoints,
            liveBreakdown,
          }
        })

        return {
          userId: entry.user_id,
          name: entry.participant_name,
          rank_position,
          total_points,
          hasLivePoints,
          games: userGames,
        }
      }
    )

    // --- Guard FLIP: só atualiza estado se placar/status mudou, ou se forçado ---
    const scoresKey = games
      .map(g => `${g.id}:${g.status}:${g.home_score}:${g.away_score}`)
      .join('|')
    const scoresChanged = scoresKey !== prevScoresKey.current
    prevScoresKey.current = scoresKey

    if (scoresChanged || forceUpdate) {
      setTodayGames(newTodayGames)
      setRankingWithDetails(newRankingWithDetails)
    }
  }

  // Inicialização assíncrona — executa no mount e no visibilitychange
  // Carrega os três caches e os nomes dos participantes, depois computa o estado
  const initialize = async (): Promise<void> => {
    try {
      await Promise.all([
        ensureDate(selectedDate),                   // ScoreCache
        ensurePredictions(groupId, selectedDate),    // PredictionCache
        ensurePoints(groupId, selectedDate),         // PointsCache
      ])
      await fetchParticipants()
      computeAndSetState(true)
      hasData.current = true
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('[usePalpitesAoVivo] erro:', message)
      // Só exibe erro se ainda não há dados — erros transientes são silenciosos
      if (!hasData.current) setError(message)
    } finally {
      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // 1. Adquirir os três caches
    acquireGlobalChannel()           // ScoreCache — canal live-scores-global
    acquirePredictionCache(groupId)  // PredictionCache — canal predictions-${groupId}
    acquirePointsCache(groupId)      // PointsCache — canal points-${groupId}

    // 2. Inicialização assíncrona (ensure* + fetchParticipants + compute)
    void initialize()

    // 3. Listeners reativos — recálculo síncrono sem IO
    let debounceGame: number | undefined
    const unsubGame = subscribeToGameUpdates('usePalpitesAoVivo', () => {
      window.clearTimeout(debounceGame)
      debounceGame = window.setTimeout(() => { computeAndSetState() }, 1000)
    })

    let debouncePred: number | undefined
    const unsubPred = subscribeToPredictionUpdates(groupId, 'usePalpitesAoVivo', () => {
      window.clearTimeout(debouncePred)
      debouncePred = window.setTimeout(() => { computeAndSetState() }, 500)
    })

    let debouncePoints: number | undefined
    const unsubPoints = subscribeToPointsUpdates(groupId, 'usePalpitesAoVivo', () => {
      window.clearTimeout(debouncePoints)
      debouncePoints = window.setTimeout(() => { computeAndSetState() }, 500)
    })

    // 4. visibilitychange → reinicialização completa (ensure* + fetchParticipants + compute)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void initialize()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // 5. Cleanup
    return () => {
      window.clearTimeout(debounceGame)
      window.clearTimeout(debouncePred)
      window.clearTimeout(debouncePoints)
      unsubGame()
      unsubPred()
      unsubPoints()
      releaseGlobalChannel()
      releasePredictionCache(groupId)
      releasePointsCache(groupId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId, selectedDate])

  return { todayGames, rankingWithDetails, loading, error, lastPolledAt, refresh: () => initialize() }
}
