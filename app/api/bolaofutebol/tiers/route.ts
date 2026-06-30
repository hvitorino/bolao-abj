/**
 * GET /api/bolaofutebol/tiers
 *
 * Proxy para bolaodefutebol.com/groups/{id}/members/tiers
 * Retorna o tier (pro ou gandula) de cada membro do grupo Cartola ABJ.
 */
import { NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

export const dynamic = 'force-dynamic'

const BDF_GROUP_ID = 'ba08470f-94e7-4e51-b324-dc65c60c78af'

interface TierEntry {
  user_id: string
  tier: string
}

export async function GET() {
  try {
    const data = await bdfFetch<{ entries: TierEntry[] }>(
      `/groups/${BDF_GROUP_ID}/members/tiers`
    )
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
