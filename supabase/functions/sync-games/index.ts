import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TEAM_MAP: Record<string, string> = {
  'Mexico': 'México', 'United States': 'Estados Unidos', 'Canada': 'Canadá',
  'Brazil': 'Brasil', 'Germany': 'Alemanha', 'France': 'França',
  'Spain': 'Espanha', 'Portugal': 'Portugal', 'Argentina': 'Argentina',
  'England': 'Inglaterra', 'Netherlands': 'Países Baixos', 'Belgium': 'Bélgica',
  'Switzerland': 'Suíça', 'Croatia': 'Croácia', 'Morocco': 'Marrocos',
  'Japan': 'Japão', 'South Korea': 'Coreia do Sul', 'Australia': 'Austrália',
  'Ecuador': 'Equador', 'Ivory Coast': 'Costa do Marfim', 'Czechia': 'República Tcheca',
  'Turkey': 'Turquia', 'Serbia': 'Sérvia', 'Denmark': 'Dinamarca',
  'Uruguay': 'Uruguai', 'Colombia': 'Colômbia', 'Paraguay': 'Paraguai',
  'Bolivia': 'Bolívia', 'Venezuela': 'Venezuela', 'Nigeria': 'Nigéria',
  'Ghana': 'Gana', 'Cameroon': 'Camarões', 'Tunisia': 'Tunísia',
  'Algeria': 'Argélia', 'Egypt': 'Egito', 'Saudi Arabia': 'Arábia Saudita',
  'Iran': 'Irã', 'Qatar': 'Catar', 'South Africa': 'África do Sul',
  'Bosnia-Herzegovina': 'Bósnia e Herzegovina', 'Scotland': 'Escócia',
  'Italy': 'Itália', 'New Zealand': 'Nova Zelândia', 'Haiti': 'Haiti',
  'Curacao': 'Curaçau', 'Sweden': 'Suécia', 'Poland': 'Polônia',
  'Ukraine': 'Ucrânia', 'Costa Rica': 'Costa Rica', 'Norway': 'Noruega',
}

const ROUND_MAP: Record<string, string> = {
  'Group A': 'Grupo A', 'Group B': 'Grupo B', 'Group C': 'Grupo C',
  'Group D': 'Grupo D', 'Group E': 'Grupo E', 'Group F': 'Grupo F',
  'Group G': 'Grupo G', 'Group H': 'Grupo H', 'Group I': 'Grupo I',
  'Group J': 'Grupo J', 'Group K': 'Grupo K', 'Group L': 'Grupo L',
  'Round of 32': '16 avos de Final', 'Round of 16': 'Oitavas de Final',
  'Quarterfinals': 'Quartas de Final', 'Semifinals': 'Semifinal',
  'Third Place': 'Terceiro Lugar', 'Final': 'Final',
}

function getPhase(matchDate: string): string {
  const d = matchDate
  if (d < '2026-06-28T12:00:00Z') return 'Fase de Grupos'
  if (d < '2026-07-04T12:00:00Z') return '16 avos de Final'
  if (d < '2026-07-08T12:00:00Z') return 'Oitavas de Final'
  if (d < '2026-07-13T12:00:00Z') return 'Quartas de Final'
  if (d < '2026-07-18T12:00:00Z') return 'Semifinal'
  if (d < '2026-07-19T00:00:00Z') return 'Terceiro Lugar'
  return 'Final'
}

function mapStatus(state: string): 'pending' | 'live' | 'finished' {
  if (state === 'in') return 'live'
  if (state === 'post') return 'finished'
  return 'pending'
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)
  const days = Math.max(1, parseInt(url.searchParams.get('days') ?? '2', 10))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let synced = 0
  const errors: string[] = []

  // Começa 1 dia atrás para re-sincronizar jogos que terminaram após meia-noite UTC
  for (let i = -1; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() + i)
    const dateStr = formatDate(d)

    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`,
    )
    if (!res.ok) { errors.push(`ESPN ${dateStr}: HTTP ${res.status}`); continue }

    const data = await res.json()
    const events: unknown[] = data.events ?? []

    for (const ev of events as Record<string, unknown>[]) {
      try {
        const comp = (ev.competitions as Record<string, unknown>[])?.[0]
        const competitors = comp?.competitors as Record<string, unknown>[]
        const home = competitors?.find((c) => c.homeAway === 'home')
        const away = competitors?.find((c) => c.homeAway === 'away')
        if (!home || !away) { errors.push(String(ev.id)); continue }

        const statusType = (ev.status as Record<string, unknown>)?.type as Record<string, string>
        const status = mapStatus(statusType?.state ?? 'pre')
        const isPending = status === 'pending'
        const headline = (comp?.notes as Record<string, string>[])?.[0]?.headline

        const homeTeam = home.team as Record<string, string>
        const awayTeam = away.team as Record<string, string>

        const game = {
          espn_id: String(ev.id),
          home_team: TEAM_MAP[homeTeam.displayName] ?? homeTeam.displayName,
          away_team: TEAM_MAP[awayTeam.displayName] ?? awayTeam.displayName,
          home_team_code: homeTeam.abbreviation.toUpperCase().slice(0, 3),
          away_team_code: awayTeam.abbreviation.toUpperCase().slice(0, 3),
          match_date: String(ev.date),
          match_day: new Date(new Date(String(ev.date)).getTime() - 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
          home_score: isPending ? null : parseInt(String(home.score), 10),
          away_score: isPending ? null : parseInt(String(away.score), 10),
          status,
          round: ROUND_MAP[headline ?? ''] ?? getPhase(String(ev.date)),
          phase: getPhase(String(ev.date)),
          venue: (comp?.venue as Record<string, string>)?.fullName ?? null,
        }

        const { error } = await supabase
          .from('games')
          .upsert(game, { onConflict: 'espn_id' })

        if (error) { errors.push(`${ev.id}: ${error.message}`); continue }
        synced++
      } catch (e) {
        errors.push(`${ev.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return new Response(
    JSON.stringify({ synced, errors }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
