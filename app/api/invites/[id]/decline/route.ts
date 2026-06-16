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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  const { id: inviteId } = await params
  if (!inviteId || !isValidUUID(inviteId)) {
    return NextResponse.json({ error: 'invalid_params', message: 'ID de convite inválido.' }, { status: 422 })
  }

  const db = serviceClient()

  const { data: invite, error: inviteError } = await db
    .from('group_invites')
    .select('id, invited_user_id, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (inviteError) {
    console.error('[api/invites/[id]/decline] invite lookup error:', inviteError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convite.' }, { status: 500 })
  }

  if (!invite) {
    return NextResponse.json({ error: 'not_found', message: 'Convite não encontrado.' }, { status: 404 })
  }

  if (invite.invited_user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden', message: 'Este convite não é seu.' }, { status: 403 })
  }

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'already_responded', message: 'Este convite já foi respondido.' }, { status: 409 })
  }

  const { error: updateError } = await db
    .from('group_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    console.error('[api/invites/[id]/decline] update error:', updateError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao recusar convite.' }, { status: 500 })
  }

  return NextResponse.json({ status: 'declined' })
}
