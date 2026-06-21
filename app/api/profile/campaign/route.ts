import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export async function GET(request: NextRequest) {
  // --- Autenticação via Bearer JWT ---
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Autenticação requerida.' }, { status: 401 })
  }

  const jwt = authHeader.slice(7)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(jwt)

  if (authError || !user) {
    return NextResponse.json({ error: 'Autenticação requerida.' }, { status: 401 })
  }

  // --- Resolver group_id ---
  const searchParams = new URL(request.url).searchParams
  const groupId = searchParams.get('group_id')

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json({ error: 'group_id inválido.' }, { status: 400 })
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  // --- Verificar membership ---
  const { data: membership, error: membershipError } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/profile/campaign] membership error:', membershipError)
    return NextResponse.json({ error: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ error: 'Você não participa deste grupo.' }, { status: 403 })
  }

  // --- Buscar ranking atual ---
  const { data: rankingData, error: rankingError } = await serviceClient.rpc('get_ranking', {
    p_group_id: groupId,
  })

  if (rankingError) {
    console.error('[api/profile/campaign] get_ranking error:', rankingError)
    return NextResponse.json({ error: 'Erro ao buscar ranking.' }, { status: 500 })
  }

  const ranking = rankingData ?? []
  const participantCount = ranking.length

  // Encontrar posição atual do usuário
  const userRow = ranking.find((r: { user_id: string }) => r.user_id === user.id)
  if (!userRow) {
    // Usuário sem palpites ainda — posição não definida
    return NextResponse.json({
      rank_position: null,
      total_points: 0,
      participant_count: participantCount,
      leader_points: null,
      next_above_points: null,
      position_delta: null,
      position_delta_label: 'sem palpites ainda',
      is_leader: false,
    })
  }

  const currentPosition = Number(userRow.rank_position)
  const totalPoints = Number(userRow.total_points)
  const isLeader = currentPosition === 1

  // Líder e próximo acima
  const leaderRow = ranking.find(
    (r: { rank_position: number }) => Number(r.rank_position) === 1
  )
  const leaderPoints = leaderRow ? Number(leaderRow.total_points) : null

  let nextAbovePoints: number | null = null
  if (isLeader) {
    // Para o líder, "próximo" é o 2º colocado
    const secondRow = ranking.find(
      (r: { rank_position: number }) => Number(r.rank_position) === 2
    )
    nextAbovePoints = secondRow ? Number(secondRow.total_points) : null
  } else {
    const above = ranking.find(
      (r: { rank_position: number }) => Number(r.rank_position) === currentPosition - 1
    )
    nextAbovePoints = above ? Number(above.total_points) : null
  }

  // --- Buscar snapshot mais recente ---
  const { data: snapshotData } = await serviceClient
    .from('position_snapshots')
    .select('rank_position')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .order('match_day', { ascending: false })
    .limit(1)
    .maybeSingle()

  let positionDelta: number | null = null
  let positionDeltaLabel: string

  if (!snapshotData) {
    positionDeltaLabel = 'sem rodadas encerradas'
  } else {
    const prevPosition = Number(snapshotData.rank_position)
    positionDelta = prevPosition - currentPosition // positivo = subiu
    if (positionDelta > 0) {
      positionDeltaLabel = `▲${positionDelta} desde a última rodada`
    } else if (positionDelta < 0) {
      positionDeltaLabel = `▼${Math.abs(positionDelta)} desde a última rodada`
    } else {
      positionDeltaLabel = '= mesma posição'
    }
  }

  return NextResponse.json({
    rank_position: currentPosition,
    total_points: totalPoints,
    participant_count: participantCount,
    leader_points: isLeader ? null : leaderPoints,
    next_above_points: nextAbovePoints,
    position_delta: positionDelta,
    position_delta_label: positionDeltaLabel,
    is_leader: isLeader,
  })
}
