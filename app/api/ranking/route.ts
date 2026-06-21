import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_POINTS_PER_GAME = 9

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function calcAproveitamento(totalPoints: number, gamesPredicted: number): number {
  if (!gamesPredicted) return 0
  return Math.round((totalPoints / (gamesPredicted * MAX_POINTS_PER_GAME)) * 100)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Autenticação requerida.' }, { status: 401 })
  }

  const jwt = authHeader.slice(7)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await anonClient.auth.getUser(jwt)
  if (authError || !user) {
    return NextResponse.json({ error: 'Autenticação requerida.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const groupId = searchParams.get('group_id')
  const round = searchParams.get('round') ?? undefined

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json(
      { error: 'invalid_params', message: 'group_id é obrigatório e deve ser um UUID válido.' },
      { status: 400 }
    )
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const { data: membership, error: membershipError } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/ranking] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'Erro ao verificar participação no grupo.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  // --- Modo por rodada: sem scouts, sem predictions_count, sem streak ---
  if (round && round !== 'GERAL') {
    const { data: rankingByRoundData, error: rankingByRoundError } = await serviceClient.rpc(
      'get_ranking_by_round',
      { p_group_id: groupId, p_round: round }
    )

    if (rankingByRoundError) {
      console.error('[api/ranking] RPC get_ranking_by_round error:', rankingByRoundError)
      return NextResponse.json({ error: 'Erro ao buscar ranking por rodada.' }, { status: 500 })
    }

    const rankingByRound = (rankingByRoundData ?? []).map((entry: {
      rank_position: number
      user_id: string
      participant_name: string
      total_points: number
      games_predicted: number
    }) => ({
      rank_position: entry.rank_position,
      user_id: entry.user_id,
      participant_name: entry.participant_name,
      total_points: Number(entry.total_points),
      games_predicted: Number(entry.games_predicted),
      aproveitamento: calcAproveitamento(Number(entry.total_points), Number(entry.games_predicted)),
      predictions_count: 0,
      scouts: [] as string[],
      streak: 0,
    }))

    return NextResponse.json(rankingByRound)
  }

  // --- Modo geral: comportamento original + streak ---
  const [rankingResult, scoutsResult, streakResult] = await Promise.all([
    serviceClient.rpc('get_ranking', { p_group_id: groupId }),
    serviceClient.rpc('get_ranking_scouts', { p_group_id: groupId }),
    serviceClient.rpc('get_streak_for_group', { p_group_id: groupId }),
  ])

  if (rankingResult.error) {
    console.error('[api/ranking] RPC get_ranking error:', rankingResult.error)
    return NextResponse.json({ error: 'Erro ao buscar ranking.' }, { status: 500 })
  }

  if (scoutsResult.error) {
    console.error('[api/ranking] RPC get_ranking_scouts error:', scoutsResult.error)
    return NextResponse.json({ error: 'Erro ao buscar scouts.' }, { status: 500 })
  }

  if (streakResult.error) {
    // Não bloqueia a resposta — streak vem como 0 para todos em caso de erro
    console.error('[api/ranking] RPC get_streak_for_group error:', streakResult.error)
  }

  // --- Calcular badges de scout ---
  type ScoutRow = {
    user_id: string
    exact_count: number
    winner_count: number
    miss_count: number
    pred_active: number
    pred_total: number
  }

  const scoutsData: ScoutRow[] = (scoutsResult.data ?? []).map((r: ScoutRow) => ({
    user_id: r.user_id,
    exact_count: Number(r.exact_count),
    winner_count: Number(r.winner_count),
    miss_count: Number(r.miss_count),
    pred_active: Number(r.pred_active),
    pred_total: Number(r.pred_total),
  }))

  // Participantes com ao menos 1 palpite total (wally excluído)
  const nonWally = scoutsData.filter(r => r.pred_total >= 1)

  const maxExact  = scoutsData.length ? Math.max(...scoutsData.map(r => r.exact_count))  : 0
  const maxWinner = scoutsData.length ? Math.max(...scoutsData.map(r => r.winner_count)) : 0
  const maxMiss   = scoutsData.length ? Math.max(...scoutsData.map(r => r.miss_count))   : 0

  // min_active só considera participantes com pred_total >= 1
  const activeValues = nonWally.map(r => r.pred_active)
  const minActive = activeValues.length ? Math.min(...activeValues) : 0

  const scoutsByUser: Record<string, string[]> = {}
  for (const row of scoutsData) {
    const badges: string[] = []

    if (row.pred_total === 0) {
      badges.push('onde_esta_wally')
    } else {
      // sumido: mínimo de palpites ativos > 0 (se min=0, ninguém é "sumido" ainda)
      if (minActive > 0 && row.pred_active === minActive) {
        badges.push('sumido')
      }
      if (maxExact > 0 && row.exact_count === maxExact) {
        badges.push('mae_dina')
      }
      if (maxWinner > 0 && row.winner_count === maxWinner) {
        badges.push('manja_muito')
      }
      if (maxMiss > 0 && row.miss_count === maxMiss) {
        badges.push('cego_em_tiroteio')
      }
    }

    scoutsByUser[row.user_id] = badges
  }

  // --- Mapear streaks por user_id ---
  const streakByUser: Record<string, number> = {}
  for (const row of (streakResult.data ?? [])) {
    streakByUser[row.user_id] = Number(row.streak)
  }

  // --- Montar resposta ---
  const ranking = (rankingResult.data ?? []).map((entry: {
    rank_position: number
    user_id: string
    participant_name: string
    total_points: number
    games_predicted: number
    predictions_count: number
  }) => ({
    rank_position: entry.rank_position,
    user_id: entry.user_id,
    participant_name: entry.participant_name,
    total_points: Number(entry.total_points),
    games_predicted: Number(entry.games_predicted),
    aproveitamento: calcAproveitamento(Number(entry.total_points), Number(entry.games_predicted)),
    predictions_count: Number(entry.predictions_count),
    scouts: scoutsByUser[entry.user_id] ?? [],
    streak: streakByUser[entry.user_id] ?? 0,
  }))

  return NextResponse.json(ranking)
}
