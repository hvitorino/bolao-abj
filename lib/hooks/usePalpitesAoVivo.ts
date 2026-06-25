'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import type { ScoreBreakdown } from '@/lib/types/score'
import type { RankingEntry } from '@/lib/types/ranking'

// Intervalo de polling configurável
const POLL_INTERVAL_MS = 10_000

// --------------------------------------------------------------------------
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
  status: 'live'
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
  livePoints: number | null    // pontos parciais calculados client-side (live only)
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
  liveGames: LiveGameWithPrediction[]
  rankingWithDetails: RankingParticipantDetail[]
  loading: boolean
  error: string | null
  lastPolledAt: Date | null
}

// --------------------------------------------------------------------------
// Tipos internos (Supabase rows)
// --------------------------------------------------------------------------

interface GameRow {
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

interface PredictionRow {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

interface ScoreRow {
  user_id: string
  game_id: string
  points: number
  breakdown: ScoreBreakdown
}

// --------------------------------------------------------------------------
// Cálculo de total_points com pontos live
// --------------------------------------------------------------------------

function applyLivePointsToRanking(
  ranking: RankingEntry[],
  livePointsByUser: Record<string, number>
): Array<{ entry: RankingEntry; total_points: number; hasLivePoints: boolean }> {
  return ranking.map((entry) => {
    const live = livePointsByUser[entry.user_id] ?? 0
    return {
      entry,
      total_points: entry.total_points + live,
      hasLivePoints: live > 0,
    }
  })
}

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
  currentUserId: string
): UsePalpitesAoVivoResult {
  const [liveGames, setLiveGames] = useState<LiveGameWithPrediction[]>([])
  const [rankingWithDetails, setRankingWithDetails] = useState<RankingParticipantDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null)

  // Controla se é o primeiro fetch (para setLoading correto)
  const isFirstFetch = useRef(true)

  const fetchAll = async () => {
    try {
      const supabase = createClient()

      // 1. Buscar sessão para token de autorização
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      // 2. Buscar jogos live e finished
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,match_date')
        .in('status', ['live', 'finished'])
        .order('match_date', { ascending: true })

      if (gamesError) throw new Error(`jogos: ${gamesError.message}`)

      const games = (gamesData ?? []) as GameRow[]
      const gameIds = games.map((g) => g.id)
      const liveGameIds = games.filter((g) => g.status === 'live').map((g) => g.id)
      const finishedGameIds = games.filter((g) => g.status === 'finished').map((g) => g.id)

      // 3. Buscar palpites (live + finished) do grupo
      let allPredictions: PredictionRow[] = []
      if (gameIds.length > 0) {
        const { data: predictionsData, error: predictionsError } = await supabase
          .from('predictions')
          .select('user_id,game_id,home_score,away_score')
          .eq('group_id', groupId)
          .in('game_id', gameIds)

        if (predictionsError) throw new Error(`palpites: ${predictionsError.message}`)
        allPredictions = (predictionsData ?? []) as PredictionRow[]
      }

      // 4. Buscar scores (apenas finished)
      let allScores: ScoreRow[] = []
      if (finishedGameIds.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('user_id,game_id,points,breakdown')
          .eq('group_id', groupId)
          .in('game_id', finishedGameIds)

        if (scoresError) throw new Error(`scores: ${scoresError.message}`)
        allScores = (scoresData ?? []) as ScoreRow[]
      }

      // 5. Buscar ranking oficial via API
      let rankingEntries: RankingEntry[] = []
      if (token) {
        const rankingRes = await fetch(`/api/ranking?group_id=${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (rankingRes.ok) {
          const rankingJson = await rankingRes.json()
          rankingEntries = (rankingJson as RankingEntry[]) ?? []
        }
      }

      // ---------- Montar índices para lookup rápido ----------

      const gamesById: Record<string, GameRow> = {}
      for (const g of games) gamesById[g.id] = g

      // Palpites indexados por userId → gameId
      const predByUserGame: Record<string, Record<string, PredictionRow>> = {}
      for (const p of allPredictions) {
        if (!predByUserGame[p.user_id]) predByUserGame[p.user_id] = {}
        predByUserGame[p.user_id][p.game_id] = p
      }

      // Scores indexados por userId → gameId
      const scoreByUserGame: Record<string, Record<string, ScoreRow>> = {}
      for (const s of allScores) {
        if (!scoreByUserGame[s.user_id]) scoreByUserGame[s.user_id] = {}
        scoreByUserGame[s.user_id][s.game_id] = s
      }

      // ---------- Palpites do currentUser para jogos live ----------

      const myPredsByGame = predByUserGame[currentUserId] ?? {}

      const newLiveGames: LiveGameWithPrediction[] = games
        .filter((g) => g.status === 'live')
        .map((g) => {
          const myPred = myPredsByGame[g.id] ?? null
          return {
            id: g.id,
            home_team: g.home_team,
            away_team: g.away_team,
            home_team_code: g.home_team_code,
            away_team_code: g.away_team_code,
            home_score: g.home_score,
            away_score: g.away_score,
            status: 'live' as const,
            myPrediction: myPred
              ? { home_score: myPred.home_score, away_score: myPred.away_score }
              : null,
          }
        })

      // ---------- Calcular pontos live por usuário ----------

      const livePointsByUser: Record<string, number> = {}

      if (liveGameIds.length > 0) {
        for (const userId of Object.keys(predByUserGame)) {
          const userPreds = predByUserGame[userId]
          let sum = 0
          for (const gameId of liveGameIds) {
            const pred = userPreds[gameId]
            if (!pred) continue
            const game = gamesById[gameId]
            if (!game) continue
            const result = calculateLiveScore(
              { home_score: game.home_score, away_score: game.away_score },
              { home_score: pred.home_score, away_score: pred.away_score }
            )
            if (result) sum += result.points
          }
          if (sum > 0) livePointsByUser[userId] = sum
        }
      }

      // ---------- Montar ranking com detalhes ----------

      const adjustedRanking = sortRanking(applyLivePointsToRanking(rankingEntries, livePointsByUser))

      const newRankingWithDetails: RankingParticipantDetail[] = adjustedRanking.map(
        ({ entry, total_points, hasLivePoints, rank_position }) => {
          const userPreds = predByUserGame[entry.user_id] ?? {}
          const userScores = scoreByUserGame[entry.user_id] ?? {}

          // Montar games: apenas live e finished (não pending)
          const userGames: GameScoreEntry[] = games.map((g) => {
            const pred = userPreds[g.id] ?? null
            const score = userScores[g.id] ?? null

            let livePoints: number | null = null
            if (g.status === 'live' && pred) {
              const result = calculateLiveScore(
                { home_score: g.home_score, away_score: g.away_score },
                { home_score: pred.home_score, away_score: pred.away_score }
              )
              livePoints = result?.points ?? null
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

      // Atualizar estado (sem resetar loading para true em polls subsequentes)
      setLiveGames(newLiveGames)
      setRankingWithDetails(newRankingWithDetails)
      setError(null)
      setLastPolledAt(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('[usePalpitesAoVivo] erro:', message)
      setError(message)
    } finally {
      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Busca inicial diferida para evitar setState síncrono dentro do effect
    const initialTimer = window.setTimeout(() => {
      void fetchAll()
    }, 0)

    const interval = setInterval(() => {
      void fetchAll()
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearTimeout(initialTimer)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId])

  return { liveGames, rankingWithDetails, loading, error, lastPolledAt }
}
