'use client'

import { useState } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  submittedAt?: string
  onEditRequest?: () => void
  // Props para modo expansível (ao vivo / encerrado)
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
  homeTeamCode,
  awayTeamCode,
  submittedAt,
  onEditRequest,
  isExpandable = false,
  isExpanded = false,
  onToggle,
  points,
}: PredictionDisplayProps) {
  const [isHovering, setIsHovering] = useState(false)

  const submittedLabel = submittedAt ? `enviado às ${formatSubmittedAt(submittedAt)} BRT` : null
  const showPoints = isExpandable && points != null

  const content = (
    <>
      {/* Ícone de editar — topo direito do card de palpite */}
      {onEditRequest && (
        <button
          type="button"
          title="Editar palpite"
          onClick={(e) => { e.stopPropagation(); onEditRequest() }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'none',
            border: '1px solid var(--color-primary)',
            color: isHovering ? 'var(--color-bg)' : 'var(--color-primary)',
            backgroundColor: isHovering ? 'var(--color-primary)' : 'transparent',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '14px',
            lineHeight: 1,
            padding: '0.2rem 0.35rem',
            cursor: 'pointer',
          }}
        >
          ✎
        </button>
      )}

      {/* Linha superior: título */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-win)',
            fontWeight: 'bold',
          }}
        >
          ✓ SEU PALPITE
        </div>
        {showPoints && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: points > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
              border: `1px solid ${points > 0 ? 'var(--color-accent)' : 'var(--color-muted)'}`,
              backgroundColor: points > 0 ? 'rgba(255, 223, 0, 0.1)' : 'transparent',
              padding: '0.15rem 0.45rem',
              letterSpacing: '0.05em',
            }}
          >
            +{points} PTS {isExpanded ? '▴' : '▾'}
          </div>
        )}
      </div>

      {/* Placar do palpite */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>
          {getTeamFlag(homeTeamCode)}
        </span>
        <span
          style={{
            fontSize: '22px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            letterSpacing: '0.05em',
          }}
        >
          {homeScore} × {awayScore}
        </span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>
          {getTeamFlag(awayTeamCode)}
        </span>
      </div>

      {/* Horário de envio */}
      {submittedLabel && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textAlign: 'center',
            marginTop: '0.35rem',
          }}
        >
          {submittedLabel}
        </div>
      )}

    </>
  )

  if (isExpandable && onToggle) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
        style={{
          position: 'relative',
          border: '1px solid var(--color-primary)',
          backgroundColor: 'var(--color-surface)',
          padding: '0.75rem',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          cursor: 'pointer',
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--color-primary)',
        backgroundColor: 'var(--color-surface)',
        padding: '0.75rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {content}
    </div>
  )
}
