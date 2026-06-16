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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  const { id } = await params
  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: 'invalid_params', message: 'ID inválido.' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id, name, invite_token')
    .eq('id', id)
    .maybeSingle()

  if (groupError) {
    console.error('[api/groups/[id]] group lookup error:', groupError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar grupo.' }, { status: 500 })
  }

  if (!group) {
    return NextResponse.json({ error: 'not_found', message: 'Grupo não encontrado.' }, { status: 404 })
  }

  const { data: membership, error: membershipError } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/groups/[id]] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ error: 'forbidden', message: 'Você não participa deste grupo.' }, { status: 403 })
  }

  const { count: memberCount, error: countError } = await db
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', id)

  if (countError) {
    console.error('[api/groups/[id]] member count error:', countError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao contar membros.' }, { status: 500 })
  }

  const isAdmin = membership.role === 'admin'

  return NextResponse.json({
    id: group.id,
    name: group.name,
    role: membership.role,
    member_count: memberCount ?? 0,
    ...(isAdmin ? { invite_token: group.invite_token } : {}),
  })
}
