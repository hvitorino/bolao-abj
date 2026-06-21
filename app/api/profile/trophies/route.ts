import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

interface ContributingGame {
  game_id: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}

interface TrophyResult {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  contributing_games: ContributingGame[]
}

const TROPHY_NAMES: Record<string, string> = {
  estreia: 'ESTREIA',
  abriu_o_placar: 'ABRIU O PLACAR',
  cravada: 'CRAVADA',
  rei_da_goleada: 'REI DA GOLEADA',
  embalado: 'EMBALADO',
  em_chamas: 'EM CHAMAS',
  imparavel: 'IMPARÁVEL',
  profeta: 'PROFETA',
  vidente: 'VIDENTE',
  artilheiro: 'ARTILHEIRO',
  perfeito_na_rodada: 'PERFEITO NA RODADA',
  fiel: 'FIEL',
  cartola: 'CARTOLA',
  zebreiro: 'ZEBREIRO',
  podio: 'PÓDIO',
}

function makeTrophy(
  id: string,
  unlockedAt: string | null,
  progress: number | null = null,
  progressMax: number | null = null,
  contributingGames: ContributingGame[] = []
): TrophyResult {
  return {
    id,
    name: TROPHY_NAMES[id],
    status: unlockedAt ? 'unlocked' : 'locked',
    unlocked_at: unlockedAt,
    progress,
    progress_max: progressMax,
    contributing_games: contributingGames,
  }
}

// Extrai match_date de uma row de scores com join em games
// O Supabase retorna games como objeto (quando maybeSingle) ou array
function extractMatchDate(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const games = r.games
  if (!games) return null
  if (Array.isArray(games)) {
    const first = games[0] as Record<string, unknown> | undefined
    return (first?.match_date as string) ?? null
  }
  const g = games as Record<string, unknown>
  return (g.match_date as string) ?? null
}

// Extrai um ContributingGame de uma row com join em games
// Retorna null se game_id ausente ou se home_score/away_score forem null
function extractContributingGame(row: unknown): ContributingGame | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const gameId = r.game_id as string | undefined
  if (!gameId) return null
  const games = r.games
  if (!games) return null
  const g = Array.isArray(games)
    ? (games[0] as Record<string, unknown>)
    : (games as Record<string, unknown>)
  if (!g) return null
  const homeScore = g.home_score as number | null | undefined
  const awayScore = g.away_score as number | null | undefined
  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) return null
  return {
    game_id: gameId,
    home_team_code: g.home_team_code as string,
    away_team_code: g.away_team_code as string,
    home_score: homeScore,
    away_score: awayScore,
  }
}

