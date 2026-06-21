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
    console.error('[api/profile/performance] membership error:', membershipError)
    return NextResponse.json({ error: 'Erro ao verificar participação.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ error: 'Você não participa deste grupo.' }, { status: 403 })
  }

  // --- Buscar dados em paralelo ---
  const [statsResult, streakResult, groupAvgResult] = await Promise.all([
    serviceClient.rpc('get_profile_stats', {
      p_group_id: groupId,
      p_user_id: user.id,
    }),
    serviceClient.rpc('get_streak_for_group', { p_group_id: groupId }),
    serviceClient.rpc('get_group_avg_points', { p_group_id: groupId }),
  ])

  if (statsResult.error) {
    console.error('[api/profile/performance] get_profile_stats error:', statsResult.error)
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 })
  }

  const stats = statsResult.data?.[0]
  if (!stats) {
    return NextResponse.json({ error: 'Estatísticas não encontradas.' }, { status: 500 })
  }

  const predictionsMade = Number(stats.predictions_made)
  const activePredictionsMade = Number(stats.active_predictions_made)
  const finishedGames = Number(stats.finished_games)
  const winnerCorrect = Number(stats.winner_correct)
  const exactCorrect = Number(stats.exact_correct)
  const totalPoints = Number(stats.total_points)
  const bestStreak = Number(stats.best_streak)

  const winnerRate = activePredictionsMade > 0 ? winnerCorrect / activePredictionsMade : 0
  const exactRate = activePredictionsMade > 0 ? exactCorrect / activePredictionsMade : 0
  const avgPoints = activePredictionsMade > 0 ? totalPoints / activePredictionsMade : 0

  // Streak atual via get_streak_for_group
  const streakRow = (streakResult.data ?? []).find(
    (row: { user_id: string; streak: number }) => row.user_id === user.id
  )
  const currentStreak = streakRow ? Number(streakRow.streak) : 0

  // Média do grupo
  const groupAvgPoints = groupAvgResult.error
    ? 0
    : Number(groupAvgResult.data ?? 0)

  const avgDelta = parseFloat((avgPoints - groupAvgPoints).toFixed(3))

  return NextResponse.json({
    predictions_made: predictionsMade,
    active_predictions_made: activePredictionsMade,
    finished_games: finishedGames,
    winner_correct: winnerCorrect,
    exact_correct: exactCorrect,
    total_points: totalPoints,
    winner_rate: parseFloat(winnerRate.toFixed(3)),
    exact_rate: parseFloat(exactRate.toFixed(3)),
    avg_points: parseFloat(avgPoints.toFixed(3)),
    group_avg_points: parseFloat(groupAvgPoints.toFixed(2)),
    avg_delta: avgDelta,
    current_streak: currentStreak,
    best_streak: bestStreak,
  })
}
