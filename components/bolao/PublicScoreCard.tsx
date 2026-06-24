'use client'

import { Game } from '@/lib/types/game'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface PublicScoreCardProps {
  liveGame: Game
}

function formatMatchHeader(matchDate: string, round: string): string {
  const d = new Date(matchDate)
  const day = d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  }).toUpperCase()
  const time = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${round} · ${day} · ${time} BRT`
}

/**
 * Exibe o placar do jogo com times, bandeiras, status e rodada.
 * Recebe liveGame já atualizado pelo hook useGameRealtime via PublicGameClient.
 */
export default function PublicScoreCard({ liveGame }: PublicScoreCardProps) {
  const isLive = liveGame.status === 'live'
  const isFinished = liveGame.status === 'finished'
  const isPending = liveGame.status === 'pending'

  const hasScore = liveGame.home_score !== null && liveGame.away_score !== null
  const scoreText = hasScore
    ? `${liveGame.home_score} × ${liveGame.away_score}`
    : isLive
      ? '0 × 0'
      : '- × -'

  const cardBorderColor = isLive ? 'var(--color-primary)' : 'var(--color-border)'
  const cardBorderStyle = isFinished ? 'dashed' : 'solid'
  const cardBg = isLive ? 'rgba(0, 156, 59, 0.18)' : 'var(--color-surface)'

  const header = formatMatchHeader(liveGame.match_date, liveGame.round)

  return (
    <div
      style={{
        border: `1px ${cardBorderStyle} ${cardBorderColor}`,
        backgroundColor: cardBg,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header: rodada · data · horário */}
      <div
        style={{
          borderBottom: `1px ${cardBorderStyle} ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {header}
        </span>

        {/* Badge de status */}
        {isLive && (
          <span
            style={{
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--color-primary)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
              animation: 'blink 1s step-end infinite',
            }}
          >
            ■ AO VIVO
          </span>
        )}
        {isPending && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: '1px solid transparent',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            PENDENTE
          </span>
        )}
        {isFinished && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--color-muted)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            □ ENCERRADO
          </span>
        )}
      </div>

      {/* Corpo: times e placar */}
      <div
        style={{
          padding: '1.25rem 0.75rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {/* Time da casa */}
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: '32px', lineHeight: 1 }}>
            {getTeamFlag(liveGame.home_team_code)}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              marginTop: '0.35rem',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 'bold',
            }}
          >
            {liveGame.home_team}
          </div>
        </div>

        {/* Placar central */}
        <div style={{ textAlign: 'center', minWidth: '90px' }}>
          <div
            style={{
              fontSize: hasScore || isLive ? '32px' : '24px',
              fontWeight: 'bold',
              color: hasScore || isLive ? 'var(--color-accent)' : 'var(--color-muted)',
              letterSpacing: '0.05em',
            }}
          >
            {scoreText}
          </div>
        </div>

        {/* Time visitante */}
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: '32px', lineHeight: 1 }}>
            {getTeamFlag(liveGame.away_team_code)}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              marginTop: '0.35rem',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 'bold',
            }}
          >
            {liveGame.away_team}
          </div>
        </div>
      </div>

      {/* Venue/estádio */}
      {liveGame.venue && (
        <div
          style={{
            borderTop: `1px ${cardBorderStyle} ${cardBorderColor}`,
            padding: '0.35rem 0.75rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {liveGame.venue}
        </div>
      )}
    </div>
  )
}