async function calcTrophies(
  sc: SupabaseClient,
  groupId: string,
  userId: string
): Promise<TrophyResult[]> {

  // Executar queries em paralelo
  const [
    estreiaRes,
    abrioRes,
    cravadaRes,
    goleadaRes,
    streakStatsRes,
    profetaRes,
    videnteRes,
    artilheiroRes,
    cartolaTRes,
    podioRes,
    totalWinnerRes,
    rankingRes,
  ] = await Promise.all([
    // estreia: primeiro palpite (com join em games para contributing_games)
    sc
      .from('predictions')
      .select('submitted_at, game_id, games(home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .order('submitted_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // abriu_o_placar: primeiro score com winner > 0
    sc
      .from('scores')
      .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // cravada: todos placares exatos (para count e contributing_games)
    sc
      .from('scores')
      .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true }),

    // rei_da_goleada: primeiro bônus de goleada
    sc
      .from('scores')
      .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>goleada', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // streak stats para embalado/em_chamas/imparavel
    sc.rpc('get_profile_stats', { p_group_id: groupId, p_user_id: userId }),

    // profeta: primeiros 5 placares exatos em ordem cronológica
    sc
      .from('scores')
      .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(5),

    // vidente: todos acertos de vencedor (sem limit para contributing_games completo)
    sc
      .from('scores')
      .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')
      .order('calculated_at', { ascending: true }),

    // artilheiro: todos scores em ordem cronológica (para running sum e contributing_games)
    sc
      .from('scores')
      .select('game_id, points, games(match_date, home_team_code, away_team_code, home_score, away_score)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .order('calculated_at', { ascending: true }),

    // cartola: já foi 1º em algum snapshot
    sc
      .from('position_snapshots')
      .select('snapshot_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('rank_position', 1)
      .order('snapshot_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // podio: top 3 em algum snapshot
    sc
      .from('position_snapshots')
      .select('snapshot_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .lte('rank_position', 3)
      .order('snapshot_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // total de acertos de vencedor (para progresso do vidente)
    sc
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0'),

    // ranking atual — fallback para cartola e pódio quando não há snapshots históricos
    sc.rpc('get_ranking', { p_group_id: groupId }),
  ])

  // --- Estreia ---
  const estreiaAt = (estreiaRes.data as { submitted_at: string } | null)?.submitted_at ?? null
  const estreiaGame = extractContributingGame(estreiaRes.data)
  const estreiaGames = estreiaGame ? [estreiaGame] : []

  // --- Abriu o placar ---
  const abrioAt = extractMatchDate(abrioRes.data)
  const abrioGame = extractContributingGame(abrioRes.data)
  const abrioGames = abrioGame ? [abrioGame] : []

  // --- Cravada ---
  const cravadaItems = (cravadaRes.data ?? []) as unknown[]
  const cravadaCount = cravadaItems.length
  const cravadaAt = cravadaCount > 0 ? extractMatchDate(cravadaItems[0]) : null
  const cravadaGames = cravadaItems
    .map(extractContributingGame)
    .filter((g): g is ContributingGame => g !== null)

  // --- Rei da goleada ---
  const goleadaAt = goleadaRes.data ? extractMatchDate(goleadaRes.data) : null
  const goleadaGame = extractContributingGame(goleadaRes.data)
  const goleadaGames = goleadaGame ? [goleadaGame] : []

  // --- Sequências ---
  const statsRow = (streakStatsRes.data as Array<Record<string, unknown>> | null)?.[0]
  const bestStreak = statsRow ? Number(statsRow.best_streak ?? 0) : 0

  // Buscar histórico completo de scores em ordem cronológica para reconstruir sequência
  const { data: streakHistory } = await sc
    .from('scores')
    .select('game_id, breakdown, games(match_date, home_team_code, away_team_code, home_score, away_score)')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .order('calculated_at', { ascending: true })

  function findStreakUnlockDate(threshold: number): string | null {
    if (!streakHistory || bestStreak < threshold) return null
    let current = 0
    for (const row of streakHistory as Array<Record<string, unknown>>) {
      const bd = row.breakdown as Record<string, number> | null
      const winner = Number(bd?.winner ?? 0)
      if (winner > 0) {
        current++
        if (current >= threshold) {
          return extractMatchDate(row)
        }
      } else {
        current = 0
      }
    }
    return null
  }

  function findStreakContributingGames(threshold: number): ContributingGame[] {
    if (!streakHistory || bestStreak < threshold) return []
    let current: ContributingGame[] = []
    for (const row of streakHistory as Array<Record<string, unknown>>) {
      const bd = row.breakdown as Record<string, number> | null
      const winner = Number(bd?.winner ?? 0)
      if (winner > 0) {
        const game = extractContributingGame(row)
        if (game) current.push(game)
        if (current.length >= threshold) {
          return current.slice(-threshold)
        }
      } else {
        current = []
      }
    }
    return []
  }

  const embaladoAt = findStreakUnlockDate(3)
  const emChamasAt = findStreakUnlockDate(5)
  const imparavelAt = findStreakUnlockDate(8)

  const embaladoGames = findStreakContributingGames(3)
  const emChamasGames = findStreakContributingGames(5)
  const imparavelGames = findStreakContributingGames(8)

  // --- Profeta (5º placar exato) ---
  const profetaItems = (profetaRes.data ?? []) as unknown[]
  const profetaAt = profetaItems.length >= 5 ? extractMatchDate(profetaItems[4]) : null
  // profeta reutiliza os mesmos jogos de cravada (todos os placares exatos)
  const profetaGames = cravadaGames

  // --- Vidente (25º acerto de vencedor) ---
  const videnteItems = (videnteRes.data ?? []) as unknown[]
  const videnteAt = videnteItems.length >= 25 ? extractMatchDate(videnteItems[24]) : null
  const totalWinnerCount = (totalWinnerRes as { count?: number | null }).count ?? 0
  const videnteGames = videnteItems
    .map(extractContributingGame)
    .filter((g): g is ContributingGame => g !== null)

  // --- Artilheiro ---
  const artItems = (artilheiroRes.data ?? []) as Array<Record<string, unknown>>
  let runningTotal = 0
  let artilheiroAt: string | null = null
  for (const row of artItems) {
    runningTotal += Number(row.points ?? 0)
    if (runningTotal >= 100 && !artilheiroAt) {
      artilheiroAt = extractMatchDate(row)
    }
  }
  const totalPointsVal = artItems.reduce((sum, r) => sum + Number(r.points ?? 0), 0)
  const artilheiroGames = artItems
    .filter((r) => Number(r.points ?? 0) > 0)
    .map(extractContributingGame)
    .filter((g): g is ContributingGame => g !== null)

  // --- Perfeito na rodada (query manual) ---
  let perfeitaAt: string | null = null
  let perfeitaGames: ContributingGame[] = []
  const { data: perfeitaDays } = await sc
    .from('games')
    .select('match_day')
    .eq('status', 'finished')

  const perfeitaDaySet = [...new Set((perfeitaDays ?? []).map((g: { match_day: string }) => g.match_day))].sort()

  for (const day of perfeitaDaySet) {
    const { data: dayGames } = await sc
      .from('games')
      .select('id')
      .eq('match_day', day)
      .eq('status', 'finished')
    if (!dayGames || dayGames.length < 2) continue
    const gameIds = dayGames.map((g: { id: string }) => g.id)
    const { data: dayScores } = await sc
      .from('scores')
      .select('game_id, breakdown')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .in('game_id', gameIds)
    if (!dayScores || dayScores.length < gameIds.length) continue
    const allCorrect = (dayScores as Array<{ breakdown: Record<string, number> }>).every(
      (s) => Number(s.breakdown?.winner ?? 0) > 0
    )
    if (allCorrect) {
      perfeitaAt = day
      // Buscar dados completos dos jogos do dia perfeito para contributing_games
      const { data: perfeitaDayDetails } = await sc
        .from('games')
        .select('id, home_team_code, away_team_code, home_score, away_score')
        .eq('match_day', day)
        .eq('status', 'finished')
      perfeitaGames = (perfeitaDayDetails ?? [])
        .filter(
          (g: { home_score: number | null; away_score: number | null }) =>
            g.home_score !== null && g.away_score !== null
        )
        .map((g: { id: string; home_team_code: string; away_team_code: string; home_score: number; away_score: number }) => ({
          game_id: g.id,
          home_team_code: g.home_team_code,
          away_team_code: g.away_team_code,
          home_score: g.home_score,
          away_score: g.away_score,
        }))
      break
    }
  }

  // --- Fiel (query manual) ---
  let fielAt: string | null = null
  let fielGames: ContributingGame[] = []
  for (const day of perfeitaDaySet) {
    const { data: dayGames } = await sc
      .from('games')
      .select('id')
      .eq('match_day', day)
      .eq('status', 'finished')
    if (!dayGames || dayGames.length < 2) continue
    const gameIds = dayGames.map((g: { id: string }) => g.id)
    const { count: predCount } = await sc
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .in('game_id', gameIds)
    if ((predCount ?? 0) >= gameIds.length) {
      fielAt = day
      // Buscar dados completos dos jogos do dia fiel para contributing_games
      const { data: fielDayDetails } = await sc
        .from('games')
        .select('id, home_team_code, away_team_code, home_score, away_score')
        .eq('match_day', day)
        .eq('status', 'finished')
      fielGames = (fielDayDetails ?? [])
        .filter(
          (g: { home_score: number | null; away_score: number | null }) =>
            g.home_score !== null && g.away_score !== null
        )
        .map((g: { id: string; home_team_code: string; away_team_code: string; home_score: number; away_score: number }) => ({
          game_id: g.id,
          home_team_code: g.home_team_code,
          away_team_code: g.away_team_code,
          home_score: g.home_score,
          away_score: g.away_score,
        }))
      break
    }
  }

  // --- Ranking atual (fallback para cartola e pódio) ---
  const rankingRows = (rankingRes.data as Array<{ user_id: string; rank_position: number }> | null) ?? []
  const currentRank = rankingRows.find((r) => r.user_id === userId)?.rank_position ?? null
  const nowIso = new Date().toISOString()

  // --- Cartola ---
  const cartolaAt =
    (cartolaTRes.data as { snapshot_at: string } | null)?.snapshot_at
    ?? (currentRank === 1 ? nowIso : null)

  // --- Zebreiro (query manual) ---
  let zebreiroAt: string | null = null
  let zebreiroGames: ContributingGame[] = []
  const { data: userWins } = await sc
    .from('scores')
    .select('game_id, games(match_date, home_team_code, away_team_code, home_score, away_score)')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .filter('breakdown->>winner', 'gt', '0')
    .order('calculated_at', { ascending: true })

  for (const win of (userWins ?? []) as Array<Record<string, unknown>>) {
    const gameId = win.game_id as string
    const [{ count: totalPreds }, { count: correctPreds }] = await Promise.all([
      sc
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('group_id', groupId),
      sc
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('group_id', groupId)
        .filter('breakdown->>winner', 'gt', '0'),
    ])
    const total = totalPreds ?? 0
    const correct = correctPreds ?? 0
    const errors = total - correct
    if (total > 0 && errors / total > 0.5) {
      zebreiroAt = extractMatchDate(win)
      const zebreiroGame = extractContributingGame(win)
      if (zebreiroGame) zebreiroGames = [zebreiroGame]
      break
    }
  }

  // --- Pódio ---
  const podioAt =
    (podioRes.data as { snapshot_at: string } | null)?.snapshot_at
    ?? (currentRank !== null && currentRank <= 3 ? nowIso : null)

  // --- Montar array de troféus ---
  const trophies: TrophyResult[] = [
    makeTrophy('estreia', estreiaAt, null, null, estreiaGames),
    makeTrophy('abriu_o_placar', abrioAt, null, null, abrioGames),
    makeTrophy('cravada', cravadaAt, cravadaCount, 5, cravadaGames),
    makeTrophy('rei_da_goleada', goleadaAt, null, null, goleadaGames),
    makeTrophy('embalado', embaladoAt, Math.min(bestStreak, 3), 3, embaladoGames),
    makeTrophy('em_chamas', emChamasAt, Math.min(bestStreak, 5), 5, emChamasGames),
    makeTrophy('imparavel', imparavelAt, Math.min(bestStreak, 8), 8, imparavelGames),
    makeTrophy('profeta', profetaAt, Math.min(cravadaCount, 5), 5, profetaGames),
    makeTrophy('vidente', videnteAt, totalWinnerCount, 25, videnteGames),
    makeTrophy('artilheiro', artilheiroAt, Math.min(totalPointsVal, 100), 100, artilheiroGames),
    makeTrophy('perfeito_na_rodada', perfeitaAt, null, null, perfeitaGames),
    makeTrophy('fiel', fielAt, null, null, fielGames),
    makeTrophy('cartola', cartolaAt, null, null, []),
    makeTrophy('zebreiro', zebreiroAt, null, null, zebreiroGames),
    makeTrophy('podio', podioAt, null, null, []),
  ]

  // Ordenar: desbloqueados primeiro (por data), depois locked
  return trophies.sort((a, b) => {
    const order = { unlocked: 0, locked: 1 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    if (a.status === 'unlocked' && b.status === 'unlocked') {
      return (a.unlocked_at ?? '').localeCompare(b.unlocked_at ?? '')
    }
    return 0
  })
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

  const searchParams = new URL(request.url).searchParams
  const groupId = searchParams.get('group_id')

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json({ error: 'group_id inválido.' }, { status: 400 })
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  // Verificar membership
  const { data: membership } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Você não participa deste grupo.' }, { status: 403 })
  }

  try {
    const trophies = await calcTrophies(serviceClient, groupId, user.id)
    return NextResponse.json({ trophies })
  } catch (err) {
    console.error('[api/profile/trophies] error:', err)
    return NextResponse.json({ error: 'Erro ao calcular troféus.' }, { status: 500 })
  }
}
