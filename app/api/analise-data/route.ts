import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service-server'
import { calculateTeamStats, getRecentGames, GameRow } from '@/lib/analytics/team-stats'
import { calculateGroupStandings } from '@/lib/analytics/group-standings'
import type { ScoreBreakdown, Score } from '@/lib/types/score'
import type { ParticipantEntry } from '@/lib/types/participant'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const gameId = searchParams.get('gameId')
  const groupId = searchParams.get('groupId')

  if (!gameId || !groupId) {
    return NextResponse.json({ error: 'gameId e groupId são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Verificar autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  // 2. Verificar membership no grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  // 3. Buscar jogo principal
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round, phase, group_letter'
    )
    .eq('id', gameId)
    .single()

  if (gameError || !game) {
    return NextResponse.json({ error: 'jogo não encontrado' }, { status: 404 })
  }

  // 4. Buscar todos os jogos dos dois times na Copa 2026
  const { data: allTeamGames } = await supabase
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round'
    )
    .or(
      `home_team_code.eq.${game.home_team_code},away_team_code.eq.${game.home_team_code},home_team_code.eq.${game.away_team_code},away_team_code.eq.${game.away_team_code}`
    )
    .order('match_date', { ascending: true })

  const games: GameRow[] = allTeamGames ?? []

  // 4b. Se for fase de grupos, buscar todos os jogos do mesmo grupo para calcular classificação
  const isGroupStage = (game.phase ?? '') === 'Fase de Grupos'
  const groupLetter = game.group_letter
  let allGroupGames: GameRow[] = []
  if (isGroupStage && groupLetter) {
    const { data: groupGameRows } = await supabase
      .from('games')
      .select(
        'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round, phase, group_letter'
      )
      .eq('group_letter', groupLetter)
      .order('match_date', { ascending: true })

    allGroupGames = groupGameRows ?? []
  }

  const supabaseService = createServiceClient()

  // 5. Queries paralelas (mesmas da analise/page.tsx, sem nextGame/prevGame)
  const [
    { data: groupMembers },
    { data: allPredictions },
    { data: allScores },
    { data: predictionExistence },
  ] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, profiles(id, name)')
      .eq('group_id', groupId),

    supabase
      .from('predictions')
      .select('id, game_id, user_id, home_score, away_score, submitted_at')
      .eq('group_id', groupId)
      .eq('game_id', gameId),

    supabase
      .from('scores')
      .select('*')
      .eq('group_id', groupId)
      .eq('game_id', gameId),

    supabaseService
      .from('predictions')
      .select('user_id, game_id')
      .eq('group_id', groupId)
      .eq('game_id', gameId),
  ])

  // 6. Montar participants (mesma lógica da analise/page.tsx)
  type GroupMemberRow = {
    user_id: string
    profiles: { id: string; name: string } | { id: string; name: string }[] | null
  }
  const memberProfiles = ((groupMembers ?? []) as GroupMemberRow[])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return profile ? { id: profile.id, name: profile.name } : null
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const predByUser: Record<string, { id: string; home_score: number; away_score: number }> = {}
  for (const p of allPredictions ?? []) {
    predByUser[p.user_id] = { id: p.id, home_score: p.home_score, away_score: p.away_score }
  }
  const scoreByUser: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}
  for (const s of (allScores ?? []) as Score[]) {
    scoreByUser[s.user_id] = { points: s.points, breakdown: s.breakdown }
  }
  const hasPredictionSet = new Set<string>(
    (predictionExistence ?? []).map((r) => r.user_id)
  )

  const participants: ParticipantEntry[] = memberProfiles.map((profile) => {
    const prediction = predByUser[profile.id] ?? null
    const scoreEntry = prediction !== null ? (scoreByUser[profile.id] ?? null) : null
    return {
      userId: profile.id,
      name: profile.name,
      prediction,
      points: scoreEntry?.points ?? null,
      breakdown: scoreEntry?.breakdown ?? null,
      hasPrediction: hasPredictionSet.has(profile.id),
    }
  })

  // 7. Calcular stats e jogos recentes
  const homeStats = calculateTeamStats(games, game.home_team_code, game.match_date)
  const awayStats = calculateTeamStats(games, game.away_team_code, game.match_date)
  const homeRecentGames = getRecentGames(games, game.home_team_code, game.match_date)
  const awayRecentGames = getRecentGames(games, game.away_team_code, game.match_date)

  // 7b. Calcular classificação do grupo (null para mata-mata)
  const groupStandings = isGroupStage
    ? calculateGroupStandings(allGroupGames, game.match_date)
    : null

  return NextResponse.json({
    game,
    participants,
    homeStats,
    awayStats,
    homeRecentGames,
    awayRecentGames,
    groupStandings,
  })
}
