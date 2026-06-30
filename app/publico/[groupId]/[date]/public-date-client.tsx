'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'
import type { LiveGameWithPrediction, RankingParticipantDetail, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import type { ScoreBreakdown } from '@/lib/types/score'

const POLL_INTERVAL_MS = 10_000

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

interface GameRaw {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: string
  match_date: string
  round: string
  phase: string
}

function sortAndRank(
  members: PublicMember[],
  predByUserGame: Record<string, Record<string, { home_score: number; away_score: number }>>,
  scoreByUserGame: Record<string, Record<string, { points: number; breakdown: ScoreBreakdown }>>,
  gamesRaw: GameRaw[]
): RankingParticipantDetail[] {
  const liveGames = gamesRaw.filter((g) => g.status === 'live')

  const todayPointsByUser: Record<string, number> = {}
  const hasLiveByUser: Record<string, boolean> = {}

  // Pontos oficiais de jogos finalizados
  for (const userId of members.map((m) => m.id)) {
    const userScores = scoreByUserGame[userId] ?? {}
    for (const s of Object.values(userScores)) {
      todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + s.points
    }
  }

  // Pontos provisórios de jogos ao vivo
  for (const userId of members.map((m) => m.id)) {
    const userPreds = predByUserGame[userId] ?? {}
    for (const game of liveGames) {
      const pred = userPreds[game.id]
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

    const userPreds = predByUserGame[item.id] ?? {}
    const userScores = scoreByUserGame[item.id] ?? {}

    const userGames: GameScoreEntry[] = gamesRaw.map((g) => {
      const pred = g.status !== 'pending' ? (userPreds[g.id] ?? null) : null
      const score = userScores[g.id] ?? null

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

  const fetchUpdates = async () => {
    try {
      const supabase = createClient()

      const { data: gamesData } = await supabase
        .from('games')
        .select(
          'id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,match_date,round,phase'
        )
        .eq('match_day', date)
        .order('match_date', { ascending: true })

      const gamesRaw: GameRaw[] = gamesData ?? []
      const liveOrFinishedIds = gamesRaw.filter((g) => g.status !== 'pending').map((g) => g.id)
      const finishedIds = gamesRaw.filter((g) => g.status === 'finished').map((g) => g.id)

      const scoresKey = gamesRaw
        .map((g) => `${g.id}:${g.status}:${g.home_score}:${g.away_score}`)
        .join('|')
      if (scoresKey === prevScoresKey.current && hasData.current) return
      prevScoresKey.current = scoresKey

      // Palpites (apenas jogos não-pending)
      const predByUserGame: Record<
        string,
        Record<string, { home_score: number; away_score: number }>
      > = {}
      if (liveOrFinishedIds.length > 0) {
        const { data: predsData } = await supabase
          .from('predictions')
          .select('user_id,game_id,home_score,away_score')
          .eq('group_id', groupId)
          .in('game_id', liveOrFinishedIds)
        for (const p of predsData ?? []) {
          if (!predByUserGame[p.user_id]) predByUserGame[p.user_id] = {}
          predByUserGame[p.user_id][p.game_id] = {
            home_score: p.home_score,
            away_score: p.away_score,
          }
        }
      }

      // Scores (jogos finalizados)
      const scoreByUserGame: Record<
        string,
        Record<string, { points: number; breakdown: ScoreBreakdown }>
      > = {}
      if (finishedIds.length > 0) {
        const { data: scoresData } = await supabase
          .from('scores')
          .select('user_id,game_id,points,breakdown')
          .eq('group_id', groupId)
          .in('game_id', finishedIds)
        for (const s of scoresData ?? []) {
          if (!scoreByUserGame[s.user_id]) scoreByUserGame[s.user_id] = {}
          scoreByUserGame[s.user_id][s.game_id] = {
            points: s.points,
            breakdown: s.breakdown as ScoreBreakdown,
          }
        }
      }

      const newGames: LiveGameWithPrediction[] = gamesRaw.map((g) => ({
        id: g.id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_team_code: g.home_team_code,
        away_team_code: g.away_team_code,
        home_score: g.home_score,
        away_score: g.away_score,
        status: g.status as 'pending' | 'live' | 'finished',
        match_date: g.match_date,
        round: g.round,
        phase: g.phase,
        myPrediction: null,
      }))

      const newRanking = sortAndRank(members, predByUserGame, scoreByUserGame, gamesRaw)

      setGames(newGames)
      setRanking(newRanking)
      hasData.current = true
    } catch (err) {
      console.error('[PublicDateClient] polling error:', err)
    }
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      void fetchUpdates()
      interval = setInterval(() => void fetchUpdates(), POLL_INTERVAL_MS)
    }

    function stopPolling() {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    const initialTimer = window.setTimeout(startPolling, 0)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearTimeout(initialTimer)
      stopPolling()
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
