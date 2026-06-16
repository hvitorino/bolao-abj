import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  let body: { invite_token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_params', message: 'Body inválido.' }, { status: 422 })
  }

  const inviteToken = body.invite_token
  if (typeof inviteToken !== 'string' || !inviteToken) {
    return NextResponse.json({ error: 'invalid_params', message: 'invite_token é obrigatório.' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id, name')
    .eq('invite_token', inviteToken)
    .maybeSingle()

  if (groupError) {
    console.error('[api/groups/join] group lookup error:', groupError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convite.' }, { status: 500 })
  }

  if (!group) {
    return NextResponse.json({ error: 'not_found', message: 'Convite inválido.' }, { status: 404 })
  }

  const { data: existingMembership, error: membershipError } = await db
    .from('group_members')
    .select('id, role')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/groups/join] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (existingMembership) {
    return NextResponse.json({
      group_id: group.id,
      name: group.name,
      role: existingMembership.role,
      already_member: true,
    })
  }

  const { error: insertError } = await db
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'member' })

  if (insertError) {
    console.error('[api/groups/join] insert membership error:', insertError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao entrar no grupo.' }, { status: 500 })
  }

  return NextResponse.json(
    { group_id: group.id, name: group.name, role: 'member', already_member: false },
    { status: 201 }
  )
}
