import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Prioridade de raridade dos troféus para o inline badge
const TROPHY_RARITY_ORDER = [
  'imparavel',
  'em_chamas',
  'profeta',
  'cravada',
  'embalado',
  'vidente',
  'artilheiro',
  'perfeito_na_rodada',
  'zebreiro',
  'cartola',
  'podio',
  'rei_da_goleada',
  'fiel',
  'abriu_o_placar',
  'estreia',
]

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

  // --- Params ---
  const searchParams = new URL(request.url).searchParams
  const groupId = searchParams.get('group_id')
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10)
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10)

  if (!groupId || !isValidUUID(groupId)) {
    return NextResponse.json({ error: 'group_id inválido.' }, { status: 400 })
  }

  if (isNaN(limitParam) || limitParam < 1 || limitParam > 50) {
    return NextResponse.json({ error: 'limit deve estar entre 1 e 50.' }, { status: 422 })
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  // --- Verificar membership ---
  const { data: membership } = await serviceClient
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Você não participa deste grupo.' }, { status: 403 })
  }

  // --- Buscar histórico paginado e total em paralelo ---
  const [historyResult, totalResult] = await Promise.all([
    serviceClient.rpc('get_profile_history', {
      p_group_id: groupId,
      p_user_id: user.id,
      p_limit: limitParam,
      p_offset: offsetParam,
    }),
    serviceClient
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'finished'),
  ])

  if (historyResult.error) {
    console.error('[api/profile/history] get_profile_history error:', historyResult.error)
    return NextResponse.json({ error: 'Erro ao buscar histórico.' }, { status: 500 })
  }

  const items = historyResult.data ?? []
  const total = totalResult.count ?? 0
  const hasMore = offsetParam + limitParam < total

  // --- Calcular trophy_unlocked_id por item ---
  // Buscar troféus do usuário com suas datas de desbloqueio
  // Estratégia simplificada: buscar dados de troféus que têm data associada a game específico
  // e associar ao item do histórico correspondente

  // Buscar cravadas (placares exatos) com game_id
  const { data: exactScoresRaw } = await serviceClient
    .from('scores')
    .select('game_id, games(match_date)')
    .eq('user_id', user.id)
    .eq('group_id', groupId)
    .filter('breakdown->>exact', 'gt', '0')

  // Buscar todos os scores para sequências
  const { data: allScoresRaw } = await serviceClient
    .from('scores')
    .select('game_id, breakdown, points, games(match_date)')
    .eq('user_id', user.id)
    .eq('group_id', groupId)

  // Ordenar por match_date para garantir ordem cronológica correta dos troféus
  function matchDateOf(row: { games: unknown }): number {
    const g = row.games as { match_date?: string } | null
    return g?.match_date ? new Date(g.match_date).getTime() : 0
  }

  const exactScores = exactScoresRaw ? [...exactScoresRaw].sort((a, b) => matchDateOf(a) - matchDateOf(b)) : []
  const allScores = allScoresRaw ? [...allScoresRaw].sort((a, b) => matchDateOf(a) - matchDateOf(b)) : []

  // Mapear game_id -> troféu desbloqueado naquele jogo
  const trophyByGame: Map<string, string[]> = new Map()

  // Função auxiliar para adicionar troféu ao mapa
  function addTrophy(gameId: string, trophyId: string) {
    if (!trophyByGame.has(gameId)) {
      trophyByGame.set(gameId, [])
    }
    trophyByGame.get(gameId)!.push(trophyId)
  }

  // Troféus baseados em contagem cumulativa
  if (exactScores && exactScores.length > 0) {
    // cravada: primeiro placar exato
    addTrophy((exactScores[0] as { game_id: string }).game_id, 'cravada')
    // profeta: 5º placar exato
    if (exactScores.length >= 5) {
      addTrophy((exactScores[4] as { game_id: string }).game_id, 'profeta')
    }
  }

  // Sequências
  if (allScores) {
    let streakCount = 0
    const streakUnlocked = new Set<number>()

    for (const row of allScores) {
      const winner = Number((row.breakdown as Record<string, number>)?.winner ?? 0)
      if (winner > 0) {
        streakCount++
        const thresholds = [
          { n: 3, id: 'embalado' },
          { n: 5, id: 'em_chamas' },
          { n: 8, id: 'imparavel' },
        ]
        for (const { n, id } of thresholds) {
          if (streakCount === n && !streakUnlocked.has(n)) {
            streakUnlocked.add(n)
            addTrophy((row as { game_id: string }).game_id, id)
          }
        }
      } else {
        streakCount = 0
      }
    }

    // vidente: 25º acerto de vencedor
    const winnerScores = allScores.filter(
      (r) => Number((r.breakdown as Record<string, number>)?.winner ?? 0) > 0
    )
    if (winnerScores.length >= 25) {
      addTrophy((winnerScores[24] as { game_id: string }).game_id, 'vidente')
    }

    // artilheiro: jogo que levou acima de 100 pts
    let cumPts = 0
    let artUnlocked = false
    for (const row of allScores) {
      cumPts += Number((row as { points?: number }).points ?? 0)
      if (cumPts >= 100 && !artUnlocked) {
        artUnlocked = true
        addTrophy((row as { game_id: string }).game_id, 'artilheiro')
      }
    }

    // Troféus de goleada
    const goleadaScores = allScores.filter(
      (r) => Number((r.breakdown as Record<string, number>)?.goleada ?? 0) > 0
    )
    if (goleadaScores.length > 0) {
      addTrophy((goleadaScores[0] as { game_id: string }).game_id, 'rei_da_goleada')
    }

    // abriu_o_placar: primeiro winner
    const winnerFirst = allScores.find(
      (r) => Number((r.breakdown as Record<string, number>)?.winner ?? 0) > 0
    )
    if (winnerFirst) {
      addTrophy((winnerFirst as { game_id: string }).game_id, 'abriu_o_placar')
    }
  }

  // estreia: primeiro palpite — encontrar o game_id do primeiro palpite
  const { data: firstPred } = await serviceClient
    .from('predictions')
    .select('game_id')
    .eq('user_id', user.id)
    .eq('group_id', groupId)
    .order('submitted_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstPred) {
    addTrophy((firstPred as { game_id: string }).game_id, 'estreia')
  }

  // --- Montar items com trophy_unlocked_id ---
  const itemsWithTrophy = items.map(
    (item: {
      game_id: string
      match_day: string
      home_team: string
      away_team: string
      home_team_code: string
      away_team_code: string
      home_score: number
      away_score: number
      pred_home: number | null
      pred_away: number | null
      points: number
      breakdown: Record<string, number> | null
      is_miss: boolean
    }) => {
      const trophies = trophyByGame.get(item.game_id) ?? []
      // Selecionar o troféu de maior raridade
      let trophyId: string | null = null
      for (const candidate of TROPHY_RARITY_ORDER) {
        if (trophies.includes(candidate)) {
          trophyId = candidate
          break
        }
      }
      return {
        ...item,
        trophy_unlocked_id: trophyId,
      }
    }
  )

  return NextResponse.json({
    items: itemsWithTrophy,
    total,
    has_more: hasMore,
  })
}
