'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProfileStatsProps {
  groupId: string
  userId: string
}

interface ProfileData {
  user_name: string
  group_name: string
  predictions_made: number
  finished_games: number
  winner_correct: number
  exact_correct: number
  total_points: number
  winner_rate: number
  exact_rate: number
  avg_points: number
  current_streak: number
  best_streak: number
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'populated'; data: ProfileData }

function formatPercent(rate: number, count: number, total: number, hasData: boolean): string {
  if (!hasData) return '—'
  return `${(rate * 100).toFixed(1)}%  (${count}/${total})`
}

function formatStreak(n: number): { text: string; dimmed: boolean } {
  return { text: `${n} acertos`, dimmed: n === 0 }
}

const PANEL_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
  maxWidth: '520px',
  width: '100%',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.5rem',
  padding: '0.45rem 1rem',
  flexWrap: 'wrap',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  minWidth: '11rem',
  flexShrink: 0,
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: 'var(--color-text)',
}

const DIVIDER_STYLE: React.CSSProperties = {
  borderTop: '1px solid var(--color-border)',
  margin: 0,
}

export function ProfileStats({ groupId, userId }: ProfileStatsProps) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setState({ status: 'error' })
          return
        }

        const res = await fetch(`/api/profile/stats?group_id=${encodeURIComponent(groupId)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!res.ok) {
          setState({ status: 'error' })
          return
        }

        const data: ProfileData = await res.json()
        setState({ status: 'populated', data })
      } catch {
        setState({ status: 'error' })
      }
    }

    fetchStats()
  }, [groupId, userId])

  if (state.status === 'loading') {
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '13px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          padding: '1.5rem 0',
        }}
      >
        CARREGANDO...
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '13px',
          color: 'var(--color-error)',
          textTransform: 'uppercase',
          padding: '1.5rem 0',
        }}
      >
        ✗ ERRO AO CARREGAR ESTATÍSTICAS
      </div>
    )
  }

  const { data } = state
  const hasData = data.predictions_made > 0

  const winnerStreakCurrent = formatStreak(data.current_streak)
  const winnerStreakBest = formatStreak(data.best_streak)

  return (
    <div style={PANEL_STYLE}>
      {/* Cabeçalho */}
      <div
        style={{
          padding: '0.75rem 1rem 0.5rem',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
          }}
        >
          PERFIL — {data.user_name.toUpperCase()}
        </div>
      </div>

      {/* Subheader: grupo */}
      <div
        style={{
          padding: '0.4rem 1rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-muted)',
          }}
        >
          GRUPO: {data.group_name.toUpperCase()}
        </div>
      </div>

      {/* Estatísticas */}
      <div>
        {/* Palpites feitos */}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>PALPITES FEITOS</span>
          <span style={VALUE_STYLE}>
            {data.predictions_made} / {data.finished_games} jogos
          </span>
        </div>

        <hr style={DIVIDER_STYLE} />

        {/* Acerto de vencedor */}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>ACERTO DE VENCEDOR</span>
          <span
            style={{
              ...VALUE_STYLE,
              color: !hasData
                ? 'var(--color-muted)'
                : data.winner_rate >= 0.5
                  ? 'var(--color-win)'
                  : 'var(--color-muted)',
            }}
          >
            {formatPercent(data.winner_rate, data.winner_correct, data.predictions_made, hasData)}
          </span>
        </div>

        <hr style={DIVIDER_STYLE} />

        {/* Placar exato */}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>PLACAR EXATO</span>
          <span
            style={{
              ...VALUE_STYLE,
              color: !hasData
                ? 'var(--color-muted)'
                : data.exact_rate >= 0.5
                  ? 'var(--color-win)'
                  : 'var(--color-muted)',
            }}
          >
            {formatPercent(data.exact_rate, data.exact_correct, data.predictions_made, hasData)}
          </span>
        </div>

        <hr style={DIVIDER_STYLE} />

        {/* Média de pontos */}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>MÉDIA DE PONTOS</span>
          <span style={VALUE_STYLE}>
            {hasData ? `${data.avg_points.toFixed(1)} pts/jogo` : '—'}
          </span>
        </div>

        <hr style={DIVIDER_STYLE} />

        {/* Sequência atual */}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>SEQUÊNCIA ATUAL</span>
          <span
            style={{
              ...VALUE_STYLE,
              color: winnerStreakCurrent.dimmed ? 'var(--color-muted)' : 'var(--color-text)',
            }}
          >
            {winnerStreakCurrent.text}
          </span>
        </div>

        <hr style={DIVIDER_STYLE} />

        {/* Melhor sequência */}
        <div style={{ ...ROW_STYLE, paddingBottom: '0.75rem' }}>
          <span style={LABEL_STYLE}>MELHOR SEQUÊNCIA</span>
          <span
            style={{
              ...VALUE_STYLE,
              color: winnerStreakBest.dimmed ? 'var(--color-muted)' : 'var(--color-text)',
            }}
          >
            {winnerStreakBest.text}
          </span>
        </div>
      </div>
    </div>
  )
}
