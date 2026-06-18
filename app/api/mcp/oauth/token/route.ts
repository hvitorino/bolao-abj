import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

function base64urlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest()
  const computed = base64urlEncode(hash)
  return computed === codeChallenge
}

async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    return Object.fromEntries(new URLSearchParams(text))
  }

  if (contentType.includes('application/json')) {
    const json = await request.json()
    return json as Record<string, string>
  }

  // Tentar como form-urlencoded por padrão
  const text = await request.text()
  return Object.fromEntries(new URLSearchParams(text))
}

export async function POST(request: NextRequest) {
  let params: Record<string, string>
  try {
    params = await parseBody(request)
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Body inválido.' },
      { status: 400 }
    )
  }

  const { grant_type, code, redirect_uri, code_verifier } = params

  // Validar grant_type
  if (grant_type !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type', message: 'grant_type deve ser authorization_code.' },
      { status: 400 }
    )
  }

  if (!code || !redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Parâmetros obrigatórios ausentes: code, redirect_uri.' },
      { status: 400 }
    )
  }

  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  // Buscar o código na tabela
  const { data: oauthCode, error: fetchError } = await db
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (fetchError || !oauthCode) {
    return NextResponse.json(
      { error: 'invalid_grant', message: 'Código de autorização inválido.' },
      { status: 400 }
    )
  }

  // Verificar se já foi usado
  if (oauthCode.used) {
    return NextResponse.json(
      { error: 'invalid_grant', message: 'Código de autorização já utilizado.' },
      { status: 400 }
    )
  }

  // Verificar expiração
  if (new Date() > new Date(oauthCode.expires_at)) {
    return NextResponse.json(
      { error: 'invalid_grant', message: 'Código de autorização expirado.' },
      { status: 400 }
    )
  }

  // Verificar redirect_uri
  if (oauthCode.redirect_uri !== redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_grant', message: 'redirect_uri não confere.' },
      { status: 400 }
    )
  }

  // Verificar PKCE se code_verifier foi fornecido
  if (code_verifier) {
    if (!verifyPkce(code_verifier, oauthCode.code_challenge)) {
      return NextResponse.json(
        { error: 'invalid_grant', message: 'PKCE inválido — code_verifier não confere.' },
        { status: 400 }
      )
    }
  }

  // Marcar o código como usado (atomicamente)
  const { error: updateError } = await db
    .from('mcp_oauth_codes')
    .update({ used: true })
    .eq('code', code)
    .eq('used', false)

  if (updateError) {
    console.error('[mcp/oauth/token] update error:', updateError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao processar token.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    access_token: oauthCode.access_token,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: oauthCode.refresh_token || undefined,
  })
}
