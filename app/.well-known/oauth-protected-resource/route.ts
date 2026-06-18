import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? 'meubolao-copa-2026.vercel.app'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = `${protocol}://${host}`

  return NextResponse.json({
    resource: base,
    authorization_servers: [base],
  })
}
