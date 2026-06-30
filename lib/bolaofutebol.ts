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

/**
 * Obtém o JWT do bolaodefutebol.com via Supabase integration_tokens.
 * Cache de 1 minuto para evitar chamadas excessivas ao Supabase.
 */
export async function getBdfJwt(): Promise<string> {
  const now = Date.now()
  if (cachedJwt && now - cachedJwtAt < JWT_CACHE_TTL_MS) {
    return cachedJwt
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/integration_tokens?id=eq.bolaodefutebol&select=token`,
    { headers: SUPABASE_HEADERS, cache: 'no-store' }
  )

  if (!res.ok) {
    throw new Error(`Falha ao obter JWT do bolaodefutebol: ${res.status}`)
  }

  const data = (await res.json()) as { token: string }[]
  const token = data[0]?.token

  if (!token) {
    throw new Error('Token JWT do bolaodefutebol não encontrado no Supabase')
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
