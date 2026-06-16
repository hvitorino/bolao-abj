import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MIN_QUERY_LENGTH = 2

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

  const { id: groupId } = await params
  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json({ error: 'invalid_params', message: 'ID de grupo inválido.' }, { status: 422 })
  }

  const rawQuery = request.nextUrl.searchParams.get('q')
  const q = typeof rawQuery === 'string' ? rawQuery.trim() : ''
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { error: 'invalid_params', message: `q é obrigatório e deve ter no mínimo ${MIN_QUERY_LENGTH} caracteres.` },
      { status: 422 }
    )
  }

  const db = serviceClient()

  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle()

  if (groupError) {
    console.error('[api/groups/[id]/invites/search-users] group lookup error:', groupError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar grupo.' }, { status: 500 })
  }

  if (!group) {
    return NextResponse.json({ error: 'not_found', message: 'Grupo não encontrado.' }, { status: 404 })
  }

  const { data: membership, error: membershipError } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/groups/[id]/invites/search-users] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden', message: 'Apenas o admin do grupo pode buscar usuários para convidar.' }, { status: 403 })
  }

  const { data: results, error: searchError } = await db.rpc('search_users_to_invite', {
    p_query: q,
    p_exclude_group_id: groupId,
  })

  if (searchError) {
    console.error('[api/groups/[id]/invites/search-users] search error:', searchError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar usuários.' }, { status: 500 })
  }

  type SearchRow = { id: string; name: string }
  const rows = (results ?? []) as SearchRow[]

  if (rows.length === 0) {
    return NextResponse.json([])
  }

  const candidateIds = rows.map((row) => row.id)
  const { data: pendingInvites, error: pendingError } = await db
    .from('group_invites')
    .select('invited_user_id')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .in('invited_user_id', candidateIds)

  if (pendingError) {
    console.error('[api/groups/[id]/invites/search-users] pending invites lookup error:', pendingError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar usuários.' }, { status: 500 })
  }

  const pendingIds = new Set((pendingInvites ?? []).map((row) => row.invited_user_id))

  const payload = rows.map((row) => ({
    id: row.id,
    name: row.name,
    already_invited: pendingIds.has(row.id),
  }))

  return NextResponse.json(payload)
}
