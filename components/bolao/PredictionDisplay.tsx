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
}: PredictionDisplayProps) {
  const [isHovering, setIsHovering] = useState(false)

  const submittedLabel = submittedAt ? `enviado às ${formatSubmittedAt(submittedAt)} BRT` : null

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
      {/* Ícone de editar — topo direito do card de palpite */}
      {onEditRequest && (
        <button
          type="button"
          title="Editar palpite"
          onClick={onEditRequest}
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

      {/* Título */}
      <div
        style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-win)',
          marginBottom: '0.5rem',
          fontWeight: 'bold',
        }}
      >
        ✓ SEU PALPITE
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
    </div>
  )
}
