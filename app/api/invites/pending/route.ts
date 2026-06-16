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

export async function GET(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  const db = serviceClient()

  const { data, error } = await db
    .from('group_invites')
    .select('id, group_id, invited_by, created_at')
    .eq('invited_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/invites/pending] GET error:', error)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convites pendentes.' }, { status: 500 })
  }

  type Row = { id: string; group_id: string; invited_by: string; created_at: string }
  const rows = (data ?? []) as Row[]

  if (rows.length === 0) {
    return NextResponse.json([])
  }

  const groupIds = [...new Set(rows.map((row) => row.group_id))]
  const inviterIds = [...new Set(rows.map((row) => row.invited_by))]

  const [{ data: groupsData, error: groupsError }, { data: profilesData, error: profilesError }] = await Promise.all([
    db.from('groups').select('id, name').in('id', groupIds),
    db.from('profiles').select('id, name').in('id', inviterIds),
  ])

  if (groupsError || profilesError) {
    console.error('[api/invites/pending] GET lookup error:', groupsError ?? profilesError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convites pendentes.' }, { status: 500 })
  }

  const groupNameById = new Map((groupsData ?? []).map((g) => [g.id, g.name] as const))
  const inviterNameById = new Map((profilesData ?? []).map((p) => [p.id, p.name] as const))

  const invites = rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    group_name: groupNameById.get(row.group_id) ?? '—',
    invited_by: row.invited_by,
    invited_by_name: inviterNameById.get(row.invited_by) ?? '—',
    created_at: row.created_at,
  }))

  return NextResponse.json(invites)
}
