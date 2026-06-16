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

export async function GET(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const gameId = searchParams.get('game_id')
  const groupId = searchParams.get('group_id')

  if (!gameId || !isValidUUID(gameId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'game_id é obrigatório e deve ser um UUID válido.' },
      { status: 400 }
    )
  }

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'group_id é obrigatório e deve ser um UUID válido.' },
      { status: 400 }
    )
  }

  const { data, error } = await serviceClient()
    .from('predictions')
    .select('id,game_id,user_id,group_id,home_score,away_score,submitted_at')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (error) {
    console.error('[api/predictions] GET error:', error)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao buscar palpite.' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Autenticação requerida.' }, { status: 401 })
  }

  let body: { game_id?: unknown; group_id?: unknown; home_score?: unknown; away_score?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_params', message: 'Body inválido.' }, { status: 422 })
  }

  const { game_id: gameId, group_id: groupId, home_score: homeScore, away_score: awayScore } = body

  if (typeof gameId !== 'string' || !isValidUUID(gameId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'game_id é obrigatório e deve ser um UUID válido.' },
      { status: 422 }
    )
  }

  if (typeof groupId !== 'string' || !isValidUUID(groupId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'group_id é obrigatório e deve ser um UUID válido.' },
      { status: 422 }
    )
  }

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || (homeScore as number) < 0 || (awayScore as number) < 0) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'home_score e away_score são obrigatórios e devem ser inteiros >= 0.' },
      { status: 422 }
    )
  }

  const db = serviceClient()

  const { data: membership, error: membershipError } = await db
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/predictions] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar participação no grupo.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  const { data: game, error: gameError } = await db
    .from('games')
    .select('id,match_date,status')
    .eq('id', gameId)
    .maybeSingle()

  if (gameError) {
    console.error('[api/predictions] game lookup error:', gameError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao verificar jogo.' }, { status: 500 })
  }
  if (!game) {
    return NextResponse.json({ error: 'not_found', message: 'Jogo não encontrado.' }, { status: 404 })
  }

  if (!game.match_date) {
    return NextResponse.json({ error: 'server_error', message: 'Jogo sem data.' }, { status: 500 })
  }

  const deadline = new Date(new Date(game.match_date).getTime() - 5 * 60 * 1000)
  if (new Date() >= deadline) {
    return NextResponse.json(
      { error: 'deadline_expired', message: 'Prazo encerrado. Não é possível registrar palpite após 5 minutos antes do início.' },
      { status: 422 }
    )
  }

  const { data: existing } = await db
    .from('predictions')
    .select('id')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'already_submitted', message: 'Você já enviou um palpite para este jogo.' },
      { status: 422 }
    )
  }

  const { data: inserted, error: insertError } = await db
    .from('predictions')
    .insert({
      user_id: user.id,
      game_id: gameId,
      group_id: groupId,
      home_score: homeScore as number,
      away_score: awayScore as number,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'already_submitted', message: 'Você já enviou um palpite para este jogo.' },
        { status: 422 }
      )
    }
    console.error('[api/predictions] insert error:', insertError)
    return NextResponse.json({ error: 'server_error', message: 'Erro ao registrar palpite.' }, { status: 500 })
  }

  return NextResponse.json(inserted, { status: 201 })
}
