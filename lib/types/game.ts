export type GameStatus = 'pending' | 'live' | 'finished'

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
  venue: string | null
  created_at: string
}
