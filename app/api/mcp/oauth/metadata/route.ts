import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? 'bolao-abj.vercel.app'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = `${protocol}://${host}`

  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/mcp/autorizar`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}
