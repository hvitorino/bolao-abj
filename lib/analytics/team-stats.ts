import type { TeamStats } from '@/components/bolao/MatchupStatsCard'
import type { RecentGame } from '@/components/bolao/RecentGamesSection'

export type GameRow = {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  match_date: string
  match_day: string | null
  status: string
  round: string | null
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d
    .toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    .replace('.', '')
    .toUpperCase()
}

export function calculateTeamStats(
  games: GameRow[],
  teamCode: string,
  beforeDate: string
): TeamStats {
  const cutoff = new Date(beforeDate).getTime()
  let wins = 0,
    draws = 0,
    losses = 0
  let goalsFor = 0,
    goalsAgainst = 0
  let cleanSheets = 0,
    gamesScored = 0

  for (const game of games) {
    const isHome = game.home_team_code === teamCode
    const isAway = game.away_team_code === teamCode

    if (!isHome && !isAway) continue

    if (game.home_score === null || game.away_score === null) continue

    if (new Date(game.match_date).getTime() >= cutoff) continue

    const myScore = isHome ? game.home_score : game.away_score
    const oppScore = isHome ? game.away_score : game.home_score

    if (myScore > oppScore) wins++
    else if (myScore === oppScore) draws++
    else losses++

    goalsFor += myScore
    goalsAgainst += oppScore
    if (oppScore === 0) cleanSheets++
    if (myScore > 0) gamesScored++
  }

  return {
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets,
    gamesScored,
  }
}

export function getRecentGames(
  games: GameRow[],
  teamCode: string,
  beforeDate: string
): RecentGame[] {
  const cutoff = new Date(beforeDate).getTime()
  const teamGames = games
    .filter(
      (g) =>
        (g.home_team_code === teamCode || g.away_team_code === teamCode) &&
        g.home_score !== null &&
        g.away_score !== null &&
        new Date(g.match_date).getTime() < cutoff
    )
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())

  return teamGames.map((game) => {
    const isHome = game.home_team_code === teamCode
    const myScore = isHome ? game.home_score! : game.away_score!
    const oppScore = isHome ? game.away_score! : game.home_score!
    const adversario = isHome ? game.away_team_code : game.home_team_code

    let resultado: 'V' | 'E' | 'D'
    if (myScore > oppScore) resultado = 'V'
    else if (myScore === oppScore) resultado = 'E'
    else resultado = 'D'

    return {
      date: formatDate(game.match_date),
      placar: `${myScore}×${oppScore}`,
      adversario,
      resultado,
    }
  })
}
