export interface ScoutCounts {
  exact: number
  winner: number
  winner_score: number
  diff: number
  loser_score: number
  goleada: number
}

export interface RankingEntry {
  rank_position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  aproveitamento: number
  predictions_count: number
  scouts: string[]
  streak: number
  scout_counts: ScoutCounts | null
}
