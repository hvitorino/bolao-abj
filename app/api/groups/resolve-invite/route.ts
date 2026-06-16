import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

/**
 * Rota pública (sem autenticação): resolve um invite_token para os dados
 * básicos do grupo, usada pela página /convite/[token] antes do login.
 * Usa service_role porque um usuário ainda não-membro precisa ver o nome
 * do grupo antes de decidir entrar — RLS de `groups` bloquearia isso.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'invalid_params', message: 'token é obrigatório.' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('groups')
    .select('id, name')
    .eq('invite_token', token)
    .maybeSingle()

  if (error) {
    console.error('[api/groups/resolve-invite] lookup error:', error)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar convite.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'not_found', message: 'Convite inválido.' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, name: data.name })
}
