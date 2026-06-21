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
  let groupId = searchParams.get('group_id')

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  if (!groupId || !isValidUUID(groupId)) {
    // Tenta ler o cookie bolao_active_group do header
    const cookieHeader = request.headers.get('cookie') ?? ''
    const cookieMatch = cookieHeader.match(/bolao_active_group=([^;]+)/)
    const cookieGroupId = cookieMatch?.[1]

    if (cookieGroupId && isValidUUID(cookieGroupId)) {
      groupId = cookieGroupId
    } else {
      // Fallback: primeiro grupo do usuário por joined_at ASC
      const { data: firstMembership } = await serviceClient
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!firstMembership) {
        return NextResponse.json(
          { error: 'not_found', message: 'Você não participa de nenhum grupo.' },
          { status: 404 }
        )
      }

      groupId = firstMembership.group_id
    }
  }

  // --- Verificar membership ---
  const { data: membership, error: membershipError } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[api/profile/stats] membership lookup error:', membershipError)
    return NextResponse.json({ error: 'Erro ao verificar participação no grupo.' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Você não participa deste grupo.' },
      { status: 403 }
    )
  }

  // --- Buscar dados em paralelo ---
  const [statsResult, streakResult, profileResult, groupResult] = await Promise.all([
    serviceClient.rpc('get_profile_stats', {
      p_group_id: groupId,
      p_user_id: user.id,
    }),
    serviceClient.rpc('get_streak_for_group', { p_group_id: groupId }),
    serviceClient.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    serviceClient
      .from('group_members')
      .select('groups(name)')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (statsResult.error) {
    console.error('[api/profile/stats] RPC get_profile_stats error:', statsResult.error)
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 })
  }

  if (streakResult.error) {
    console.error('[api/profile/stats] RPC get_streak_for_group error:', streakResult.error)
    // Não bloqueia — streak vem como 0
  }

  const stats = statsResult.data?.[0]
  if (!stats) {
    return NextResponse.json({ error: 'Estatísticas não encontradas.' }, { status: 500 })
  }

  const predictionsMade = Number(stats.predictions_made)
  const finishedGames = Number(stats.finished_games)
  const winnerCorrect = Number(stats.winner_correct)
  const exactCorrect = Number(stats.exact_correct)
  const totalPoints = Number(stats.total_points)
  const bestStreak = Number(stats.best_streak)

  // Calcular taxas no JavaScript
  const winnerRate = predictionsMade > 0 ? winnerCorrect / predictionsMade : 0
  const exactRate = predictionsMade > 0 ? exactCorrect / predictionsMade : 0
  const avgPoints = predictionsMade > 0 ? totalPoints / predictionsMade : 0

  // Extrair streak atual do usuário
  const streakRow = (streakResult.data ?? []).find(
    (row: { user_id: string; streak: number }) => row.user_id === user.id
  )
  const currentStreak = streakRow ? Number(streakRow.streak) : 0

  // Nome do usuário
  const userName = profileResult.data?.name ?? user.email ?? ''

  // Nome do grupo
  const groupData = groupResult.data?.groups as { name: string } | { name: string }[] | null
  const groupName = Array.isArray(groupData)
    ? groupData[0]?.name ?? ''
    : groupData?.name ?? ''

  return NextResponse.json({
    user_name: userName,
    group_name: groupName,
    predictions_made: predictionsMade,
    finished_games: finishedGames,
    winner_correct: winnerCorrect,
    exact_correct: exactCorrect,
    total_points: totalPoints,
    winner_rate: winnerRate,
    exact_rate: exactRate,
    avg_points: avgPoints,
    current_streak: currentStreak,
    best_streak: bestStreak,
  })
}
