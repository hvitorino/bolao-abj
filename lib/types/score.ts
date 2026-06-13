export interface ScoreBreakdown {
  winner: number       // 0 ou 3
  exact: number        // 0 ou 5
  winner_score: number // 0 ou 3
  diff: number         // 0 ou 2
  loser_score: number  // 0 ou 1
  goleada: number      // 0 ou 1
}

export interface Score {
  id: string
  user_id: string
  game_id: string
  prediction_id: string
  points: number
  breakdown: ScoreBreakdown
  calculated_at: string // ISO 8601
}
