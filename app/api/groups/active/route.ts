import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'
const ACTIVE_GROUP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 ano

function serviceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const jwt = authHeader.slice(7)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await anonClient.auth.getUser(jwt)
  if (error || !user) return null
  return user
}

/**
 * POST /api/groups/active
 *
 * Define o "grupo ativo" persistente do usuário, gravando o cookie
 * `bolao_active_group`. Este é o **único** endpoint que altera esse cookie —
 * chamado exclusivamente pelo componente client-side `AtivarGrupoButton`,
 * presente em `/grupos` e `/grupos/[id]`. Nenhuma outra superfície do
 * produto deve chamá-lo (ver spec `grupo-ativo-persistente`, regra de
 * negócio 1: "a seleção só muda na área de Grupos").
 */
export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  let body: { group_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_params', message: 'Body inválido.' }, { status: 422 })
  }

  const groupId = body.group_id
  if (typeof groupId !== 'string' || !isValidUUID(groupId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'group_id é obrigatório e deve ser um UUID válido.' },
      { status: 422 }
    )
  }

  const db = serviceClient()

  const { data: membership, error: membershipError } = await db
    .from('group_members')
    .select('id, groups(name)')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/groups/active] POST membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  const groupData = membership.groups as { name: string } | { name: string }[] | null
  const groupName = Array.isArray(groupData) ? groupData[0]?.name : groupData?.name

  const response = NextResponse.json({ group_id: groupId, group_name: groupName ?? '' })

  response.cookies.set(ACTIVE_GROUP_COOKIE, groupId, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ACTIVE_GROUP_COOKIE_MAX_AGE,
  })

  return response
}
