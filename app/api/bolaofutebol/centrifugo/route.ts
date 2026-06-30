/**
 * GET /api/bolaofutebol/centrifugo
 *
 * Proxy para bolaodefutebol.com/auth/centrifugo-token
 * Retorna o token ws para conexão Centrifugo (WebSocket).
 */
import { NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await bdfFetch<{ token: string }>('/auth/centrifugo-token')
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
