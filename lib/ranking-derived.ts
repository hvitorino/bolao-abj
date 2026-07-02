/**
 * lib/ranking-derived.ts
 *
 * Função pura que calcula o ranking derivado client-side a partir dos caches
 * ScoreCache e PredictionCache, unificando a lógica que hoje está espalhada em:
 * - usePalpitesAoVivo (linhas 249–275)
 * - RankingTable.applyLivePoints (linhas 77–105)
 * - useLivePointsByUser (inteiro)
 * - useLiveTodayRanking (linhas 147–233)
 */

import { calculateLiveScore } from '@/lib/scoring'
import type { ScoreBreakdown } from '@/lib/types/score'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GameScoreData {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
  round?: string
  phase?: string
}

export interface MemberEntry {
  user_id: string
  name: string
}

export interface PredictionEntry {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

export interface ScoreEntry {
  user_id: string
  game_id: string
  points: number
  breakdown: ScoreBreakdown
}

export interface GameScoreDetail {
  gameId: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
  userPrediction: { home_score: number; away_score: number } | null
  officialPoints: number | null
  officialBreakdown: ScoreBreakdown | null
  livePoints: number | null
  liveBreakdown: ScoreBreakdown | null
}

export interface RankingDerivedEntry {
  userId: string
  name: string
  totalPoints: number
  rankPosition: number
  hasLivePoints: boolean
  gamesDetail: GameScoreDetail[]
}

// ---------------------------------------------------------------------------
// Ordenação e ranking
// ---------------------------------------------------------------------------

function sortAndRank(
  items: Array<{
    userId: string
    name: string
    totalPoints: number
    hasLivePoints: boolean
    gamesDetail: GameScoreDetail[]
  }>
): RankingDerivedEntry[] {
  const sorted = [...items].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  let prevPoints: number | null = null
  let prevRank = 0

  return sorted.map((item, index) => {
    const rankPosition =
      prevPoints !== null && item.totalPoints === prevPoints ? prevRank : index + 1
    prevRank = rankPosition
    prevPoints = item.totalPoints
    return { ...item, rankPosition }
  })
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Calcula o ranking derivado client-side a partir de jogos, palpites e membros.
 *
 * @param games - array de objetos GameScoreData (com status, placar, etc.)
 * @param allPredictions - todos os palpites (opcional, se não informado ranking fica com 0 pontos)
 * @param officialScores - scores oficiais do banco (para jogos finished) — opcional
 * @param members - lista de membros do grupo
 * @returns RankingDerivedEntry[] ordenado por pontos (decrescente)
 */
export function computeLiveRanking(
  games: GameScoreData[],
  allPredictions: PredictionEntry[],
  officialScores: ScoreEntry[],
  members: MemberEntry[]
): RankingDerivedEntry[] {
  // Índices para lookup rápido
  const gamesById = new Map<string, GameScoreData>()
  for (const g of games) gamesById.set(g.id, g)

  // Palpites indexados por userId → gameId
  const predByUserGame = new Map<string, Map<string, PredictionEntry>>()
  for (const p of allPredictions) {
    if (!predByUserGame.has(p.user_id)) {
      predByUserGame.set(p.user_id, new Map())
    }
    predByUserGame.get(p.user_id)!.set(p.game_id, p)
  }

  // Scores indexados por userId → gameId
  const scoreByUserGame = new Map<string, Map<string, ScoreEntry>>()
  for (const s of officialScores) {
    if (!scoreByUserGame.has(s.user_id)) {
      scoreByUserGame.set(s.user_id, new Map())
    }
    scoreByUserGame.get(s.user_id)!.set(s.game_id, s)
  }

  // Pontos totais por usuário (oficiais + live)
  const totalsByUser = new Map<string, number>()
  const hasLiveByUser = new Map<string, boolean>()

  for (const member of members) {
    totalsByUser.set(member.user_id, 0)
  }

  // Pontos oficiais (jogos finished) da tabela scores
  for (const s of officialScores) {
    totalsByUser.set(s.user_id, (totalsByUser.get(s.user_id) ?? 0) + s.points)
  }

  // Pontos parciais (jogos live) via calculateLiveScore
  const liveGames = games.filter((g) => g.status === 'live')
  for (const member of members) {
    const userPreds = predByUserGame.get(member.user_id)
    if (!userPreds) continue

    for (const liveGame of liveGames) {
      const pred = userPreds.get(liveGame.id)
      if (!pred) continue

      const result = calculateLiveScore(
        { home_score: liveGame.home_score, away_score: liveGame.away_score },
        { home_score: pred.home_score, away_score: pred.away_score }
      )
      if (result && result.points > 0) {
        totalsByUser.set(
          member.user_id,
          (totalsByUser.get(member.user_id) ?? 0) + result.points
        )
        hasLiveByUser.set(member.user_id, true)
      }
    }
  }

  // Montar detalhes por jogo para cada membro
  const items = members.map((member) => {
    const userPreds = predByUserGame.get(member.user_id)
    const userScores = scoreByUserGame.get(member.user_id)

    const gamesDetail: GameScoreDetail[] = games.map((g) => {
      const pred = userPreds?.get(g.id) ?? null
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
      userId: member.user_id,
      name: member.name,
      totalPoints: totalsByUser.get(member.user_id) ?? 0,
      hasLivePoints: hasLiveByUser.get(member.user_id) ?? false,
      gamesDetail,
    }
  })

  return sortAndRank(items)
}

/**
 * Versão simplificada que calcula apenas o total de pontos por usuário
 * (sem detalhes por jogo). Útil para o ranking geral (RankingTable) que
 * não precisa do breakdown por jogo.
 */
export function computeLivePointsByUser(
  games: GameScoreData[],
  allPredictions: PredictionEntry[],
  members: MemberEntry[]
): Map<string, number> {
  // Palpites indexados por userId → gameId
  const predByUserGame = new Map<string, Map<string, PredictionEntry>>()
  for (const p of allPredictions) {
    if (!predByUserGame.has(p.user_id)) {
      predByUserGame.set(p.user_id, new Map())
    }
    predByUserGame.get(p.user_id)!.set(p.game_id, p)
  }

  const liveGames = games.filter((g) => g.status === 'live')
  const totals = new Map<string, number>()

  for (const member of members) {
    const userPreds = predByUserGame.get(member.user_id)
    if (!userPreds) continue

    let points = 0
    for (const liveGame of liveGames) {
      const pred = userPreds.get(liveGame.id)
      if (!pred) continue

      const result = calculateLiveScore(
        { home_score: liveGame.home_score, away_score: liveGame.away_score },
        { home_score: pred.home_score, away_score: pred.away_score }
      )
      if (result && result.points > 0) {
        points += result.points
      }
    }
    if (points > 0) {
      totals.set(member.user_id, points)
    }
  }

  return totals
}
