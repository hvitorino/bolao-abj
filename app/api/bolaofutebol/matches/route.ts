/**
 * GET /api/bolaofutebol/matches
 *
 * Proxy para bolaodefutebol.com/matches — retorna todos os jogos da Copa 2026.
 * Cache de 30s no servidor (ISR) para não bombar a API do BDF.
 */
import { NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

export const dynamic = 'force-dynamic'

interface BdfMatch {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
  home_score: number | null
  away_score: number | null
  winner: string | null
  is_goleada: boolean
  extra_time_result: string
  penalties_winner?: string
  prob_home: number
  prob_draw: number
  prob_away: number
  version: number
  sub_status: string
  match_number: number
  stage: string
  phase: string
  allow_extra_time: boolean
  allow_penalties: boolean
}

export async function GET() {
  try {
    const matches = await bdfFetch<BdfMatch[]>('/matches')
    return NextResponse.json(matches, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
