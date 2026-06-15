'use client'

import { useState } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  submittedAt?: string // ISO 8601
  // Props para edição
  matchDate?: string // ISO 8601 — para verificar deadline no frontend
  onEditRequest?: () => void // Callback chamado ao clicar em "EDITAR"
}

// Formata horário de envio em BRT
function formatSubmittedAt(submittedAt: string): string {
  return new Date(submittedAt).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Verifica se o deadline já passou (5 min antes do jogo)
function isDeadlinePassed(matchDate: string): boolean {
  const deadline = new Date(matchDate).getTime() - 5 * 60 * 1000
  return Date.now() >= deadline
}

export default function PredictionDisplay({
  homeScore,
  awayScore,
  homeTeamCode,
  awayTeamCode,
  submittedAt,
  matchDate,
  onEditRequest,
}: PredictionDisplayProps) {
  const [isHoveringEdit, setIsHoveringEdit] = useState(false)

  // Botão de editar só aparece se: onEditRequest está definido, matchDate está definido
  // e o deadline ainda não passou
  const canEdit =
    onEditRequest != null &&
    matchDate != null &&
    !isDeadlinePassed(matchDate)

  // Formatar label do horário de envio — diferencia "enviado" vs "editado"
  // Não há como distinguir entre criação e edição via submitted_at, então sempre exibe genérico
  const submittedLabel = submittedAt ? `enviado às ${formatSubmittedAt(submittedAt)} BRT` : null

  return (
    <div
      style={{
        border: '1px solid var(--color-primary)',
        backgroundColor: 'var(--color-surface)',
        padding: '0.75rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
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

      {/* Botão EDITAR — somente visível antes do deadline */}
      {canEdit && (
        <button
          type="button"
          onClick={onEditRequest}
          onMouseEnter={() => setIsHoveringEdit(true)}
          onMouseLeave={() => setIsHoveringEdit(false)}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            padding: '0.35rem',
            border: '1px solid var(--color-primary)',
            backgroundColor: isHoveringEdit ? 'var(--color-primary)' : 'transparent',
            color: isHoveringEdit ? 'var(--color-bg)' : 'var(--color-primary)',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          ✎ EDITAR PALPITE
        </button>
      )}
    </div>
  )
}
