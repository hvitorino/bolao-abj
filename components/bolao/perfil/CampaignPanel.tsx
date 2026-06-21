'use client'

import type { SectionState } from './PerfilDashboard'

export interface CampaignData {
  rank_position: number | null
  total_points: number
  participant_count: number
  leader_points: number | null
  next_above_points: number | null
  position_delta: number | null
  position_delta_label: string
  is_leader: boolean
}

interface CampaignPanelProps {
  state: SectionState<CampaignData>
}

const PANEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
  marginBottom: '1px',
}

const HEADER: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-accent)',
  padding: '0.5rem 1rem',
  borderBottom: '1px solid var(--color-border)',
}

export function CampaignPanel({ state }: CampaignPanelProps) {
  if (state.status === 'loading') {
    return (
      <div style={PANEL}>
        <div style={HEADER}>SUA CAMPANHA</div>
        <div
          style={{
            padding: '1.5rem 1rem',
            fontSize: '12px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
          }}
        >
          CARREGANDO...
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={PANEL}>
        <div style={HEADER}>SUA CAMPANHA</div>
        <div
          style={{
            padding: '1.5rem 1rem',
            fontSize: '12px',
            color: 'var(--color-error)',
            textTransform: 'uppercase',
          }}
        >
          ✗ ERRO AO CARREGAR CAMPANHA
        </div>
      </div>
    )
  }

  const { data } = state
  const { rank_position, total_points, is_leader, leader_points, next_above_points, position_delta, position_delta_label } = data

  const positionColor =
    rank_position === 1 ? 'var(--color-accent)' : 'var(--color-text)'

  let deltaColor = 'var(--color-muted)'
  if (position_delta !== null && position_delta > 0) deltaColor = 'var(--color-win)'
  if (position_delta !== null && position_delta < 0) deltaColor = 'var(--color-error)'

  return (
    <div style={PANEL}>
      <div style={HEADER}>SUA CAMPANHA</div>

      {/* Herói: posição e pontos */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '2.5rem',
          padding: '1.5rem 1rem 1rem',
        }}
      >
        {/* Posição */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: positionColor,
              lineHeight: 1,
            }}
          >
            {rank_position !== null ? `#${rank_position}` : '—'}
          </div>
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              marginTop: '0.25rem',
              letterSpacing: '0.08em',
            }}
          >
            POSIÇÃO
          </div>
        </div>

        {/* Pontos */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              lineHeight: 1,
            }}
          >
            {total_points}
          </div>
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              marginTop: '0.25rem',
              letterSpacing: '0.08em',
            }}
          >
            PTS NO GRUPO
          </div>
        </div>
      </div>

      {/* Distâncias */}
      {is_leader ? (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '12px',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            textAlign: 'center',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          LÍDER 🟡{' '}
          {next_above_points !== null && next_above_points !== undefined
            ? `· +${total_points - next_above_points} SOBRE O 2º`
            : ''}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            padding: '0.5rem 1rem',
            fontSize: '12px',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {leader_points !== null && (
            <span>
              LÍDER{' '}
              <span style={{ color: 'var(--color-text)' }}>{leader_points}</span>
              {' '}
              <span style={{ color: 'var(--color-error)' }}>
                ({total_points - leader_points})
              </span>
            </span>
          )}
          {next_above_points !== null && (
            <span>
              PRÓXIMO{' '}
              <span style={{ color: 'var(--color-text)' }}>{next_above_points}</span>
              {' '}
              <span style={{ color: 'var(--color-error)' }}>
                ({total_points - next_above_points})
              </span>
            </span>
          )}
        </div>
      )}

      {/* Movimento de posição */}
      <div
        style={{
          padding: '0.4rem 1rem 0.6rem',
          fontSize: '11px',
          textTransform: 'uppercase',
          color: deltaColor,
          letterSpacing: '0.05em',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {position_delta_label.toUpperCase()}
      </div>
    </div>
  )
}
