import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EspnEvent, EspnScoreboardResponse, SyncResult } from '@/lib/types/espn'
import type { GameStatus } from '@/lib/types/game'

// Mapa de tradução: nome ESPN (inglês) → português
const TEAM_NAME_MAP: Record<string, string> = {
  'Mexico': 'México',
  'United States': 'Estados Unidos',
  'Canada': 'Canadá',
  'Brazil': 'Brasil',
  'Germany': 'Alemanha',
  'France': 'França',
  'Spain': 'Espanha',
  'Portugal': 'Portugal',
  'Argentina': 'Argentina',
  'England': 'Inglaterra',
  'Netherlands': 'Países Baixos',
  'Belgium': 'Bélgica',
  'Switzerland': 'Suíça',
  'Croatia': 'Croácia',
  'Morocco': 'Marrocos',
  'Senegal': 'Senegal',
  'Japan': 'Japão',
  'South Korea': 'Coreia do Sul',
  'Australia': 'Austrália',
  'Ecuador': 'Equador',
  'Ivory Coast': 'Costa do Marfim',
  'Czechia': 'República Tcheca',
  'Turkey': 'Turquia',
  'Serbia': 'Sérvia',
  'Denmark': 'Dinamarca',
  'Uruguay': 'Uruguai',
  'Colombia': 'Colômbia',
  'Peru': 'Peru',
  'Chile': 'Chile',
  'Paraguay': 'Paraguai',
  'Bolivia': 'Bolívia',
  'Venezuela': 'Venezuela',
  'Nigeria': 'Nigéria',
  'Ghana': 'Gana',
  'Cameroon': 'Camarões',
  'Tunisia': 'Tunísia',
  'Algeria': 'Argélia',
  'Egypt': 'Egito',
  'Saudi Arabia': 'Arábia Saudita',
  'Iran': 'Irã',
  'Iraq': 'Iraque',
  'Qatar': 'Catar',
  'South Africa': 'África do Sul',
  'Bosnia-Herzegovina': 'Bósnia e Herzegovina',
  'Scotland': 'Escócia',
  'Wales': 'País de Gales',
  'Ukraine': 'Ucrânia',
  'Poland': 'Polônia',
  'Austria': 'Áustria',
  'Sweden': 'Suécia',
  'Norway': 'Noruega',
  'Haiti': 'Haiti',
  'Curacao': 'Curaçau',
  'Italy': 'Itália',
  'New Zealand': 'Nova Zelândia',
  'Costa Rica': 'Costa Rica',
  'United Arab Emirates': 'Emirados Árabes',
}

// Mapa estático espn_id → grupo (fase de grupos Copa 2026)
// Fonte: ESPN API coletado em 2026-06-24; imutável para a fase de grupos.
const STATIC_ROUND_MAP: Record<string, string> = {
  // Grupo A
  '760414': 'Grupo A', '760415': 'Grupo A', '760438': 'Grupo A',
  '760441': 'Grupo A', '760466': 'Grupo A', '760467': 'Grupo A',
  // Grupo B
  '760416': 'Grupo B', '760420': 'Grupo B', '760439': 'Grupo B',
  '760440': 'Grupo B', '760462': 'Grupo B', '760463': 'Grupo B',
  // Grupo C
  '760418': 'Grupo C', '760419': 'Grupo C', '760444': 'Grupo C',
  '760445': 'Grupo C', '760464': 'Grupo C', '760465': 'Grupo C',
  // Grupo D
  '760417': 'Grupo D', '760421': 'Grupo D', '760442': 'Grupo D',
  '760443': 'Grupo D', '760469': 'Grupo D', '760470': 'Grupo D',
  // Grupo E
  '760422': 'Grupo E', '760423': 'Grupo E', '760446': 'Grupo E',
  '760448': 'Grupo E', '760468': 'Grupo E', '760473': 'Grupo E',
  // Grupo F
  '760424': 'Grupo F', '760425': 'Grupo F', '760447': 'Grupo F',
  '760449': 'Grupo F', '760471': 'Grupo F', '760472': 'Grupo F',
  // Grupo G
  '760426': 'Grupo G', '760427': 'Grupo G', '760451': 'Grupo G',
  '760452': 'Grupo G', '760476': 'Grupo G', '760477': 'Grupo G',
  // Grupo H
  '760428': 'Grupo H', '760429': 'Grupo H', '760450': 'Grupo H',
  '760453': 'Grupo H', '760478': 'Grupo H', '760479': 'Grupo H',
  // Grupo I
  '760430': 'Grupo I', '760432': 'Grupo I', '760454': 'Grupo I',
  '760457': 'Grupo I', '760474': 'Grupo I', '760475': 'Grupo I',
  // Grupo J
  '760431': 'Grupo J', '760433': 'Grupo J', '760455': 'Grupo J',
  '760456': 'Grupo J', '760483': 'Grupo J', '760484': 'Grupo J',
  // Grupo K
  '760435': 'Grupo K', '760436': 'Grupo K', '760459': 'Grupo K',
  '760461': 'Grupo K', '760481': 'Grupo K', '760482': 'Grupo K',
  // Grupo L
  '760434': 'Grupo L', '760437': 'Grupo L', '760458': 'Grupo L',
  '760460': 'Grupo L', '760480': 'Grupo L', '760485': 'Grupo L',
  // 16 avos de Final
  '760486': '16 avos de Final', '760487': '16 avos de Final', '760488': '16 avos de Final',
  '760489': '16 avos de Final', '760490': '16 avos de Final', '760491': '16 avos de Final',
  '760492': '16 avos de Final',
}

