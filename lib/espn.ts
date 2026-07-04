const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

const ESPN_NAME_MAP: Record<string, string> = {
  'United States':      'USA',
  'Congo DR':           'DR Congo',
  'Türkiye':            'Turkey',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Curaçao':            'Curacao',
}

function normalizeTeam(name: string): string {
  return ESPN_NAME_MAP[name] ?? name
}

export interface EspnScore {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: 'live' | 'finished' | 'pending'
}

/**
 * Retorna um Map keyed por "homeTeam|awayTeam" com os placares reais da ESPN,
 * incluindo gols de prorrogação que o BDF não expõe.
 * Silencia erros — chamadores devem tratar Map vazio como fallback.
 */
export async function fetchEspnScores(): Promise<Map<string, EspnScore>> {
  const map = new Map<string, EspnScore>()
  try {
    const res = await fetch(ESPN_URL, { cache: 'no-store' })
    if (!res.ok) return map
    const data = await res.json()

    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0]
      if (!comp) continue
      const home = comp.competitors?.find((t: { homeAway: string }) => t.homeAway === 'home')
      const away = comp.competitors?.find((t: { homeAway: string }) => t.homeAway === 'away')
      if (!home || !away) continue

      const homeTeam = normalizeTeam(home.team.displayName)
      const awayTeam = normalizeTeam(away.team.displayName)
      const state: string = comp.status?.type?.state ?? 'pre'

      map.set(`${homeTeam}|${awayTeam}`, {
        homeTeam,
        awayTeam,
        homeScore: parseInt(home.score ?? '0', 10),
        awayScore: parseInt(away.score ?? '0', 10),
        status: state === 'in' ? 'live' : state === 'post' ? 'finished' : 'pending',
      })
    }
  } catch {
    // ESPN indisponível — retorna Map vazio; chamador usa placar do BDF
  }
  return map
}

/** Sobrepõe home_score/away_score de um objeto de jogo com dados da ESPN quando disponível. */
export function overlayEspnScore<T extends { home_team: string; away_team: string; home_score: number | null; away_score: number | null }>(
  match: T,
  espnScores: Map<string, EspnScore>
): T {
  const espn = espnScores.get(`${match.home_team}|${match.away_team}`)
  if (!espn) return match
  return { ...match, home_score: espn.homeScore, away_score: espn.awayScore }
}
