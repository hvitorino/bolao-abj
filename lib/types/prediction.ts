export interface Prediction {
  id: string
  user_id: string
  game_id: string
  home_score: number
  away_score: number
  submitted_at: string // ISO 8601
}
