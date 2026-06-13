import { NextRequest, NextResponse } from 'next/server'
import { isValidDateString, todayInBrasilia } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verificar autenticação
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Ler parâmetro de data
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  let date: string

  if (dateParam) {
    if (!isValidDateString(dateParam)) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' }, { status: 400 })
    }
    date = dateParam
  } else {
    date = todayInBrasilia()
  }

  // Buscar jogos do dia no Supabase
  // Filtra por match_date::date = $date (comparando apenas a parte da data)
  const startOfDay = `${date}T00:00:00Z`
  const endOfDay = `${date}T23:59:59Z`

  const { data: games, error: dbError } = await supabase
    .from('games')
    .select('*')
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)
    .order('match_date', { ascending: true })

  if (dbError) {
    console.error('[api/games] Erro no Supabase:', dbError)
    return NextResponse.json({ error: 'Erro interno ao buscar jogos.' }, { status: 500 })
  }

  return NextResponse.json(games ?? [])
}
