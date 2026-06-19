'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecapKey(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = nowBRT.getUTCFullYear()
  const mm = String(nowBRT.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowBRT.getUTCDate()).padStart(2, '0')
  return `bolao_recap_${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Estilos inline reutilizáveis
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

const S = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(10,14,26,0.88)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 201,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    padding: '1.5rem',
    width: 'min(90vw, 520px)',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    fontFamily: FONT,
  },
  title: {
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-accent)',
    letterSpacing: '0.1em',
    marginBottom: '0.5rem',
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
    padding: '0.5rem 2rem',
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

interface DailyRecapModalProps {
  groupId: string
  currentUserId: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DailyRecapModal({ groupId, currentUserId }: DailyRecapModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data, loading, hasData } = useDailyRecap(groupId)

  // Mensagem de abertura determinística por sessão
  const openingMsg = useMemo(
    () => MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)],
    []
  )

  useEffect(() => {
    if (loading) return

    const key = getRecapKey()

    // Se já foi exibido hoje, não abrir — independente de ter dados
    if (typeof window !== 'undefined' && localStorage.getItem(key) === 'shown') {
      return
    }

    // Gravar chave independente de hasData (não re-verificar depois)
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, 'shown')
    }

    // Só abrir se houver dados
    if (hasData) {
      setIsOpen(true)
    }
  }, [loading, hasData])

  const handleClose = () => setIsOpen(false)

  if (!isOpen || !data) return null

  return (
    <>
      {/* Backdrop — clique fora fecha */}
      <div
        style={S.backdrop}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Container do modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resumo do dia anterior"
        style={S.container}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Título */}
        <div style={S.title}>RESUMO DO DIA — {data.yesterdayLabel}</div>

        {/* Mensagem lúdica */}
        <p style={S.openingMsg}>{openingMsg}</p>

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
                <div style={S.badgeDesc}>{badge.description}</div>
              </div>
            ))}
          </>
        )}

        {/* Botão fechar */}
        <button style={S.closeBtn} onClick={handleClose} type="button">
          FECHAR
        </button>
      </div>
    </>
  )
}
