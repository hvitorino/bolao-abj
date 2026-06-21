'use client'

import { useState } from 'react'
import type { SectionState } from './PerfilDashboard'

export interface Trophy {
  id: string
  name: string
  status: 'unlocked' | 'locked' | 'secret'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  secret: boolean
}

export interface TrophiesData {
  trophies: Trophy[]
}

interface TrophiesPanelProps {
  state: SectionState<TrophiesData>
}

const TROPHY_HINTS: Record<string, string> = {
  cravada: 'placares exatos',
  embalado: 'sequência de acertos',
  em_chamas: 'sequência de acertos',
  imparavel: 'sequência de acertos',
  profeta: 'placares exatos',
  vidente: 'acertos de vencedor',
  artilheiro: 'pts acumulados',
  fiel: 'palpitou em todos os jogos do dia',
}

const TROPHY_CRITERIA: Record<string, string> = {
  estreia: 'primeiro palpite enviado',
  abriu_o_placar: 'primeiro acerto de vencedor',
  cravada: 'primeiro placar exato',
  rei_da_goleada: 'primeiro bônus de goleada',
  embalado: 'sequência de 3 acertos de vencedor consecutivos',
  em_chamas: 'sequência de 5 acertos consecutivos',
  imparavel: 'sequência de 8 acertos consecutivos',
  profeta: '5 placares exatos no total',
  vidente: '25 acertos de vencedor no total',
  artilheiro: '100 pontos acumulados no grupo',
  perfeito_na_rodada: 'acertou o vencedor de todos os jogos de um dia',
  fiel: 'palpitou em todos os jogos de um dia',
  cartola: 'já ocupou o 1º lugar do grupo',
  zebreiro: 'acertou o vencedor num jogo em que a maioria errou',
  podio: 'fechou uma rodada no top 3',
}

function renderBar(rate: number, width: number = 5): string {
  const filled = Math.round(rate * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/\./g, '')
}

const PANEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
  marginBottom: '1px',
}

export function TrophiesPanel({ state }: TrophiesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (state.status === 'loading') {
    return (
      <div style={PANEL}>
        <div style={{
          fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-accent)',
          padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)',
        }}>
          TROFÉUS
        </div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          CARREGANDO...
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={PANEL}>
        <div style={{
          fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-accent)',
          padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)',
        }}>
          TROFÉUS
        </div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-error)', textTransform: 'uppercase' }}>
          ✗ ERRO AO CARREGAR TROFÉUS
        </div>
      </div>
    )
  }

  const { trophies } = state.data
  const unlocked = trophies.filter((t) => t.status === 'unlocked')
  const locked = trophies.filter((t) => t.status === 'locked')
  const secret = trophies.filter((t) => t.status === 'secret')

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  function TrophyRow({ trophy }: { trophy: Trophy }) {
    const isExpanded = expandedId === trophy.id
    const baseStyle: React.CSSProperties = {
      padding: '0.4rem 1rem',
      cursor: 'pointer',
      borderBottom: '1px solid var(--color-border)',
      fontSize: '12px',
    }

    if (trophy.status === 'unlocked') {
      return (
        <div
          style={baseStyle}
          onClick={() => toggle(trophy.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggle(trophy.id)}
        >
          <span style={{ color: 'var(--color-win)' }}>✓ {trophy.name}</span>
          {isExpanded && (
            <div style={{ marginTop: '0.25rem', fontSize: '11px', color: 'var(--color-muted)' }}>
              {TROPHY_CRITERIA[trophy.id] ?? ''}
              {trophy.unlocked_at && (
                <span style={{ color: 'var(--color-win)' }}>
                  {' · '}{formatDate(trophy.unlocked_at)}
                </span>
              )}
            </div>
          )}
        </div>
      )
    }

    if (trophy.status === 'locked') {
      const rate =
        trophy.progress !== null && trophy.progress_max
          ? trophy.progress / trophy.progress_max
          : 0
      return (
        <div
          style={baseStyle}
          onClick={() => toggle(trophy.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggle(trophy.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--color-muted)' }}>✗ {trophy.name}</span>
            {trophy.progress !== null && trophy.progress_max && (
              <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                {trophy.progress}/{trophy.progress_max}{' '}
                <span style={{ letterSpacing: '0.05em' }}>{renderBar(rate)}</span>
                {' '}{TROPHY_HINTS[trophy.id] ?? ''}
              </span>
            )}
          </div>
          {isExpanded && (
            <div style={{ marginTop: '0.25rem', fontSize: '11px', color: 'var(--color-muted)' }}>
              {TROPHY_CRITERIA[trophy.id] ?? ''}
            </div>
          )}
        </div>
      )
    }

    // secret
    return (
      <div
        style={baseStyle}
        onClick={() => toggle(trophy.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggle(trophy.id)}
      >
        <span style={{ color: 'var(--color-muted)' }}>🔒 ???</span>
        {isExpanded && (
          <div style={{ marginTop: '0.25rem', fontSize: '11px', color: 'var(--color-muted)' }}>
            troféu secreto — desbloqueie para descobrir
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={PANEL}>
      {/* Header com contagem */}
      <div style={{
        fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--color-accent)',
        padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>TROFÉUS</span>
        <span style={{ color: 'var(--color-muted)' }}>
          {unlocked.length} / {trophies.length}
        </span>
      </div>

      {/* Grid de desbloqueados (2 colunas) */}
      {unlocked.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {unlocked.map((t) => (
            <div
              key={t.id}
              onClick={() => toggle(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggle(t.id)}
              style={{
                padding: '0.4rem 1rem',
                cursor: 'pointer',
                fontSize: '12px',
                borderRight: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span style={{ color: 'var(--color-win)' }}>✓ {t.name}</span>
              {expandedId === t.id && (
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                  {TROPHY_CRITERIA[t.id] ?? ''}
                  {t.unlocked_at && (
                    <span style={{ color: 'var(--color-win)' }}>
                      {' · '}{formatDate(t.unlocked_at)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Separador */}
      {(locked.length > 0 || secret.length > 0) && (
        <div style={{
          padding: '0.25rem 1rem',
          fontSize: '11px',
          color: 'var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          letterSpacing: '0.05em',
        }}>
          {'─'.repeat(44)}
        </div>
      )}

      {/* Locked com progresso */}
      {locked.map((t) => (
        <TrophyRow key={t.id} trophy={t} />
      ))}

      {/* Secretos */}
      {secret.map((t, i) => (
        <div
          key={t.id}
          style={{
            borderBottom: i < secret.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}
        >
          <TrophyRow trophy={t} />
        </div>
      ))}
    </div>
  )
}