// Mapa de tradução: fase ESPN (inglês) → português (para mata-mata)
const ROUND_MAP: Record<string, string> = {
  'Group A': 'Grupo A',
  'Group B': 'Grupo B',
  'Group C': 'Grupo C',
  'Group D': 'Grupo D',
  'Group E': 'Grupo E',
  'Group F': 'Grupo F',
  'Group G': 'Grupo G',
  'Group H': 'Grupo H',
  'Group I': 'Grupo I',
  'Group J': 'Grupo J',
  'Group K': 'Grupo K',
  'Group L': 'Grupo L',
  'Round of 32': '16 avos de Final',
  'Round of 16': 'Oitavas de Final',
  'Quarterfinals': 'Quartas de Final',
  'Semifinals': 'Semifinal',
  'Third Place': 'Terceiro Lugar',
  'Final': 'Final',
}

// Mapa de fallback: displayName ESPN → código de 3 chars
// Usado quando a ESPN retorna abreviação com menos de 3 caracteres
const TEAM_CODE_FALLBACK: Record<string, string> = {
  'Curacao': 'CUR',
  'Germany': 'GER',
  'South Korea': 'KOR',
  'Saudi Arabia': 'KSA',
  'Ivory Coast': 'CIV',
  'Congo DR': 'COD',
  'Cape Verde': 'CPV',
  'Bosnia-Herzegovina': 'BIH',
  'New Zealand': 'NZL',
  'South Africa': 'RSA',
  'Costa Rica': 'CRC',
  'United States': 'USA',
  'United Arab Emirates': 'UAE',
}

function getTeamCode(team: { abbreviation: string; displayName: string }): string {
  const code = team.abbreviation.toUpperCase().slice(0, 3).trim()
  if (code.length === 3) return code
  // Fallback: buscar no mapa de times conhecidos ou derivar do displayName
  const fallback =
    TEAM_CODE_FALLBACK[team.displayName] ??
    team.displayName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  // Garantir sempre 3 chars (pad com 'X' se necessário)
  return fallback.padEnd(3, 'X')
}

function mapStatus(espnState: string): GameStatus {
  switch (espnState) {
    case 'in':
      return 'live'
    case 'post':
      return 'finished'
    default:
      return 'pending'
  }
}

function translateTeam(displayName: string): string {
  return TEAM_NAME_MAP[displayName] ?? displayName
}

function translateRound(headline: string | undefined, matchDate: string): string {
  if (!headline) return getPhase(matchDate)
  return ROUND_MAP[headline] ?? getPhase(matchDate)
}

