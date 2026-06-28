export type GameStatus = 'pending' | 'live' | 'finished'

export type GamePhase =
  | 'Fase de Grupos'
  | '16 avos de Final'
  | 'Oitavas de Final'
  | 'Quartas de Final'
  | 'Semifinal'
  | 'Terceiro Lugar'
  | 'Final'

export interface Game {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  match_date: string        // ISO 8601 string
  home_score: number | null
  away_score: number | null
  status: GameStatus
  round: string
  phase: GamePhase
  venue: string | null
  espn_id: string | null    // ID do evento na ESPN (ex: "760415")
  created_at: string
}
