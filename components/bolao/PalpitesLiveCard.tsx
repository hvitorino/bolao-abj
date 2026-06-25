'use client'

import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface PalpitesLiveCardProps {
  todayGames: LiveGameWithPrediction[]
  loading: boolean
}

export function PalpitesLiveCard({ todayGames, loading }: PalpitesLiveCardProps) {
  if (loading) {
    return (
      <div style={{ ...MONO, padding: '0.5rem', fontSize: '10px', color: 'var(--color-muted)', textAlign: 'center' }}>
        CARREGANDO...
      </div>
    )
  }

  if (todayGames.length === 0) {
    return (
      <div style={{ ...MONO, padding: '0.5rem', fontSize: '10px', color: 'var(--color-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        NENHUM JOGO HOJE
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding: '0.6rem 0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.75rem 1.25rem',
        }}
      >
        {todayGames.map((game) => (
          <GameItem key={game.id} game={game} />
        ))}
      </div>
    </div>
  )
}

function GameItem({ game }: { game: LiveGameWithPrediction }) {
  const homeFlag = getTeamFlag(game.home_team_code)
  const awayFlag = getTeamFlag(game.away_team_code)

  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isPending = game.status === 'pending'

  const statusLabel = isLive ? '██ AO VIVO' : isFinished ? 'ENC' : formatMatchTime(game.match_date)
  const statusColor = isLive ? 'var(--color-live)' : 'var(--color-muted)'

  const realScore = isPending ? '—×—' : `${game.home_score ?? '?'}×${game.away_score ?? '?'}`
  const predScore = game.myPrediction
    ? `${game.myPrediction.home_score}×${game.myPrediction.away_score}`
    : '—'

  return (
    <div
      style={{
        ...MONO,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.1rem',
        opacity: isPending ? 0.65 : 1,
      }}
    >
      {/* Status */}
      <span
        style={{
          fontSize: '9px',
          color: statusColor,
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          animation: isLive ? 'blink 1s step-end infinite' : undefined,
        }}
      >
        {statusLabel}
      </span>

      {/* Placar real: 🏴 2×1 🏴 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{homeFlag}</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: isPending ? 'var(--color-muted)' : 'var(--color-accent)',
          }}
        >
          {realScore}
        </span>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{awayFlag}</span>
      </div>

      {/* Palpite: só o placar, sem bandeiras */}
      <span
        style={{
          fontSize: '10px',
          color: game.myPrediction ? 'var(--color-text)' : 'var(--color-error)',
          opacity: 0.7,
        }}
      >
        {predScore}
      </span>
    </div>
  )
}

function formatMatchTime(matchDate: string): string {
  try {
    return new Date(matchDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—:——'
  }
}
