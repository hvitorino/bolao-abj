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
  status: 'unlocked' | 'locked' | 'secret'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  secret: boolean
}

// Troféus com estado "secret" por padrão (antes de desbloquear, exibem "???")
const SECRET_TROPHIES = new Set([
  'estreia',
  'abriu_o_placar',
  'rei_da_goleada',
  'perfeito_na_rodada',
  'cartola',
  'zebreiro',
  'podio',
])

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
  const isSecret = SECRET_TROPHIES.has(id)
  if (unlockedAt) {
    return {
      id,
      name: TROPHY_NAMES[id],
      status: 'unlocked',
      unlocked_at: unlockedAt,
      progress,
      progress_max: progressMax,
      secret: isSecret,
    }
  }
  if (isSecret) {
    return {
      id,
      name: '???',
      status: 'secret',
      unlocked_at: null,
      progress: null,
      progress_max: null,
      secret: true,
    }
  }
  return {
    id,
    name: TROPHY_NAMES[id],
    status: 'locked',
    unlocked_at: null,
    progress,
    progress_max: progressMax,
    secret: false,
  }
}

async function calcTrophies(
  sc: SupabaseClient,
  groupId: string,
  userId: string
): Promise<TrophyResult[]> {
  // Executar todas as queries em paralelo
  const [
    estreiaRes,
    abrioRes,
    cradaRes,
    goleadaRes,
    streakStatsRes,
    profetaRes,
    videnteRes,
    artilheiroRes,
    perfeitaRes,
    fielRes,
    cartolaTRes,
    zebreiroRes,
    podioRes,
    totalPointsRes,
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
    sc.rpc('get_first_score_date', {
      p_group_id: groupId,
      p_user_id: userId,
      p_breakdown_key: 'winner',
    }).then(() =>
      // Fallback: query direta — get_first_score_date pode não existir
      sc
        .from('scores')
        .select('games(match_date)')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .filter('breakdown->>winner', 'gt', '0')
        .order('calculated_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    ).catch(() =>
      sc
        .from('scores')
        .select('games(match_date)')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .filter('breakdown->>winner', 'gt', '0')
        .order('calculated_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    ),

    // cravada: placares exatos — count + data do 1º
    sc
      .from('scores')
      .select('id, games(match_date)', { count: 'exact' })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true }),

    // rei_da_goleada: primeiro bônus de goleada
    sc
      .from('scores')
      .select('games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>goleada', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // streak stats para embalado/em_chamas/imparavel
    sc.rpc('get_profile_stats', { p_group_id: groupId, p_user_id: userId }),

    // profeta: 5º placar exato
    sc
      .from('scores')
      .select('games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>exact', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(5),

    // vidente: 25º acerto de vencedor
    sc
      .from('scores')
      .select('games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')
      .order('calculated_at', { ascending: true })
      .limit(25),

    // artilheiro: pontos acumulados, data ao atingir 100
    sc
      .from('scores')
      .select('points, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .order('calculated_at', { ascending: true }),

    // perfeito_na_rodada: acertou todos vencedores de um dia (>= 2 jogos)
    sc.rpc('check_perfect_day', {
      p_group_id: groupId,
      p_user_id: userId,
    }).catch(() => ({ data: null, error: null })),

    // fiel: palpitou em todos os jogos de um dia (>= 2 jogos)
    sc.rpc('check_faithful_day', {
      p_group_id: groupId,
      p_user_id: userId,
    }).catch(() => ({ data: null, error: null })),

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

    // zebreiro: acertou vencedor enquanto maioria do grupo errou
    sc.rpc('check_zebreiro', {
      p_group_id: groupId,
      p_user_id: userId,
    }).catch(() => ({ data: null, error: null })),

    // podio: fechou dia no top 3
    sc
      .from('position_snapshots')
      .select('snapshot_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .lte('rank_position', 3)
      .order('snapshot_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // total de pontos (para artilheiro progress)
    sc
      .from('scores')
      .select('points')
      .eq('user_id', userId)
      .eq('group_id', groupId),

    // total de acertos de vencedor (para vidente progress)
    sc
      .from('scores')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0'),
  ])

  // --- Processar estreia ---
  const estreiaAt = estreiaRes.data?.submitted_at ?? null

  // --- Processar abriu_o_placar ---
  // Query direta em vez de RPC inexistente
  const { data: abrioData } = await sc
    .from('scores')
    .select('games(match_date)')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .filter('breakdown->>winner', 'gt', '0')
    .order('calculated_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const abrioAt = extractMatchDate(abrioData)

  // Suprimir uso do abrioRes para evitar lint
  void abrioRes

  // --- Processar cravada ---
  const cravadaItems = cradaRes.data ?? []
  const cravadaCount = cravadaItems.length
  const cravadaAt =
    cravadaCount > 0 ? extractMatchDate(cravadaItems[0]) : null

  // --- Processar rei_da_goleada ---
  const goleadaAt = goleadaRes.data ? extractMatchDate(goleadaRes.data) : null

  // --- Processar sequências (embalado/em_chamas/imparavel) ---
  const statsRow = streakStatsRes.data?.[0]
  const bestStreak = statsRow ? Number(statsRow.best_streak) : 0

  // Buscar data do jogo que atingiu threshold para sequências
  // Usar histórico completo ordenado cronologicamente
  const { data: streakHistory } = await sc
    .from('scores')
    .select('points, breakdown, games(match_date, id)')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .order('calculated_at', { ascending: true })

  function findStreakUnlockDate(threshold: number): string | null {
    if (!streakHistory || bestStreak < threshold) return null
    let current = 0
    for (const row of streakHistory) {
      const winner = Number((row.breakdown as Record<string, number>)?.winner ?? 0)
      if (winner > 0) {
        current++
        if (current >= threshold) {
          const g = row.games as { match_date: string } | null
          return g?.match_date ?? null
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

  // --- Processar profeta (5 exatos) ---
  const profetaItems = profetaRes.data ?? []
  const profetaAt =
    profetaItems.length >= 5 ? extractMatchDate(profetaItems[4]) : null

  // --- Processar vidente (25 acertos) ---
  const videnteItems = videnteRes.data ?? []
  const videnteAt =
    videnteItems.length >= 25 ? extractMatchDate(videnteItems[24]) : null

  // Contagem atual de acertos de vencedor
  const totalWinnerCount = (totalWinnerRes as { count?: number | null }).count ?? 0

  // --- Processar artilheiro ---
  const artItems = artilheiroRes.data ?? []
  let runningTotal = 0
  let artilheiroAt: string | null = null
  for (const row of artItems) {
    runningTotal += Number(row.points ?? 0)
    if (runningTotal >= 100 && !artilheiroAt) {
      artilheiroAt = extractMatchDate(row)
    }
  }
  const totalPointsVal = (totalPointsRes.data ?? []).reduce(
    (sum: number, r: { points: number }) => sum + Number(r.points ?? 0),
    0
  )

  // --- Processar perfeito_na_rodada (via query manual se RPC não existe) ---
  let perfeitaAt: string | null = null
  if (perfeitaRes.data) {
    perfeitaAt = (perfeitaRes.data as { unlocked_at?: string } | null)?.unlocked_at ?? null
  } else {
    // Query manual: dias com >= 2 jogos finished, onde user acertou todos
    const { data: perfeitaDays } = await sc
      .from('games')
      .select('match_day')
      .eq('status', 'finished')
    const days = [...new Set((perfeitaDays ?? []).map((g: { match_day: string }) => g.match_day))]
    for (const day of days.sort()) {
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
      const allCorrect = dayScores.every(
        (s: { breakdown: Record<string, number> }) =>
          Number(s.breakdown?.winner ?? 0) > 0
      )
      if (allCorrect) {
        perfeitaAt = day
        break
      }
    }
  }

  // --- Processar fiel ---
  let fielAt: string | null = null
  if (fielRes.data) {
    fielAt = (fielRes.data as { unlocked_at?: string } | null)?.unlocked_at ?? null
  } else {
    const { data: fielDays } = await sc
      .from('games')
      .select('match_day')
      .eq('status', 'finished')
    const fDays = [...new Set((fielDays ?? []).map((g: { match_day: string }) => g.match_day))]
    for (const day of fDays.sort()) {
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
  }

  // --- Processar cartola ---
  const cartolaTData = cartolaTRes.data as { snapshot_at: string } | null
  const cartolaAt = cartolaTData?.snapshot_at ?? null

  // --- Processar zebreiro ---
  let zebreiroAt: string | null = null
  if (zebreiroRes.data) {
    zebreiroAt = (zebreiroRes.data as { unlocked_at?: string } | null)?.unlocked_at ?? null
  } else {
    // Query manual: jogos onde user acertou e maioria errou
    const { data: userWins } = await sc
      .from('scores')
      .select('game_id, games(match_date)')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .filter('breakdown->>winner', 'gt', '0')

    for (const win of (userWins ?? []).sort(
      (a: { games: { match_date: string } | null }, b: { games: { match_date: string } | null }) =>
        (a.games?.match_date ?? '').localeCompare(b.games?.match_date ?? '')
    )) {
      const gameId = (win as { game_id: string }).game_id
      const { count: totalPreds } = await sc
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('group_id', groupId)
      const { count: correctPreds } = await sc
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('group_id', groupId)
        .filter('breakdown->>winner', 'gt', '0')
      const total = totalPreds ?? 0
      const correct = correctPreds ?? 0
      const errors = total - correct
      if (total > 0 && errors / total > 0.5) {
        const g = (win as { games: { match_date: string } | null }).games
        zebreiroAt = g?.match_date ?? null
        break
      }
    }
  }

  // --- Processar podio ---
  const podioData = podioRes.data as { snapshot_at: string } | null
  const podioAt = podioData?.snapshot_at ?? null

  // --- Montar array de troféus ---
  const trophies: TrophyResult[] = [
    makeTrophy('estreia', estreiaAt),
    makeTrophy('abriu_o_placar', abrioAt),
    makeTrophy('cravada', cravadaAt, cravadaCount, 5),
    makeTrophy('rei_da_goleada', goleadaAt),
    makeTrophy('embalado', embaladoAt, Math.min(bestStreak, 3), 3),
    makeTrophy('em_chamas', emChamasAt, Math.min(bestStreak, 5), 5),
    makeTrophy('imparavel', imparavelAt, Math.min(bestStreak, 8), 8),
    makeTrophy('profeta', profetaAt, cravadaCount, 5),
    makeTrophy('vidente', videnteAt, totalWinnerCount, 25),
    makeTrophy('artilheiro', artilheiroAt, Math.min(totalPointsVal, 100), 100),
    makeTrophy('perfeito_na_rodada', perfeitaAt),
    makeTrophy('fiel', fielAt),
    makeTrophy('cartola', cartolaAt),
    makeTrophy('zebreiro', zebreiroAt),
    makeTrophy('podio', podioAt),
  ]

  // Ordenar: desbloqueados primeiro (por data), depois locked com progresso, depois secretos
  return trophies.sort((a, b) => {
    const order = { unlocked: 0, locked: 1, secret: 2 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    if (a.status === 'unlocked' && b.status === 'unlocked') {
      return (a.unlocked_at ?? '').localeCompare(b.unlocked_at ?? '')
    }
    return 0
  })
}

function extractMatchDate(row: unknown): string | null {
  if (!row) return null
  const r = row as { games?: { match_date?: string } | null; match_date?: string }
  if (r.games?.match_date) return r.games.match_date
  if (r.match_date) return r.match_date
  return null
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
