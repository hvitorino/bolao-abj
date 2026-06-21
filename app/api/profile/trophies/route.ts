import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

interface TrophyResult {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
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
  progressMax: number | null = null
): TrophyResult {
  return {
    id,
    name: TROPHY_NAMES[id],
    status: unlockedAt ? 'unlocked' : 'locked',
    unlocked_at: unlockedAt,
    progress,
    progress_max: progressMax,
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
  ] = await Promise.all([
    // estreia: primeiro palpite
    sc
      .from('predictions')
      .select('submitted_at')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .order('submitted_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // abriu_o_placar: primeiro score com winner > 0
    sc
      .from('scores')
      .select('game_id, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // cravada: todos placares exatos (para count e primeiro)
    sc
      .from('scores')
      .select('game_id, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true }),

    // rei_da_goleada: primeiro bônus de goleada
    sc
      .from('scores')
      .select('game_id, games(match_date)')
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
      .select('game_id, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(5),

    // vidente: primeiros 25 acertos de vencedor
    sc
      .from('scores')
      .select('game_id, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(25),

    // artilheiro: todos scores em ordem cronológica (para running sum)
    sc
      .from('scores')
      .select('game_id, points, games(match_date)')
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
  ])

  // --- Estreia ---
  const estreiaAt = (estreiaRes.data as { submitted_at: string } | null)?.submitted_at ?? null

  // --- Abriu o placar ---
  const abrioAt = extractMatchDate(abrioRes.data)

  // --- Cravada ---
  const cravadaItems = (cravadaRes.data ?? []) as unknown[]
  const cravadaCount = cravadaItems.length
  const cravadaAt = cravadaCount > 0 ? extractMatchDate(cravadaItems[0]) : null

  // --- Rei da goleada ---
  const goleadaAt = goleadaRes.data ? extractMatchDate(goleadaRes.data) : null

  // --- Sequências ---
  const statsRow = (streakStatsRes.data as Array<Record<string, unknown>> | null)?.[0]
  const bestStreak = statsRow ? Number(statsRow.best_streak ?? 0) : 0

  // Buscar histórico completo de scores em ordem cronológica para reconstruir sequência
  const { data: streakHistory } = await sc
    .from('scores')
    .select('game_id, breakdown, games(match_date)')
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

  const embaladoAt = findStreakUnlockDate(3)
  const emChamasAt = findStreakUnlockDate(5)
  const imparavelAt = findStreakUnlockDate(8)

  // --- Profeta (5º placar exato) ---
  const profetaItems = (profetaRes.data ?? []) as unknown[]
  const profetaAt = profetaItems.length >= 5 ? extractMatchDate(profetaItems[4]) : null

  // --- Vidente (25º acerto de vencedor) ---
  const videnteItems = (videnteRes.data ?? []) as unknown[]
  const videnteAt = videnteItems.length >= 25 ? extractMatchDate(videnteItems[24]) : null
  const totalWinnerCount = (totalWinnerRes as { count?: number | null }).count ?? 0

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

  // --- Perfeito na rodada (query manual) ---
  let perfeitaAt: string | null = null
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
      break
    }
  }

  // --- Fiel (query manual) ---
  let fielAt: string | null = null
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
      break
    }
  }

  // --- Cartola ---
  const cartolaAt =
    (cartolaTRes.data as { snapshot_at: string } | null)?.snapshot_at ?? null

  // --- Zebreiro (query manual) ---
  let zebreiroAt: string | null = null
  const { data: userWins } = await sc
    .from('scores')
    .select('game_id, games(match_date)')
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
      break
    }
  }

  // --- Pódio ---
  const podioAt =
    (podioRes.data as { snapshot_at: string } | null)?.snapshot_at ?? null

  // --- Montar array de troféus ---
  const trophies: TrophyResult[] = [
    makeTrophy('estreia', estreiaAt),
    makeTrophy('abriu_o_placar', abrioAt),
    makeTrophy('cravada', cravadaAt, cravadaCount, 5),
    makeTrophy('rei_da_goleada', goleadaAt),
    makeTrophy('embalado', embaladoAt, Math.min(bestStreak, 3), 3),
    makeTrophy('em_chamas', emChamasAt, Math.min(bestStreak, 5), 5),
    makeTrophy('imparavel', imparavelAt, Math.min(bestStreak, 8), 8),
    makeTrophy('profeta', profetaAt, Math.min(cravadaCount, 5), 5),
    makeTrophy('vidente', videnteAt, totalWinnerCount, 25),
    makeTrophy('artilheiro', artilheiroAt, Math.min(totalPointsVal, 100), 100),
    makeTrophy('perfeito_na_rodada', perfeitaAt),
    makeTrophy('fiel', fielAt),
    makeTrophy('cartola', cartolaAt),
    makeTrophy('zebreiro', zebreiroAt),
    makeTrophy('podio', podioAt),
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
