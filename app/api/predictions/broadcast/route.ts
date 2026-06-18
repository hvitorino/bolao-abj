import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

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
  return user
}

interface BroadcastResult {
  group_id: string
  group_name: string
  status: 'saved' | 'deadline_expired'
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Autenticação requerida.' },
      { status: 401 }
    )
  }

  let body: { game_id?: unknown; home_score?: unknown; away_score?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_params', message: 'Body inválido.' },
      { status: 422 }
    )
  }

  const { game_id: gameId, home_score: homeScore, away_score: awayScore } = body

  if (typeof gameId !== 'string' || !isValidUUID(gameId)) {
    return NextResponse.json(
      {
        error: 'invalid_params',
        message: 'game_id é obrigatório e deve ser um UUID válido.',
      },
      { status: 422 }
    )
  }

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    (homeScore as number) < 0 ||
    (awayScore as number) < 0
  ) {
    return NextResponse.json(
      {
        error: 'invalid_params',
        message: 'home_score e away_score são obrigatórios e devem ser inteiros >= 0.',
      },
      { status: 422 }
    )
  }

  const db = serviceClient()

  // Buscar o jogo para verificar deadline global
  const { data: game, error: gameError } = await db
    .from('games')
    .select('id,match_date,status')
    .eq('id', gameId)
    .maybeSingle()

  if (gameError) {
    console.error('[api/predictions/broadcast] game lookup error:', gameError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao verificar jogo.' },
      { status: 500 }
    )
  }

  if (!game) {
    return NextResponse.json(
      { error: 'not_found', message: 'Jogo não encontrado.' },
      { status: 404 }
    )
  }

  if (!game.match_date) {
    return NextResponse.json(
      { error: 'server_error', message: 'Jogo sem data.' },
      { status: 500 }
    )
  }

  // Verificação de deadline global: se o prazo já expirou para este jogo,
  // nenhum grupo pode receber o palpite — retorna 422 imediatamente.
  const deadline = new Date(new Date(game.match_date).getTime() - 5 * 60 * 1000)
  if (new Date() >= deadline) {
    return NextResponse.json(
      {
        error: 'deadline_expired',
        message: 'Prazo encerrado. Não é possível registrar palpite após 5 minutos antes do início.',
      },
      { status: 422 }
    )
  }

  // Buscar todos os grupos do usuário com nome do grupo
  const { data: memberships, error: membershipsError } = await db
    .from('group_members')
    .select('group_id, groups(id, name)')
    .eq('user_id', user.id)

  if (membershipsError) {
    console.error('[api/predictions/broadcast] memberships lookup error:', membershipsError)
    return NextResponse.json(
      { error: 'server_error', message: 'Erro ao buscar grupos do usuário.' },
      { status: 500 }
    )
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      { updated_count: 0, results: [] },
      { status: 200 }
    )
  }

  const results: BroadcastResult[] = []
  let updatedCount = 0

  // Para cada grupo, verificar elegibilidade e fazer UPSERT
  for (const membership of memberships) {
    const groupRaw = membership.groups as unknown
    const groupData = Array.isArray(groupRaw)
      ? (groupRaw[0] as { id: string; name: string } | undefined)
      : (groupRaw as { id: string; name: string } | null)
    const groupId = membership.group_id as string
    const groupName = groupData?.name ?? groupId

    // Verificar se o jogo ainda está pending e dentro do prazo
    // (o deadline é o mesmo para todos os grupos — já verificamos acima,
    //  mas verificamos novamente caso haja edge case de race condition)
    const gameStatus = game.status as string
    if (gameStatus !== 'pending' || new Date() >= deadline) {
      results.push({ group_id: groupId, group_name: groupName, status: 'deadline_expired' })
      continue
    }

    // UPSERT do palpite neste grupo
    const { error: upsertError } = await db
      .from('predictions')
      .upsert(
        {
          user_id: user.id,
          game_id: gameId,
          group_id: groupId,
          home_score: homeScore as number,
          away_score: awayScore as number,
          submitted_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,game_id,group_id',
        }
      )

    if (upsertError) {
      console.error(
        `[api/predictions/broadcast] upsert error for group ${groupId}:`,
        upsertError
      )
      // Não aborta o loop — continua tentando nos outros grupos
      results.push({ group_id: groupId, group_name: groupName, status: 'deadline_expired' })
      continue
    }

    results.push({ group_id: groupId, group_name: groupName, status: 'saved' })
    updatedCount++
  }

  return NextResponse.json({ updated_count: updatedCount, results }, { status: 200 })
}
