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
    .select('id, group_id, invited_user_id, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (inviteError) {
    console.error('[api/invites/[id]/accept] invite lookup error:', inviteError)
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

  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id, name')
    .eq('id', invite.group_id)
    .maybeSingle()

  if (groupError || !group) {
    console.error('[api/invites/[id]/accept] group lookup error:', groupError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar grupo.' }, { status: 500 })
  }

  const { data: existingMembership, error: membershipError } = await db
    .from('group_members')
    .select('id')
    .eq('group_id', invite.group_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/invites/[id]/accept] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!existingMembership) {
    const { error: insertMemberError } = await db
      .from('group_members')
      .insert({ group_id: invite.group_id, user_id: user.id, role: 'member' })

    if (insertMemberError) {
      console.error('[api/invites/[id]/accept] insert membership error:', insertMemberError)
      return NextResponse.json({ error: 'server_error', message: 'Erro ao entrar no grupo.' }, { status: 500 })
    }
  }

  const { error: updateError } = await db
    .from('group_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    // Nota de atomicidade: o usuário já foi adicionado a group_members (ou já
    // era membro) — não há rollback dessa entrada, pois removê-lo seria uma
    // surpresa pior do que um convite com status desatualizado. O erro é
    // logado para reconciliação manual futura, mas a resposta ainda é de erro
    // para o cliente saber que algo não saiu como esperado.
    console.error('[api/invites/[id]/accept] update invite status error:', updateError)
    return NextResponse.json({ error: 'server_error', message: 'Você entrou no grupo, mas houve um erro ao atualizar o status do convite.' }, { status: 500 })
  }

  return NextResponse.json({ group_id: group.id, group_name: group.name, role: 'member' })
}
