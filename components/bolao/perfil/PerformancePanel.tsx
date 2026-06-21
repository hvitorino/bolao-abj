'use client'

import type { SectionState } from './PerfilDashboard'

export interface PerformanceData {
  predictions_made: number
  active_predictions_made: number
  finished_games: number
  winner_correct: number
  exact_correct: number
  total_points: number
  winner_rate: number
  exact_rate: number
  avg_points: number
  group_avg_points: number
  avg_delta: number
  current_streak: number
  best_streak: number
}

interface PerformancePanelProps {
  state: SectionState<PerformanceData>
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
  color: 'var(--color-bg)',
  backgroundColor: 'var(--color-primary)',
  padding: '0.5rem 1rem',
}

const ROW: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderBottom: '1px solid var(--color-border)',
  fontSize: '12px',
}

const LABEL: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  letterSpacing: '0.06em',
  marginBottom: '0.2rem',
}

function renderBar(rate: number, width: number = 10): string {
  const filled = Math.round(rate * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function renderPills(current: number, best: number): React.ReactNode {
  const maxPills = Math.min(Math.max(current, best, 5), 10)
  const pills = []
  for (let i = 0; i < maxPills; i++) {
    const filled = i < current
    pills.push(
      <span
        key={i}
        style={{ color: filled ? 'var(--color-win)' : 'var(--color-muted)' }}
      >
        {filled ? '●' : '○'}
      </span>
    )
  }
  return <span style={{ letterSpacing: '0.1em' }}>{pills}</span>
}

export function PerformancePanel({ state }: PerformancePanelProps) {
  if (state.status === 'loading') {
    return (
      <div style={PANEL}>
        <div style={HEADER}>DESEMPENHO</div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          CARREGANDO...
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={PANEL}>
        <div style={HEADER}>DESEMPENHO</div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-error)', textTransform: 'uppercase' }}>
          ✗ ERRO AO CARREGAR DESEMPENHO
        </div>
      </div>
    )
  }

  const { data } = state
  const hasData = data.active_predictions_made > 0

  const winnerBarColor =
    data.winner_rate >= 0.5 ? 'var(--color-win)' : 'var(--color-muted)'
  const exactBarColor =
    data.exact_rate >= 0.5 ? 'var(--color-win)' : 'var(--color-muted)'

  let avgDeltaNode: React.ReactNode
  if (data.avg_delta > 0) {
    avgDeltaNode = (
      <span style={{ color: 'var(--color-win)' }}>
        ▲ +{data.avg_delta.toFixed(1)}
      </span>
    )
  } else if (data.avg_delta < 0) {
    avgDeltaNode = (
      <span style={{ color: 'var(--color-error)' }}>
        ▼ {data.avg_delta.toFixed(1)}
      </span>
    )
  } else {
    avgDeltaNode = <span style={{ color: 'var(--color-muted)' }}>= GRUPO</span>
  }

  return (
    <div style={PANEL}>
      <div style={HEADER}>DESEMPENHO</div>

      {/* Acerto de vencedor */}
      <div style={ROW}>
        <div style={LABEL}>ACERTO DE VENCEDOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text)', minWidth: '3rem' }}>
            {hasData ? `${(data.winner_rate * 100).toFixed(0)}%` : '—'}
          </span>
          {hasData && (
            <span style={{ color: winnerBarColor, letterSpacing: '0.05em' }}>
              {renderBar(data.winner_rate)}
            </span>
          )}
          {hasData && (
            <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>
              ({data.winner_correct}/{data.active_predictions_made})
            </span>
          )}
        </div>
      </div>

      {/* Placar exato */}
      <div style={ROW}>
        <div style={LABEL}>PLACAR EXATO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text)', minWidth: '3rem' }}>
            {hasData ? `${(data.exact_rate * 100).toFixed(0)}%` : '—'}
          </span>
          {hasData && (
            <span style={{ color: exactBarColor, letterSpacing: '0.05em' }}>
              {renderBar(data.exact_rate)}
            </span>
          )}
          {hasData && (
            <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>
              ({data.exact_correct}/{data.active_predictions_made})
            </span>
          )}
        </div>
      </div>

      {/* Média de pontos */}
      <div style={ROW}>
        <div style={LABEL}>MÉDIA DE PONTOS</div>
        <div>
          <span style={{ color: 'var(--color-text)' }}>
            {hasData ? `${data.avg_points.toFixed(1)} pts/jogo` : '—'}
          </span>
        </div>
        {hasData && (
          <div style={{ fontSize: '11px', marginTop: '0.15rem', color: 'var(--color-muted)' }}>
            GRUPO {data.group_avg_points.toFixed(1)}{' '}
            {avgDeltaNode}
          </div>
        )}
      </div>

      {/* Sequência em pílulas */}
      <div style={{ ...ROW, borderBottom: 'none', paddingBottom: '0.75rem' }}>
        <div style={LABEL}>SEQUÊNCIA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {renderPills(data.current_streak, data.best_streak)}
          <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>
            <span style={{ color: 'var(--color-text)' }}>{data.current_streak}</span> ATUAL
            {' · '}
            <span style={{ color: 'var(--color-text)' }}>{data.best_streak}</span> MELHOR
          </span>
        </div>
      </div>
    </div>
  )
}
