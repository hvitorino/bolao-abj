/**
 * GET /api/bolaofutebol/matches/[matchId]/predictions
 *
 * Proxy para bolaodefutebol.com/matches/{matchId}/predictions?groupId=...
 * Retorna os palpites de todos os participantes do grupo Cartola ABJ para uma partida.
 */
import { NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

export const dynamic = 'force-dynamic'

const BDF_GROUP_ID = 'ba08470f-94e7-4e51-b324-dc65c60c78af'

interface BdfPrediction {
  id: string
  user_id: string
  match_id: string
  group_id: string
  home_score: number
  away_score: number
  predicted_winner: string
  predicted_diff: number
  extra_time_winner_prediction: string
  penalties_winner_prediction: string
  points_earned: number
  status: string
  scoring_state: string
  last_match_version: number
  created_at: string
  updated_at: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params

  try {
    const predictions = await bdfFetch<BdfPrediction[]>(
      `/matches/${encodeURIComponent(matchId)}/predictions?groupId=${BDF_GROUP_ID}`
    )
    return NextResponse.json(predictions, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
