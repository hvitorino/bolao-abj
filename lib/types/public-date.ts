export interface PublicDateGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  round: string
  venue: string | null
  match_date: string
}

export interface ProfileEntry {
  userId: string
  name: string
}
