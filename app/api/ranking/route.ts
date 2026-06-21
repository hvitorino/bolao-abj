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

  const groupId = new URL(request.url).searchParams.get('group_id')
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

  const { data, error } = await serviceClient.rpc('get_ranking', { p_group_id: groupId })

  if (error) {
    console.error('[api/ranking] RPC error:', error)
    return NextResponse.json({ error: 'Erro ao buscar ranking.' }, { status: 500 })
  }

  const ranking = (data ?? []).map((entry: {
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
  }))

  return NextResponse.json(ranking)
}
