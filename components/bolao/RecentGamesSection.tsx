'use client'

import { getTeamFlag } from '@/lib/flags'

export type RecentGame = {
  date: string       // formatado: "14 JUN"
  placar: string     // "3×1"
  adversario: string // "ARG"
  resultado: 'V' | 'E' | 'D'
}

interface RecentGamesSectionProps {
  homeTeamCode: string
  awayTeamCode: string
  homeRecentGames: RecentGame[]
  awayRecentGames: RecentGame[]
}

function resultadoColor(resultado: 'V' | 'E' | 'D'): string {
  if (resultado === 'V') return 'var(--color-win)'
  if (resultado === 'E') return 'var(--color-muted)'
  return 'var(--color-error)'
}

function resultadoBg(resultado: 'V' | 'E' | 'D'): string {
  if (resultado === 'V') return 'rgba(0, 210, 106, 0.12)'
  if (resultado === 'E') return 'rgba(90, 122, 106, 0.12)'
  return 'rgba(255, 69, 58, 0.12)'
}

function GameRow({ game }: { game: RecentGame }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.6rem',
        borderBottom: '1px solid var(--color-border)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Resultado */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 'bold',
          color: resultadoColor(game.resultado),
          backgroundColor: resultadoBg(game.resultado),
          padding: '0.1rem 0.35rem',
          minWidth: '18px',
          textAlign: 'center',
        }}
      >
        {game.resultado}
      </div>

      {/* Adversário */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>
          {getTeamFlag(game.adversario)}
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {game.adversario}
        </span>
      </div>

      {/* Placar */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: 'var(--color-accent)',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}
      >
        {game.placar}
      </div>

      {/* Data */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--color-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {game.date}
      </div>
    </div>
  )
}

function TeamColumn({
  teamCode,
  recentGames,
}: {
  teamCode: string
  recentGames: RecentGame[]
}) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Cabeçalho da coluna */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.45rem 0.6rem',
          fontSize: '10px',
          fontWeight: 'bold',
          color: 'var(--color-bg)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          backgroundColor: 'var(--color-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{teamCode}</span>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>
          {getTeamFlag(teamCode)}
        </span>
      </div>

      {/* Lista de jogos recentes */}
      {recentGames.length === 0 ? (
        <div
          style={{
            padding: '0.75rem 0.6rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            textAlign: 'center',
          }}
        >
          — sem jogos anteriores —
        </div>
      ) : (
        recentGames.map((game, i) => <GameRow key={i} game={game} />)
      )}
    </div>
  )
}

export default function RecentGamesSection({
  homeTeamCode,
  awayTeamCode,
  homeRecentGames,
  awayRecentGames,
}: RecentGamesSectionProps) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Título da seção */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          backgroundColor: 'var(--color-primary)',
          padding: '0.5rem 0.75rem',
          fontSize: '11px',
          fontWeight: 'bold',
          color: 'var(--color-bg)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        ► ÚLTIMOS 3 JOGOS NA COPA 2026
      </div>

      {/* Grid de duas colunas — coluna única em mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0',
        }}
      >
        <TeamColumn
          teamCode={homeTeamCode}
          recentGames={homeRecentGames}
        />
        <TeamColumn
          teamCode={awayTeamCode}
          recentGames={awayRecentGames}
        />
      </div>
    </div>
  )
}
