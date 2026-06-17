import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
  return { user, jwt }
}

/**
 * GET /api/participants-predictions
 *
 * Retorna os palpites de todos os participantes do grupo para um jogo específico.
 * A RLS em `predictions` controla a visibilidade: para jogos `live` ou `finished`,
 * a policy permite leitura de palpites de terceiros; para jogos `pending`, retorna
 * apenas o palpite do próprio usuário (home_score/away_score null para terceiros).
 *
 * Query params:
 *   game_id  — UUID do jogo (obrigatório)
 *   group_id — UUID do grupo ativo (obrigatório)
 *
 * Resposta (200):
 *   Array de { user_id, game_id, home_score, away_score }
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Autenticação requerida.' },
      { status: 401 }
    )
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

  // Usar o cliente com o JWT do usuário autenticado para que a RLS se aplique.
  // Quando o jogo é `live` ou `finished`, a policy de RLS permite ler palpites de terceiros.
  // Quando o jogo ainda é `pending`, a RLS retorna home_score/away_score como null para
  // terceiros — o componente trata null como ausência de palpite (sem vazamento).
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${auth.jwt}` },
    },
  })

  const { data, error } = await userClient
    .from('predictions')
    .select('user_id, game_id, home_score, away_score')
    .eq('game_id', gameId)
    .eq('group_id', groupId)

  if (error) {
    console.error('[api/participants-predictions] GET error:', error)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar palpites.' },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
