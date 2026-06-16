import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateInviteToken } from '@/lib/invite-token'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_NAME_LENGTH = 60

function serviceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
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

export async function GET(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('group_members')
    .select('role, groups(id, name, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('[api/groups] GET error:', error)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar grupos.' }, { status: 500 })
  }

  type Row = { role: string; groups: { id: string; name: string; created_at: string } | { id: string; name: string; created_at: string }[] | null }

  const groups = (data ?? []).map((row: Row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return {
      id: g?.id,
      name: g?.name,
      created_at: g?.created_at,
      role: row.role,
    }
  })

  return NextResponse.json(groups)
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  let body: { name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_params', message: 'Body inválido.' }, { status: 422 })
  }

  const rawName = body.name
  const name = typeof rawName === 'string' ? rawName.trim() : ''

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: 'invalid_params', message: `name é obrigatório e deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` },
      { status: 422 }
    )
  }

  const db = serviceClient()

  // Tenta inserir o grupo; em caso de colisão de invite_token (23505), tenta
  // gerar um novo token uma única vez antes de desistir.
  let group: { id: string; name: string; invite_token: string } | null = null
  let lastError: { code?: string; message?: string } | null = null

  for (let attempt = 0; attempt < 2 && !group; attempt++) {
    const inviteToken = generateInviteToken()
    const { data, error } = await db
      .from('groups')
      .insert({ name, invite_token: inviteToken, created_by: user.id })
      .select('id, name, invite_token')
      .single()

    if (!error && data) {
      group = data
      break
    }

    lastError = error
    if (error?.code !== '23505') break
  }

  if (!group) {
    console.error('[api/groups] insert group error:', lastError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao criar grupo.' }, { status: 500 })
  }

  const { error: memberError } = await db
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'admin' })

  if (memberError) {
    // Nota de atomicidade: como o REST do Supabase não oferece transação
    // multi-tabela, se o INSERT em group_members falhar após o grupo já ter
    // sido criado, fazemos rollback manual do grupo para não deixá-lo órfão
    // (sem nenhum admin).
    console.error('[api/groups] insert admin membership error, rolling back group:', memberError)
    await db.from('groups').delete().eq('id', group.id)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao criar grupo.' }, { status: 500 })
  }

  return NextResponse.json(
    { id: group.id, name: group.name, invite_token: group.invite_token, role: 'admin' },
    { status: 201 }
  )
}
