import type { GameRow } from '@/lib/analytics/team-stats'

export type StandingEntry = {
  position: number
  teamCode: string
  teamName: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

type TeamAccumulator = {
  teamCode: string
  teamName: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

/**
 * Calcula a classificação do grupo a partir dos jogos encerrados anteriores à data informada.
 *
 * @param allGroupGames - Todos os jogos do grupo (qualquer status, qualquer data)
 * @param beforeDate    - match_date do jogo exibido (ISO string); jogos com match_date >= beforeDate são excluídos
 * @returns Array ordenado de StandingEntry com position 1-based
 */
export function calculateGroupStandings(
  allGroupGames: GameRow[],
  beforeDate: string
): StandingEntry[] {
  if (allGroupGames.length === 0) return []

  const cutoff = new Date(beforeDate).getTime()

  // 1. Extrair todos os times únicos do grupo (sem filtro de data/status)
  const teamsMap = new Map<string, string>() // teamCode -> teamName
  for (const game of allGroupGames) {
    teamsMap.set(game.home_team_code, game.home_team)
    teamsMap.set(game.away_team_code, game.away_team)
  }

  // 2. Inicializar acumuladores
  const acc = new Map<string, TeamAccumulator>()
  for (const [code, name] of teamsMap) {
    acc.set(code, {
      teamCode: code,
      teamName: name,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    })
  }

  // 3. Filtrar jogos que contam para a classificação
  const eligibleGames = allGroupGames.filter(
    (g) =>
      g.status === 'finished' &&
      g.home_score !== null &&
      g.away_score !== null &&
      new Date(g.match_date).getTime() < cutoff
  )

  // 4. Acumular resultados
  for (const game of eligibleGames) {
    const homeAcc = acc.get(game.home_team_code)
    const awayAcc = acc.get(game.away_team_code)
    if (!homeAcc || !awayAcc) continue

    const hs = game.home_score!
    const as_ = game.away_score!

    homeAcc.played++
    awayAcc.played++
    homeAcc.goalsFor += hs
    homeAcc.goalsAgainst += as_
    awayAcc.goalsFor += as_
    awayAcc.goalsAgainst += hs

    if (hs > as_) {
      homeAcc.wins++
      homeAcc.points += 3
      awayAcc.losses++
    } else if (hs === as_) {
      homeAcc.draws++
      homeAcc.points += 1
      awayAcc.draws++
      awayAcc.points += 1
    } else {
      awayAcc.wins++
      awayAcc.points += 3
      homeAcc.losses++
    }
  }

  // 5. Ordenar: pontos DESC, saldo DESC, gols pró DESC, nome ASC
  const sorted = Array.from(acc.values()).sort((a, b) => {
    const sgA = a.goalsFor - a.goalsAgainst
    const sgB = b.goalsFor - b.goalsAgainst

    if (b.points !== a.points) return b.points - a.points
    if (sgB !== sgA) return sgB - sgA
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.teamName.localeCompare(b.teamName, 'pt-BR')
  })

  // 6. Atribuir posição 1-based
  return sorted.map((entry, index) => ({
    position: index + 1,
    teamCode: entry.teamCode,
    teamName: entry.teamName,
    points: entry.points,
    played: entry.played,
    wins: entry.wins,
    draws: entry.draws,
    losses: entry.losses,
    goalsFor: entry.goalsFor,
    goalsAgainst: entry.goalsAgainst,
    goalDifference: entry.goalsFor - entry.goalsAgainst,
  }))
}
