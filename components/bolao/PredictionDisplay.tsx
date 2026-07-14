'use client'

import React from 'react'

interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  submittedAt?: string
  // Modo expansível (ao vivo / encerrado, com palpite)
  isExpandable?: boolean
  isExpanded?: boolean
  onToggle?: () => void
  points?: number | null
}

function formatSubmittedAt(submittedAt: string): string {
  return new Date(submittedAt).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PredictionDisplay({
  homeScore,
  awayScore,
  submittedAt,
  isExpandable = false,
  isExpanded = false,
  onToggle,
  points,
}: PredictionDisplayProps) {
  const submittedLabel = submittedAt ? `enviado às ${formatSubmittedAt(submittedAt)} BRT` : null
  const showPoints = isExpandable && points != null

  const rootProps = isExpandable && onToggle
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onToggle,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle()
        },
      }
    : {}

  return (
    <div
      {...rootProps}
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        padding: '0.35rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: isExpandable && onToggle ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--color-accent)',
          letterSpacing: '0.05em',
        }}
      >
        {homeScore} × {awayScore}
      </span>

      {showPoints && (
        <div
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            padding: '0.2rem 0.5rem',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            lineHeight: 1.4,
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-accent)',
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          +{points} PTS
          {isExpandable && (
            <span
              style={{
                display: 'inline-block',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 250ms ease',
              }}
            >
              ▾
            </span>
          )}
        </div>
      )}

      {submittedLabel && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            marginLeft: showPoints ? 0 : 'auto',
          }}
        >
          {submittedLabel}
        </span>
      )}
    </div>
  )
}
