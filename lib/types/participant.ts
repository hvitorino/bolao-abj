import type { ScoreBreakdown } from '@/lib/types/score'

export interface ParticipantEntry {
  userId: string
  name: string
  prediction: { id: string; home_score: number; away_score: number } | null
  points: number | null
  breakdown: ScoreBreakdown | null // null quando não há score calculado para este palpite
  hasPrediction: boolean // true se o participante registrou palpite (independente de estar visível)
}
