export interface ParticipantEntry {
  userId: string
  name: string
  prediction: { home_score: number; away_score: number } | null
  points: number | null
}
