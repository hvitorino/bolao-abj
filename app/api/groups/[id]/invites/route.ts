import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const VALID_STATUSES = ['pending', 'accepted', 'declined'] as const
type InviteStatus = (typeof VALID_STATUSES)[number]

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

async function requireGroupAdmin(db: ReturnType<typeof serviceClient>, groupId: string, userId: string) {
  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle()

  if (groupError) {
    return { error: NextResponse.json({ error: 'server_error', message: 'Erro ao buscar grupo.' }, { status: 500 }) }
  }

  if (!group) {
    return { error: NextResponse.json({ error: 'not_found', message: 'Grupo não encontrado.' }, { status: 404 }) }
  }

  const { data: membership, error: membershipError } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    return { error: NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 }) }
  }

  if (!membership || membership.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden', message: 'Apenas o admin do grupo pode gerenciar convites.' }, { status: 403 }) }
  }

  return { error: null }
}

export async function POST(
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

  let body: { invited_user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_params', message: 'Body inválido.' }, { status: 422 })
  }

  const invitedUserId = body.invited_user_id
  if (typeof invitedUserId !== 'string' || !isValidUUID(invitedUserId)) {
    return NextResponse.json({ error: 'invalid_params', message: 'invited_user_id é obrigatório e deve ser um UUID válido.' }, { status: 422 })
  }

  const db = serviceClient()

  const adminCheck = await requireGroupAdmin(db, groupId, user.id)
  if (adminCheck.error) return adminCheck.error

  const { data: invitedProfile, error: profileError } = await db
    .from('profiles')
    .select('id, name')
    .eq('id', invitedUserId)
    .maybeSingle()

  if (profileError) {
    console.error('[api/groups/[id]/invites] POST profile lookup error:', profileError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar usuário.' }, { status: 500 })
  }

  if (!invitedProfile) {
    return NextResponse.json({ error: 'user_not_found', message: 'Usuário não encontrado.' }, { status: 404 })
  }

  const { data: existingMembership, error: membershipError } = await db
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', invitedUserId)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/groups/[id]/invites] POST membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (existingMembership) {
    return NextResponse.json({ status: 'already_member', message: 'Este usuário já participa do grupo.' })
  }

  const findPendingInvite = async () => {
    return db
      .from('group_invites')
      .select('id, group_id, invited_user_id, invited_by, status, created_at')
      .eq('group_id', groupId)
      .eq('invited_user_id', invitedUserId)
      .eq('status', 'pending')
      .maybeSingle()
  }

  const { data: pendingInvite, error: pendingError } = await findPendingInvite()

  if (pendingError) {
    console.error('[api/groups/[id]/invites] POST pending lookup error:', pendingError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar convites pendentes.' }, { status: 500 })
  }

  if (pendingInvite) {
    return NextResponse.json({
      status: 'already_pending',
      message: 'Convite já enviado e ainda pendente.',
      invite: {
        id: pendingInvite.id,
        group_id: pendingInvite.group_id,
        invited_user_id: pendingInvite.invited_user_id,
        invited_user_name: invitedProfile.name,
        invited_by: pendingInvite.invited_by,
        status: pendingInvite.status,
        created_at: pendingInvite.created_at,
      },
    })
  }

  const { data: newInvite, error: insertError } = await db
    .from('group_invites')
    .insert({ group_id: groupId, invited_user_id: invitedUserId, invited_by: user.id, status: 'pending' })
    .select('id, group_id, invited_user_id, invited_by, status, created_at')
    .single()

  if (insertError) {
    // Corrida de condição: o índice único parcial group_invites_unique_pending
    // pode ter rejeitado uma inserção concorrente entre a checagem acima e
    // este INSERT. Tratamos como already_pending em vez de expor um 500.
    if (insertError.code === '23505') {
      const { data: raceInvite, error: raceError } = await findPendingInvite()
      if (!raceError && raceInvite) {
        return NextResponse.json({
          status: 'already_pending',
          message: 'Convite já enviado e ainda pendente.',
          invite: {
            id: raceInvite.id,
            group_id: raceInvite.group_id,
            invited_user_id: raceInvite.invited_user_id,
            invited_user_name: invitedProfile.name,
            invited_by: raceInvite.invited_by,
            status: raceInvite.status,
            created_at: raceInvite.created_at,
          },
        })
      }
    }
    console.error('[api/groups/[id]/invites] POST insert error:', insertError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao criar convite.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      status: 'created',
      invite: {
        id: newInvite.id,
        group_id: newInvite.group_id,
        invited_user_id: newInvite.invited_user_id,
        invited_user_name: invitedProfile.name,
        invited_by: newInvite.invited_by,
        status: newInvite.status,
        created_at: newInvite.created_at,
      },
    },
    { status: 201 }
  )
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

  const db = serviceClient()

  const adminCheck = await requireGroupAdmin(db, groupId, user.id)
  if (adminCheck.error) return adminCheck.error

  const statusParam = request.nextUrl.searchParams.get('status')
  let statusFilter: InviteStatus | null = null
  if (statusParam) {
    if (!VALID_STATUSES.includes(statusParam as InviteStatus)) {
      return NextResponse.json({ error: 'invalid_params', message: 'status deve ser pending, accepted ou declined.' }, { status: 422 })
    }
    statusFilter = statusParam as InviteStatus
  }

  let query = db
    .from('group_invites')
    .select('id, invited_user_id, status, created_at, responded_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[api/groups/[id]/invites] GET error:', error)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convites.' }, { status: 500 })
  }

  type Row = {
    id: string
    invited_user_id: string
    status: InviteStatus
    created_at: string
    responded_at: string | null
  }

  const rows = (data ?? []) as Row[]

  const invitedUserIds = [...new Set(rows.map((row) => row.invited_user_id))]
  const nameById = new Map<string, string>()

  if (invitedUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await db
      .from('profiles')
      .select('id, name')
      .in('id', invitedUserIds)

    if (profilesError) {
      console.error('[api/groups/[id]/invites] GET profiles lookup error:', profilesError)
      return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convites.' }, { status: 500 })
    }

    for (const profile of profilesData ?? []) {
      nameById.set(profile.id, profile.name)
    }
  }

  const invites = rows.map((row) => ({
    id: row.id,
    invited_user_id: row.invited_user_id,
    invited_user_name: nameById.get(row.invited_user_id) ?? '—',
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
  }))

  return NextResponse.json(invites)
}
