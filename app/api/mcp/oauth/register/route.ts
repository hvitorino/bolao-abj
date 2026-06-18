import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const redirectUris = body['redirect_uris']
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return NextResponse.json(
      { error: 'invalid_redirect_uri', error_description: 'redirect_uris é obrigatório.' },
      { status: 400 }
    )
  }

  // Qualquer client_id é aceito — sem validação posterior no authorize/token
  const clientId = crypto.randomUUID()

  return NextResponse.json(
    {
      client_id: clientId,
      redirect_uris: redirectUris,
      client_name: body['client_name'] ?? null,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    { status: 201 }
  )
}
