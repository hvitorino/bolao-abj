'use client'

import { useState } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface PalpitesLiveCardProps {
  todayGames: LiveGameWithPrediction[]
  loading: boolean
  onGameClick: (gameId: string) => void
}

export function PalpitesLiveCard({ todayGames, loading, onGameClick }: PalpitesLiveCardProps) {
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
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}
      >
        {todayGames.map((game) => (
          <GameItem key={game.id} game={game} onGameClick={onGameClick} />
        ))}
      </div>
    </div>
  )
}

function GameItem({
  game,
  onGameClick,
}: {
  game: LiveGameWithPrediction
  onGameClick: (gameId: string) => void
}) {
  const [isPressed, setIsPressed] = useState(false)
  const homeFlag = getTeamFlag(game.home_team_code)
  const awayFlag = getTeamFlag(game.away_team_code)

  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isPending = game.status === 'pending'

  const statusLabel = isLive ? '● AO VIVO' : isFinished ? '✓ ENC' : `◷ ${formatMatchTime(game.match_date)}`
  const statusColor = isLive
    ? 'var(--color-primary)'
    : isFinished
      ? 'var(--color-accent)'
      : 'var(--color-text)'

  const realScore = isPending ? '—×—' : `${game.home_score ?? '?'}×${game.away_score ?? '?'}`
  const predScore = game.myPrediction
    ? `${game.myPrediction.home_score}×${game.myPrediction.away_score}`
    : '—'

  return (
    <button
      onClick={() => onGameClick(game.id)}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      title="Ver análise"
      style={{
        ...MONO,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.1rem',
        opacity: 1,
        background: isPressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        border: 'none',
        outline: '1px solid rgba(90, 122, 106, 0.5)',
        boxShadow: isPressed ? 'none' : '0 2px 6px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        padding: '0.4rem 0.75rem',
        paddingTop: '1.75rem',
        borderRadius: '2px',
        transition: 'background 100ms ease, box-shadow 100ms ease',
      }}
    >
      {/* Indicador de edição — apenas para jogos pendentes */}
      {isPending && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            fontSize: '8px',
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          ✎
        </span>
      )}

      {/* Status */}
      <span
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          fontSize: '11px',
          color: statusColor,
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {statusLabel}
      </span>

      {/* Placar real: 🏴 2×1 🏴 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{homeFlag}</span>
        <span
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: isPending ? 'var(--color-muted)' : 'var(--color-accent)',
          }}
        >
          {realScore}
        </span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{awayFlag}</span>
      </div>

      {/* Palpite: só o placar, sem bandeiras */}
      <span
        style={{
          fontSize: '12px',
          color: game.myPrediction ? 'var(--color-text)' : 'var(--color-muted)',
        }}
      >
        {predScore}
      </span>
    </button>
  )
}

function formatMatchTime(matchDate: string): string {
  try {
    return new Date(matchDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—:——'
  }
}
