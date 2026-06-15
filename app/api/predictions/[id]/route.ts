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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Autenticar JWT
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Token inválido ou expirado' },
      { status: 401 }
    )
  }

  const { id } = await params

  // Validar UUID do id
  if (!id || !isValidUUID(id)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'ID inválido.' },
      { status: 400 }
    )
  }

  const db = serviceClient()

  // 2. Buscar palpite existente
  const { data: prediction, error: predictionError } = await db
    .from('predictions')
    .select('id,user_id,game_id,home_score,away_score,submitted_at')
    .eq('id', id)
    .maybeSingle()

  if (predictionError) {
    console.error('[api/predictions/[id]] lookup error:', predictionError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar palpite.' },
      { status: 500 }
    )
  }

  if (!prediction) {
    return NextResponse.json(
      { error: 'not_found', message: 'Palpite não encontrado' },
      { status: 404 }
    )
  }

  // 3. Verificar ownership
  if (prediction.user_id !== user.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não pode editar o palpite de outro participante' },
      { status: 403 }
    )
  }

  // 4. Verificar deadline — buscar o jogo via game_id
  const { data: game, error: gameError } = await db
    .from('games')
    .select('id,match_date,status')
    .eq('id', prediction.game_id)
    .maybeSingle()

  if (gameError) {
    console.error('[api/predictions/[id]] game lookup error:', gameError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar jogo.' },
      { status: 500 }
    )
  }

  if (!game || !game.match_date) {
    return NextResponse.json(
      { error: 'server_error', message: 'Jogo não encontrado ou sem data.' },
      { status: 500 }
    )
  }

  // Jogo live ou finished nunca permite edição, independentemente do deadline calculado
  if (game.status === 'live' || game.status === 'finished') {
    return NextResponse.json(
      {
        error: 'deadline_expired',
        message: 'Prazo encerrado. Não é possível editar o palpite.',
      },
      { status: 422 }
    )
  }

  const deadline = new Date(new Date(game.match_date).getTime() - 5 * 60 * 1000)
  if (new Date() >= deadline) {
    return NextResponse.json(
      {
        error: 'deadline_expired',
        message: 'Prazo encerrado. Não é possível editar o palpite.',
      },
      { status: 422 }
    )
  }

  // 5. Validar body
  let body: { home_score?: unknown; away_score?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_params', message: 'Body inválido.' },
      { status: 422 }
    )
  }

  const { home_score: homeScore, away_score: awayScore } = body

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    (homeScore as number) < 0 ||
    (awayScore as number) < 0
  ) {
    return NextResponse.json(
      {
        error: 'invalid_scores',
        message: 'Placares devem ser números inteiros não negativos',
      },
      { status: 422 }
    )
  }

  // 6. UPDATE no banco
  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('predictions')
    .update({
      home_score: homeScore as number,
      away_score: awayScore as number,
      submitted_at: now,
    })
    .eq('id', id)
    .select('id,user_id,game_id,home_score,away_score,submitted_at')
    .single()

  if (updateError) {
    console.error('[api/predictions/[id]] update error:', updateError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao atualizar palpite.' },
      { status: 500 }
    )
  }

  return NextResponse.json(updated, { status: 200 })
}
