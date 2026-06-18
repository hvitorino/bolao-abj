import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  let body: {
    access_token?: unknown
    refresh_token?: unknown
    redirect_uri?: unknown
    state?: unknown
    code_challenge?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Body inválido.' },
      { status: 422 }
    )
  }

  const { access_token, refresh_token, redirect_uri, state, code_challenge } = body

  if (
    typeof access_token !== 'string' ||
    typeof redirect_uri !== 'string' ||
    typeof state !== 'string' ||
    typeof code_challenge !== 'string'
  ) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'Parâmetros obrigatórios ausentes.' },
      { status: 422 }
    )
  }

  // Verificar o access_token com o cliente anônimo
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(access_token)

  if (authError || !user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Token inválido ou expirado.' },
      { status: 401 }
    )
  }

  // Gerar código temporário MCP
  const code = randomBytes(32).toString('hex')

  // Salvar código na tabela mcp_oauth_codes via service_role
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const { error: insertError } = await serviceClient.from('mcp_oauth_codes').insert({
    code,
    user_id: user.id,
    redirect_uri,
    code_challenge,
    access_token,
    refresh_token: typeof refresh_token === 'string' ? refresh_token : '',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    used: false,
  })

  if (insertError) {
    console.error('[mcp/oauth/callback] insert error:', insertError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao gerar código de autorização.' },
      { status: 500 }
    )
  }

  const redirectUrl = `${redirect_uri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`

  return NextResponse.json({ redirect_url: redirectUrl })
}
