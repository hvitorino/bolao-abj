/**
 * lib/bolaofutebol.ts
 *
 * Utilitário server-side para proxy das APIs do bolaodefutebol.com.
 * Obtém o JWT do Supabase (integration_tokens) e faz chamadas autenticadas.
 * Nunca expor o JWT para o cliente — sempre usar via Route Handlers.
 */

const BDF_BASE = 'https://bolaodefutebol.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const SUPABASE_HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

let cachedJwt: string | null = null
let cachedJwtAt = 0
const JWT_CACHE_TTL_MS = 60_000 // 1 minuto

function jwtExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}

async function refreshBdfTokens(refreshToken: string): Promise<string> {
  const res = await fetch('https://bolaodefutebol.com/auth/session/refresh', {
    method: 'POST',
    headers: {
      rid: 'session',
      'fdi-version': '4.1',
      'st-auth-mode': 'header',
      authorization: `Bearer ${refreshToken}`,
      'Content-Length': '0',
    },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`BDF refresh falhou: ${res.status}`)

  const newAccess = res.headers.get('st-access-token')
  const newRefresh = res.headers.get('st-refresh-token')
  if (!newAccess || !newRefresh) throw new Error('Tokens ausentes na resposta do refresh')

  await fetch(
    `${SUPABASE_URL}/rest/v1/integration_tokens?id=eq.bolaodefutebol`,
    {
      method: 'PATCH',
      headers: { ...SUPABASE_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: newAccess,
        refresh_token: newRefresh,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    }
  )

  // Invalidar cache local para que a próxima chamada leia o token novo
  cachedJwt = null
  cachedJwtAt = 0

  return newAccess
}

/**
 * Obtém o JWT do bolaodefutebol.com via Supabase integration_tokens.
 * Cache de 1 minuto em memória. Renova automaticamente via refresh token
 * se o access token expirar em menos de 10 minutos.
 */
export async function getBdfJwt(): Promise<string> {
  const now = Date.now()
  if (cachedJwt && now - cachedJwtAt < JWT_CACHE_TTL_MS) {
    return cachedJwt
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/integration_tokens?id=eq.bolaodefutebol&select=token,refresh_token`,
    { headers: SUPABASE_HEADERS, cache: 'no-store' }
  )

  if (!res.ok) {
    throw new Error(`Falha ao obter tokens do bolaodefutebol: ${res.status}`)
  }

  const data = (await res.json()) as { token: string; refresh_token: string | null }[]
  const row = data[0]

  if (!row?.token) {
    throw new Error('Token JWT do bolaodefutebol não encontrado no Supabase')
  }

  const nowSec = Math.floor(now / 1000)
  const exp = jwtExp(row.token)
  const expiresInSec = exp - nowSec

  let token = row.token

  if (expiresInSec < 600 && row.refresh_token) {
    try {
      token = await refreshBdfTokens(row.refresh_token)
    } catch (err) {
      // Se o refresh falhar mas o access token ainda for válido, continua
      if (expiresInSec <= 0) throw err
      console.error('[bdfJwt] refresh falhou, usando token atual:', err)
    }
  }

  cachedJwt = token
  cachedJwtAt = now
  return token
}

/**
 * Faz uma chamada autenticada à API do bolaodefutebol.com.
 */
export async function bdfFetch<T = unknown>(
  path: string,
  options?: { revalidate?: number }
): Promise<T> {
  const jwt = await getBdfJwt()
  const url = path.startsWith('http') ? path : `${BDF_BASE}${path}`

  const fetchOptions: RequestInit = {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'User-Agent': 'bolaoabj/1.0',
    },
    cache: options?.revalidate ? undefined : 'no-store',
  }

  if (options?.revalidate) {
    fetchOptions.next = { revalidate: options.revalidate }
  }

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`BDF API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json() as Promise<T>
}
