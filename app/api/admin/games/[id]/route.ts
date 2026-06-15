import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminSecret = process.env.ADMIN_SECRET!

const VALID_STATUSES = ['pending', 'live', 'finished']

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function serviceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const provided = request.headers.get('x-admin-secret')
  if (!adminSecret || !provided || provided !== adminSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const { id } = await params
  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: 'ID de jogo inválido.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {}

  if ('home_score' in body) {
    if (!Number.isInteger(body.home_score) || (body.home_score as number) < 0)
      return NextResponse.json({ error: 'home_score deve ser inteiro não negativo.' }, { status: 422 })
    updates.home_score = body.home_score
  }

  if ('away_score' in body) {
    if (!Number.isInteger(body.away_score) || (body.away_score as number) < 0)
      return NextResponse.json({ error: 'away_score deve ser inteiro não negativo.' }, { status: 422 })
    updates.away_score = body.away_score
  }

  if ('status' in body) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status))
      return NextResponse.json({ error: `status inválido. Aceitos: ${VALID_STATUSES.join(', ')}.` }, { status: 422 })
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido fornecido.' }, { status: 422 })
  }

  const db = serviceClient()

  const { data: existing } = await db.from('games').select('id').eq('id', id).maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })
  }

  const { data, error } = await db.from('games').update(updates).eq('id', id).select().single()

  if (error) {
    console.error('[api/admin/games] update error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar jogo.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
