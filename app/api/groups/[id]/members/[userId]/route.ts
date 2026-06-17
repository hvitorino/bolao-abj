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
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(jwt)
  if (error || !user) return null
  return user
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  // Nota de segurança: todo o delete é feito via serviceClient (service_role),
  // que ignora RLS por design no Supabase. A verificação de admin e de não
  // auto-remoção é feita explicitamente aqui no Route Handler (defesa primária).
  // Nenhuma policy permissiva de DELETE para 'authenticated' foi adicionada em 'group_members'.
  const caller = await authenticate(request)
  if (!caller) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Autenticação requerida.' },
      { status: 401 }
    )
  }

  const { id, userId } = await params

  if (!id || !isValidUUID(id) || !userId || !isValidUUID(userId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'ID ou userId inválido.' },
      { status: 400 }
    )
  }

  const db = serviceClient()

  // Verificar se o grupo existe
  const { data: group, error: groupError } = await db
    .from('groups')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (groupError) {
    console.error('[api/groups/[id]/members/[userId] DELETE] group lookup error:', groupError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar grupo.' },
      { status: 500 }
    )
  }

  if (!group) {
    return NextResponse.json(
      { error: 'not_found', message: 'Grupo não encontrado.' },
      { status: 404 }
    )
  }

  // Verificar membership e role do chamador
  const { data: callerMembership, error: callerMembershipError } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', caller.id)
    .maybeSingle()

  if (callerMembershipError) {
    console.error(
      '[api/groups/[id]/members/[userId] DELETE] caller membership lookup error:',
      callerMembershipError
    )
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar participação.' },
      { status: 500 }
    )
  }

  if (!callerMembership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  if (callerMembership.role !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Apenas o admin pode remover participantes.' },
      { status: 403 }
    )
  }

  // Impedir auto-remoção
  if (caller.id === userId) {
    return NextResponse.json(
      { error: 'forbidden', message: 'O admin não pode remover a si mesmo.' },
      { status: 403 }
    )
  }

  // Verificar que o alvo é membro do grupo
  const { data: targetMembership, error: targetMembershipError } = await db
    .from('group_members')
    .select('id')
    .eq('group_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (targetMembershipError) {
    console.error(
      '[api/groups/[id]/members/[userId] DELETE] target membership lookup error:',
      targetMembershipError
    )
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar membro alvo.' },
      { status: 500 }
    )
  }

  if (!targetMembership) {
    return NextResponse.json(
      { error: 'unprocessable', message: 'Participante não encontrado neste grupo.' },
      { status: 422 }
    )
  }

  // Executar a deleção — palpites e scores do membro permanecem como registro histórico
  const { error: deleteError } = await db
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', userId)

  if (deleteError) {
    console.error(
      '[api/groups/[id]/members/[userId] DELETE] delete error:',
      deleteError
    )
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao remover participante.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ removed: true, group_id: id, user_id: userId })
}
