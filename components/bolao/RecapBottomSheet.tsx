'use client'

import { useEffect, useState } from 'react'
import type { DailyRecapData } from '@/lib/hooks/useDailyRecap'

// ---------------------------------------------------------------------------
// Mensagens lúdicas de abertura
// ---------------------------------------------------------------------------

const MENSAGENS = [
  'Ontem foi épico. Veja quem se deu bem (e quem vai apagar o histórico do navegador).',
  'Os jogos de ontem já ficaram no passado. Os pontos, não.',
  'Quem dormiu estudando os palpites... quem não dormiu também está aqui.',
  'Resultado final do dia anterior. Sem spoiler — a tabela abaixo já é o spoiler.',
  'Resumo do ontem: alguns palpites brilharam, outros foram criativos.',
]

// Pré-computar mensagem aleatória fora do componente (módulo inicializa uma vez)
const OPENING_MSG = MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)]

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

const S = {
  title: {
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-accent)',
    letterSpacing: '0.1em',
  },
  separator: {
    borderTop: '1px solid var(--color-border)',
    margin: '1rem 0',
  },
  sectionLabel: {
    fontFamily: FONT,
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    letterSpacing: '0.12em',
    marginBottom: '0.5rem',
  },
  openingMsg: {
    fontFamily: FONT,
    fontSize: '12px',
    color: 'var(--color-muted)',
    marginBottom: '0',
    marginTop: '0.5rem',
    lineHeight: 1.6,
  },
  gameRow: {
    fontFamily: FONT,
    fontSize: '13px',
    color: 'var(--color-muted)',
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  gameScore: {
    fontWeight: 'bold',
    color: 'var(--color-accent)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: FONT,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    color: 'var(--color-muted)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    paddingBottom: '0.25rem',
    fontWeight: 'normal',
  },
  thRight: {
    textAlign: 'right' as const,
    color: 'var(--color-muted)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    paddingBottom: '0.25rem',
    fontWeight: 'normal',
  },
  td: {
    paddingTop: '0.2rem',
    paddingBottom: '0.2rem',
    color: 'var(--color-text)',
    verticalAlign: 'middle' as const,
  },
  tdRight: {
    paddingTop: '0.2rem',
    paddingBottom: '0.2rem',
    color: 'var(--color-text)',
    textAlign: 'right' as const,
    verticalAlign: 'middle' as const,
  },
  badgeBlock: {
    marginBottom: '0.75rem',
  },
  badgeLabel: {
    fontFamily: FONT,
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-accent)',
    letterSpacing: '0.1em',
  },
  badgeRecipient: {
    fontFamily: FONT,
    fontSize: '13px',
    color: 'var(--color-text)',
    marginTop: '0.1rem',
  },
  badgeDesc: {
    fontFamily: FONT,
    fontSize: '12px',
    color: 'var(--color-muted)',
    marginTop: '0.1rem',
  },
  closeBtn: {
    background: 'var(--color-primary)',
    color: 'var(--color-bg)',
    fontFamily: FONT,
    textTransform: 'uppercase' as const,
    padding: '0.625rem',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    marginTop: '1rem',
    fontSize: '13px',
    letterSpacing: '0.1em',
    fontWeight: 'bold',
  },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecapBottomSheetProps {
  data: DailyRecapData | null
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecapBottomSheet({ data, currentUserId, isOpen, onClose }: RecapBottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setVisible(true)
        setAnimating(false)
      })
    } else if (visible) {
      queueMicrotask(() => setAnimating(true))
      const timer = setTimeout(() => {
        setVisible(false)
        setAnimating(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Travar scroll do body quando o bottom sheet estiver aberto
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible) return null

  const panelAnimation = animating
    ? 'slideDown 0.3s ease-in forwards'
    : 'slideUp 0.3s ease-out forwards'

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(10, 14, 26, 0.85)',
        }}
      />

      {/* Painel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resumo do dia anterior"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          padding: '1.25rem 1.5rem',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
          fontFamily: FONT,
          animation: panelAnimation,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual */}
        <div
          style={{
            width: '40px',
            height: '3px',
            background: 'var(--color-border)',
            borderRadius: '2px',
            margin: '0 auto 1rem',
          }}
        />

        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <div style={S.title}>
            RESUMO DO DIA{data ? ` — ${data.yesterdayLabel}` : ''}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: '14px',
              color: 'var(--color-muted)',
              padding: '0 0.25rem',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'
            }}
            aria-label="Fechar resumo"
          >
            ✕
          </button>
        </div>

        {/* Mensagem lúdica */}
        <p style={S.openingMsg}>{OPENING_MSG}</p>

        {data && (
          <>
            {/* ----------------------------------------------------------------
                Seção: JOGOS DE ONTEM
            ---------------------------------------------------------------- */}
            <div style={S.separator} />
            <div style={S.sectionLabel}>JOGOS DE ONTEM</div>

            {data.games.map((g) => (
              <div key={g.id} style={S.gameRow}>
                <span style={{ color: 'var(--color-muted)', minWidth: '3ch', textAlign: 'right' }}>
                  {g.home_team_code}
                </span>
                <span style={S.gameScore}>
                  {g.home_score} × {g.away_score}
                </span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {g.away_team_code}
                </span>
              </div>
            ))}

            {/* ----------------------------------------------------------------
                Seção: RANKING DO DIA
            ---------------------------------------------------------------- */}
            <div style={S.separator} />
            <div style={S.sectionLabel}>RANKING DO DIA</div>

            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: '2rem' }}>#</th>
                  <th style={S.th}>PARTICIPANTE</th>
                  <th style={S.thRight}>PTS NO DIA</th>
                  <th style={{ ...S.thRight, paddingLeft: '0.75rem' }}>JOGOS</th>
                </tr>
              </thead>
              <tbody>
                {data.rankingDay.map((entry, idx) => {
                  const isLeader = idx === 0
                  const isCurrentUser = entry.user_id === currentUserId
                  const nameColor = isCurrentUser
                    ? 'var(--color-primary)'
                    : isLeader
                      ? 'var(--color-accent)'
                      : 'var(--color-text)'

                  return (
                    <tr key={entry.user_id}>
                      <td style={{ ...S.td, color: isLeader ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ ...S.td, color: nameColor }}>
                        {isLeader ? '► ' : '  '}
                        {entry.participant_name}
                        {isCurrentUser ? ' (você)' : ''}
                      </td>
                      <td style={{ ...S.tdRight, color: isLeader ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: isLeader ? 'bold' : 'normal' }}>
                        {entry.points_yesterday}
                      </td>
                      <td style={{ ...S.tdRight, paddingLeft: '0.75rem', color: 'var(--color-muted)' }}>
                        {entry.games_predicted}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* ----------------------------------------------------------------
                Seção: DESTAQUES (badges)
            ---------------------------------------------------------------- */}
            {data.badges.length > 0 && (
              <>
                <div style={S.separator} />
                <div style={S.sectionLabel}>DESTAQUES</div>

                {data.badges.map((badge) => (
                  <div key={badge.key} style={S.badgeBlock}>
                    <div style={S.badgeLabel}>[{badge.label}]</div>
                    <div style={S.badgeRecipient}>{badge.recipient}</div>
                    {badge.key === 'mae_dina' && badge.secondaryDescription ? (
                      <>
                        <div style={S.badgeDesc}>{badge.description}</div>
                        <div style={{ ...S.badgeDesc, marginTop: '0.15rem' }}>{badge.secondaryDescription}</div>
                      </>
                    ) : (
                      <div style={S.badgeDesc}>{badge.description}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* Botão fechar */}
        <button style={S.closeBtn} onClick={onClose} type="button">
          FECHAR
        </button>
      </div>
    </>
  )
}
