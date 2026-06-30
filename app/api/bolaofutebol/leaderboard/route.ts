/**
 * GET /api/bolaofutebol/leaderboard
 *
 * Proxy para bolaodefutebol.com/groups/{id}/leaderboard
 * Retorna o leaderboard com tiebreaker stats do grupo Cartola ABJ.
 */
import { NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

export const dynamic = 'force-dynamic'

const BDF_GROUP_ID = 'ba08470f-94e7-4e51-b324-dc65c60c78af'

interface LeaderboardEntry {
  user_id: string
  user_name: string
  photo_url?: string
  total_points: number
  rank: number
  member_status: string
  tiebreaker_stats: {
    winner_count: number
    exact_score_count: number
    winner_goals_count: number
    goal_diff_count: number
    loser_goals_count: number
    goleada_count: number
    entry_order: number
  }
}

export async function GET() {
  try {
    const data = await bdfFetch<{ entries: LeaderboardEntry[] }>(
      `/groups/${BDF_GROUP_ID}/leaderboard?limit=1000&tiebreaker=true`
    )
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
