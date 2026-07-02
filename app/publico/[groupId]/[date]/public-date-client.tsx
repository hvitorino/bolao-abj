'use client'

import { useState, useEffect, useRef } from 'react'
import { calculateLiveScore } from '@/lib/scoring'
import {
  subscribeToGameUpdates,
  acquireGlobalChannel,
  releaseGlobalChannel,
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
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'
import type { LiveGameWithPrediction, RankingParticipantDetail, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import type { ScoreBreakdown } from '@/lib/types/score'

export interface PublicMember {
  id: string
  name: string
}

interface PublicDateClientProps {
  groupId: string
  date: string
  initialGames: LiveGameWithPrediction[]
  initialRanking: RankingParticipantDetail[]
  members: PublicMember[]
}

function sortAndRank(
  members: PublicMember[],
  gamesRaw: LiveGameWithPrediction[],
  predByUserGame: Map<string, Map<string, { home_score: number; away_score: number }>>,
  pointsByUserGame: Map<string, Map<string, { points: number; breakdown: ScoreBreakdown }>>
): RankingParticipantDetail[] {
  const liveGames = gamesRaw.filter((g) => g.status === 'live')

  const todayPointsByUser: Record<string, number> = {}
  const hasLiveByUser: Record<string, boolean> = {}

  // Pontos oficiais de jogos finalizados
  for (const userId of members.map((m) => m.id)) {
    const userScores = pointsByUserGame.get(userId)
    if (!userScores) continue
    for (const [, s] of userScores) {
      todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + s.points
    }
  }

  // Pontos provisórios de jogos ao vivo
  for (const userId of members.map((m) => m.id)) {
    const userPreds = predByUserGame.get(userId)
    if (!userPreds) continue
    for (const game of liveGames) {
      const pred = userPreds.get(game.id)
      if (!pred) continue
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

  const ranked = members
    .map((m) => ({ ...m, total_points: todayPointsByUser[m.id] ?? 0, hasLivePoints: hasLiveByUser[m.id] ?? false }))
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return a.name.localeCompare(b.name, 'pt-BR')
    })

  let prevPoints: number | null = null
  let prevRank = 0

  return ranked.map((item, index) => {
    const rank_position =
      prevPoints !== null && item.total_points === prevPoints ? prevRank : index + 1
    prevRank = rank_position
    prevPoints = item.total_points

    const userPreds = predByUserGame.get(item.id)
    const userScores = pointsByUserGame.get(item.id)

    const userGames: GameScoreEntry[] = gamesRaw.map((g) => {
      const pred = g.status !== 'pending' ? (userPreds?.get(g.id) ?? null) : null
      const score = userScores?.get(g.id) ?? null

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
        status: g.status as 'pending' | 'live' | 'finished',
        match_date: g.match_date,
        userPrediction: pred,
        officialPoints: score?.points ?? null,
        officialBreakdown: score?.breakdown ?? null,
        livePoints,
        liveBreakdown,
      }
    })

    return {
      userId: item.id,
      name: item.name,
      rank_position,
      total_points: item.total_points,
      hasLivePoints: item.hasLivePoints,
      games: userGames,
    }
  })
}

/**
 * Cliente público para a rota /publico/[groupId]/[date].
 *
 * Substitui o polling de 10s (setInterval) por Realtime via caches centralizados.
 * Dados SSR (initialGames, initialRanking, members) são usados apenas como fallback
 * inicial — atualizações vêm dos caches.
 */
export default function PublicDateClient({
  groupId,
  date,
  initialGames,
  initialRanking,
  members,
}: PublicDateClientProps) {
  const [games, setGames] = useState<LiveGameWithPrediction[]>(initialGames)
  const [ranking, setRanking] = useState<RankingParticipantDetail[]>(initialRanking)

  const hasData = useRef(false)
  const prevScoresKey = useRef<string>('')

  // Recálculo síncrono a partir dos caches — chamado por listeners e initialize
  function computeAndSetState() {
    const cachedGames = getCachedGames(date)
    const allPreds = getCachedPredictions(groupId)   // Map<gameId, Map<userId, CachedPrediction>>
    const allPoints = getCachedPoints(groupId)        // Map<gameId, Map<userId, CachedPoints>>

    if (cachedGames.length === 0) return

    // Converter game format para LiveGameWithPrediction
    const gamesRaw: LiveGameWithPrediction[] = cachedGames.map((g) => ({
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
      myPrediction: null, // público — sem palpite do usuário
    }))

    // Converter predictions: Map<gameId, Map<userId, CachedPrediction>> → Map<userId, Map<gameId, {...}>>
    const predByUserId = new Map<string, Map<string, { home_score: number; away_score: number }>>()
    for (const [gameId, userMap] of allPreds) {
      for (const [userId, pred] of userMap) {
        if (!predByUserId.has(userId)) {
          predByUserId.set(userId, new Map())
        }
        predByUserId.get(userId)!.set(gameId, {
          home_score: pred.home_score,
          away_score: pred.away_score,
        })
      }
    }

    // Converter points: Map<gameId, Map<userId, CachedPoints>> → Map<userId, Map<gameId, {...}>>
    const pointsByUserId = new Map<string, Map<string, { points: number; breakdown: ScoreBreakdown }>>()
    for (const [gameId, userMap] of allPoints) {
      for (const [userId, pts] of userMap) {
        if (!pointsByUserId.has(userId)) {
          pointsByUserId.set(userId, new Map())
        }
        pointsByUserId.get(userId)!.set(gameId, {
          points: pts.points,
          breakdown: pts.breakdown,
        })
      }
    }

    // Guard FLIP: fingerprint de placares
    const scoresKey = gamesRaw
      .map((g) => `${g.id}:${g.status}:${g.home_score}:${g.away_score}`)
      .join('|')
    if (scoresKey === prevScoresKey.current && hasData.current) return
    prevScoresKey.current = scoresKey

    const newGames: LiveGameWithPrediction[] = gamesRaw
    const newRanking = sortAndRank(members, gamesRaw, predByUserId, pointsByUserId)

    setGames(newGames)
    setRanking(newRanking)
    hasData.current = true
  }

  // Inicialização assíncrona — carrega caches e dispara compute
  const initialize = async () => {
    try {
      await Promise.all([
        ensureDate(date),
        ensurePredictions(groupId, date),
        ensurePoints(groupId, date),
      ])
      computeAndSetState()
    } catch (err) {
      console.error('[PublicDateClient] erro:', err)
    }
  }

  useEffect(() => {
    // 1. Adquirir os três caches (anon client para Realtime público)
    acquireGlobalChannel()
    acquirePredictionCache(groupId)
    acquirePointsCache(groupId)

    // 2. Inicialização assíncrona
    void initialize()

    // 3. Listeners reativos — recálculo síncrono sem IO, sem polling
    let debounceGame: number | undefined
    const unsubGame = subscribeToGameUpdates('PublicDateClient', () => {
      window.clearTimeout(debounceGame)
      debounceGame = window.setTimeout(computeAndSetState, 1000)
    })

    let debouncePred: number | undefined
    const unsubPred = subscribeToPredictionUpdates(groupId, 'PublicDateClient', () => {
      window.clearTimeout(debouncePred)
      debouncePred = window.setTimeout(computeAndSetState, 500)
    })

    let debouncePoints: number | undefined
    const unsubPoints = subscribeToPointsUpdates(groupId, 'PublicDateClient', () => {
      window.clearTimeout(debouncePoints)
      debouncePoints = window.setTimeout(computeAndSetState, 500)
    })

    // 4. visibilitychange → reinicialização
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
  }, [groupId, date])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PalpitesLiveCard todayGames={games} loading={false} onGameClick={() => {}} groupId="" currentUserId="" />
      <PalpitesRanking
        currentUserId=""
        rankingWithDetails={ranking}
        todayGames={games}
        loading={false}
        error={null}
      />
    </div>
  )
}
