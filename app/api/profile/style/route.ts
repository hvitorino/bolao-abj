import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeParticipantProfile } from '@/lib/participant-profile'
import type { GameLite, PredLite } from '@/lib/participant-profile'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
 * GET /api/profile/style
 *
 * Calcula em tempo real o "Perfil Público do Participante" (feature
 * `perfil-participante`): os 4 eixos de comportamento + arquétipo, sobre os
 * palpites do grupo em jogos `live`/`finished`.
 *
 * Query params:
 *   group_id — UUID do grupo ativo (obrigatório)
 *   user_id  — UUID do participante alvo (obrigatório)
 *
 * Regras de visibilidade:
 *   - Requisitante deve ser membro de `group_id`.
 *   - Alvo (`user_id`) deve ser membro de `group_id`.
 *   - Jogos `pending` NUNCA entram no cálculo — nem os do alvo, nem os de
 *     terceiros usados para o consenso do grupo.
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
  const groupId = searchParams.get('group_id')
  const targetUserId = searchParams.get('user_id')

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'group_id é obrigatório e deve ser um UUID válido.' },
      { status: 400 }
    )
  }

  if (!targetUserId || !isValidUUID(targetUserId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'user_id é obrigatório e deve ser um UUID válido.' },
      { status: 400 }
    )
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  // --- Verificar membership do requisitante ---
  const { data: requesterMembership, error: requesterMembershipError } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (requesterMembershipError) {
    console.error('[api/profile/style] requester membership error:', requesterMembershipError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar participação.' },
      { status: 500 }
    )
  }

  if (!requesterMembership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  // --- Verificar membership do alvo ---
  const { data: targetMembership, error: targetMembershipError } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (targetMembershipError) {
    console.error('[api/profile/style] target membership error:', targetMembershipError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar participação do alvo.' },
      { status: 500 }
    )
  }

  if (!targetMembership) {
    return NextResponse.json(
      { error: 'not_found', message: 'Participante não encontrado neste grupo.' },
      { status: 404 }
    )
  }

  // Usar o cliente com o JWT do requisitante para que a RLS de `predictions`
  // se aplique (nunca vaza palpites de jogos `pending` de terceiros — a
  // policy `predictions_select_group_scoped` só libera linhas de outros
  // usuários quando o jogo já saiu de `pending`).
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${auth.jwt}` },
    },
  })

  const [gamesResult, predictionsResult] = await Promise.all([
    serviceClient
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .in('status', ['live', 'finished']),
    userClient
      .from('predictions')
      .select('user_id, game_id, home_score, away_score')
      .eq('group_id', groupId),
  ])

  if (gamesResult.error) {
    console.error('[api/profile/style] games error:', gamesResult.error)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar jogos.' },
      { status: 500 }
    )
  }

  if (predictionsResult.error) {
    console.error('[api/profile/style] predictions error:', predictionsResult.error)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar palpites.' },
      { status: 500 }
    )
  }

  const games: GameLite[] = (gamesResult.data ?? []) as GameLite[]
  const liveOrFinishedIds = new Set(games.map((g) => g.id))

  // Defesa em profundidade: mesmo que a RLS já restrinja a leitura, filtramos
  // explicitamente para jogos `live`/`finished` — nunca confiar apenas na
  // policy para o contrato deste módulo (ex.: o próprio requisitante sempre
  // pode ler seus próprios palpites `pending` via RLS, o que vazaria a
  // amostra se não filtrássemos aqui).
  const groupPredictions: PredLite[] = (predictionsResult.data ?? []).filter((p) =>
    liveOrFinishedIds.has(p.game_id)
  ) as PredLite[]

  const targetPredictions = groupPredictions.filter((p) => p.user_id === targetUserId)

  const profile = computeParticipantProfile({
    targetUserId,
    games,
    targetPredictions,
    groupPredictions,
  })

  return NextResponse.json(profile)
}
