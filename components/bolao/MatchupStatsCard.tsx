'use client'

export type TeamStats = {
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  cleanSheets: number
  gamesScored: number
}

interface MatchupStatsCardProps {
  homeTeam: string
  awayTeam: string
  homeTeamCode: string
  awayTeamCode: string
  homeStats: TeamStats
  awayStats: TeamStats
}

type StatRow = {
  label: string
  home: number | string
  away: number | string
  highlightHome?: boolean
  highlightAway?: boolean
}

function buildRows(home: TeamStats, away: TeamStats): StatRow[] {
  return [
    {
      label: 'JOGOS (V/E/D)',
      home: `${home.wins}/${home.draws}/${home.losses}`,
      away: `${away.wins}/${away.draws}/${away.losses}`,
    },
    {
      label: 'GOLS MARCADOS',
      home: home.goalsFor,
      away: away.goalsFor,
      highlightHome: home.goalsFor > away.goalsFor,
      highlightAway: away.goalsFor > home.goalsFor,
    },
    {
      label: 'GOLS SOFRIDOS',
      home: home.goalsAgainst,
      away: away.goalsAgainst,
      // Menor é melhor — highlight quem sofreu menos
      highlightHome: home.goalsAgainst < away.goalsAgainst,
      highlightAway: away.goalsAgainst < home.goalsAgainst,
    },
    {
      label: 'SALDO DE GOLS',
      home: home.goalDifference >= 0 ? `+${home.goalDifference}` : String(home.goalDifference),
      away: away.goalDifference >= 0 ? `+${away.goalDifference}` : String(away.goalDifference),
      highlightHome: home.goalDifference > away.goalDifference,
      highlightAway: away.goalDifference > home.goalDifference,
    },
    {
      label: 'CLEAN SHEETS',
      home: home.cleanSheets,
      away: away.cleanSheets,
      highlightHome: home.cleanSheets > away.cleanSheets,
      highlightAway: away.cleanSheets > home.cleanSheets,
    },
    {
      label: 'JGS C/ GOL',
      home: home.gamesScored,
      away: away.gamesScored,
      highlightHome: home.gamesScored > away.gamesScored,
      highlightAway: away.gamesScored > home.gamesScored,
    },
  ]
}

export default function MatchupStatsCard({
  homeTeam,
  awayTeam,
  homeTeamCode,
  awayTeamCode,
  homeStats,
  awayStats,
}: MatchupStatsCardProps) {
  const rows = buildRows(homeStats, awayStats)

  const totalGames = (stats: TeamStats) => stats.wins + stats.draws + stats.losses

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header: título da seção */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--color-secondary)',
          fontSize: '11px',
          fontWeight: 'bold',
          color: 'var(--color-text)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        ► ESTATÍSTICAS NA COPA 2026
      </div>

      {/* Cabeçalho dos times */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        {/* Time da casa */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {homeTeam}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.1rem',
            }}
          >
            {homeTeamCode} · {totalGames(homeStats)} jogo{totalGames(homeStats) !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Separador central */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            fontWeight: 'bold',
            padding: '0 0.5rem',
          }}
        >
          ×
        </div>

        {/* Time visitante */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {awayTeam}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.1rem',
            }}
          >
            {awayTeamCode} · {totalGames(awayStats)} jogo{totalGames(awayStats) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Linhas de estatísticas */}
      {rows.map((row, index) => (
        <div
          key={row.label}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '0.45rem 0.75rem',
            borderBottom:
              index < rows.length - 1 ? '1px solid var(--color-border)' : undefined,
            backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(26, 74, 46, 0.1)',
            gap: '0.5rem',
          }}
        >
          {/* Valor do time da casa */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: row.highlightHome ? 'bold' : 'normal',
              color: row.highlightHome ? 'var(--color-win)' : 'var(--color-text)',
            }}
          >
            {row.home}
          </div>

          {/* Label central */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '9px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              padding: '0 0.25rem',
            }}
          >
            {row.label}
          </div>

          {/* Valor do time visitante */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: row.highlightAway ? 'bold' : 'normal',
              color: row.highlightAway ? 'var(--color-win)' : 'var(--color-text)',
            }}
          >
            {row.away}
          </div>
        </div>
      ))}
    </div>
  )
}