function formatDateESPN(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function getPhase(matchDate: string): string {
  if (matchDate < '2026-06-28T12:00:00Z') return 'Fase de Grupos'
  if (matchDate < '2026-07-04T12:00:00Z') return '16 avos de Final'
  if (matchDate < '2026-07-08T12:00:00Z') return 'Oitavas de Final'
  if (matchDate < '2026-07-13T12:00:00Z') return 'Quartas de Final'
  if (matchDate < '2026-07-18T12:00:00Z') return 'Semifinal'
  if (matchDate < '2026-07-19T00:00:00Z') return 'Terceiro Lugar'
  return 'Final'
}

interface GameRecord {
  espn_id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  match_date: string
  match_day: string  // data do calendário ESPN (YYYY-MM-DD), usada para agrupamento
  home_score: number | null
  away_score: number | null
  status: GameStatus
  round: string
  phase: string
  venue: string | null
}

function mapEventToGame(event: EspnEvent): GameRecord {
  const competition = event.competitions[0]
  if (!competition) {
    throw new Error('missing competitions data')
  }

  const competitors = competition.competitors
  if (!competitors || competitors.length < 2) {
    throw new Error('missing competitors data')
  }

  const homeCompetitor = competitors.find((c) => c.homeAway === 'home')
  const awayCompetitor = competitors.find((c) => c.homeAway === 'away')

  if (!homeCompetitor || !awayCompetitor) {
    throw new Error('missing home or away competitor')
  }

  const statusState = event.status?.type?.state ?? 'pre'
  const gameStatus = mapStatus(statusState)

  // Placar: NULL para jogos pendentes, inteiro para live/finished
  const isPending = gameStatus === 'pending'
  const homeScore = isPending ? null : parseInt(homeCompetitor.score, 10)
  const awayScore = isPending ? null : parseInt(awayCompetitor.score, 10)

  // Prioridade 1: mapa estático (imutável, não depende de ESPN)
  // Prioridade 2: altGameNote do ESPN (para mata-mata)
  const staticRound = STATIC_ROUND_MAP[event.id]
  let round: string
  if (staticRound) {
    round = staticRound
  } else {
    const altNote = competition.altGameNote
    const altRound = altNote?.includes(',') ? altNote.split(',').pop()?.trim() : altNote?.trim()
    const headline = altRound || competition.notes?.[0]?.headline
    round = translateRound(headline, event.date)
  }
  const venue = competition.venue?.fullName ?? null

  // Calcula match_day em Pacific Time (PDT = UTC-7) — fuso mais a oeste
  // dos locais da Copa 2026. Garante que jogos até 23h local fiquem no
  // dia correto independente do venue (EDT, CDT, MDT ou PDT).
  const matchDay = new Date(new Date(event.date).getTime() - 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return {
    espn_id: event.id,
    home_team: translateTeam(homeCompetitor.team.displayName),
    away_team: translateTeam(awayCompetitor.team.displayName),
    home_team_code: getTeamCode(homeCompetitor.team),
    away_team_code: getTeamCode(awayCompetitor.team),
    match_date: event.date,
    match_day: matchDay,
    home_score: homeScore,
    away_score: awayScore,
    status: gameStatus,
    round,
    phase: getPhase(event.date),
    venue,
  }
}

// Vercel Cron Jobs enviam GET — expor o mesmo handler em ambos os métodos
export async function GET(request: Request) {
  return syncHandler(request)
}

export async function POST(request: Request) {
  return syncHandler(request)
}

async function syncHandler(request: Request) {
  // Validar autenticação: X-Admin-Secret ou Authorization: Bearer <CRON_SECRET>
  const adminSecret = request.headers.get('x-admin-secret')
  const cronAuth = request.headers.get('authorization')

  const isAdmin = adminSecret === process.env.ADMIN_SECRET
  const isCron = cronAuth === `Bearer ${process.env.CRON_SECRET}`

  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ler query params
  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get('days') ?? '7'
  const daysBackParam = searchParams.get('daysBack') ?? '1'
  const cleanParam = searchParams.get('clean') ?? 'false'
  const replaceParam = searchParams.get('replace') ?? 'false'

  const days = parseInt(daysParam, 10)
  const daysBack = parseInt(daysBackParam, 10)
  if (isNaN(days) || days < 1) {
    return NextResponse.json({ error: 'days must be a positive integer' }, { status: 400 })
  }
  if (isNaN(daysBack) || daysBack < 1) {
    return NextResponse.json({ error: 'daysBack must be a positive integer' }, { status: 400 })
  }

  // Aceitar tanto ?clean=true quanto ?replace=true conforme spec e contexto adicional
  const shouldClean = cleanParam === 'true' || replaceParam === 'true'

  // Criar cliente Supabase com service_role (sem contexto de sessão de usuário)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const result: SyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  // Limpar placeholders antes do fetch ESPN (operação destrutiva intencional)
  if (shouldClean) {
    const { error: deleteError, count } = await supabase
      .from('games')
      .delete({ count: 'exact' })
      .is('espn_id', null)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Database error', detail: deleteError.message },
        { status: 500 }
      )
    }
    result.deleted = count ?? 0
  }

  // Calcular range de datas a partir de hoje (UTC)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Começa daysBack dias atrás (default: 1) para re-sincronizar jogos históricos
  for (let i = -daysBack; i < days; i++) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() + i)
    const dateStr = formatDateESPN(date)

    // Buscar dados da ESPN
    let espnData: EspnScoreboardResponse
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`
      )
      if (!response.ok) {
        return NextResponse.json(
          { error: 'ESPN API unavailable', detail: `HTTP ${response.status} for date ${dateStr}` },
          { status: 502 }
        )
      }
      espnData = await response.json()
    } catch (err) {
      return NextResponse.json(
        { error: 'ESPN API unavailable', detail: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      )
    }

    const events = espnData.events ?? []

    for (const event of events) {
      let gameRecord: GameRecord
      try {
        gameRecord = mapEventToGame(event)
      } catch (err) {
        result.errors.push({
          espn_id: event.id ?? 'unknown',
          message: err instanceof Error ? err.message : String(err),
        })
        continue
      }

      // UPSERT por espn_id
      const { error: upsertError, data: upsertData } = await supabase
        .from('games')
        .upsert(gameRecord, { onConflict: 'espn_id' })
        .select('id, created_at')

      if (upsertError) {
        console.error(`[sync-games] Erro ao fazer upsert do evento ${event.id}:`, upsertError)
        result.errors.push({
          espn_id: event.id,
          message: upsertError.message,
        })
        continue
      }

      result.synced++

      // Determinar se foi criação ou atualização com base no created_at
      // O Supabase retorna o registro após upsert; se created_at é recente (< 5s), foi criado agora
      if (upsertData && upsertData.length > 0) {
        const record = upsertData[0]
        const createdAt = new Date(record.created_at).getTime()
        const now = Date.now()
        if (now - createdAt < 5000) {
          result.created++
        } else {
          result.updated++
        }
      } else {
        result.updated++
      }
    }
  }

  return NextResponse.json(result)
}
