'use client'

import type { DailyRecapData, RecapGame } from '@/lib/hooks/useDailyRecap'
import { getTeamFlag } from '@/lib/utils/teamFlag'

// ---------------------------------------------------------------------------
// Mensagens lúdicas de abertura (mesmo conjunto do RecapBottomSheet)
// ---------------------------------------------------------------------------

const MENSAGENS = [
  'Ontem foi épico. Veja quem se deu bem (e quem vai apagar o histórico do navegador).',
  'Os jogos de ontem já ficaram no passado. Os pontos, não.',
  'Quem dormiu estudando os palpites... quem não dormiu também está aqui.',
  'Resultado final do dia anterior. Sem spoiler — a tabela abaixo já é o spoiler.',
  'Resumo do ontem: alguns palpites brilharam, outros foram criativos.',
]

const OPENING_MSG = MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)]

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

const S = {
  separator: {
    borderTop: '1px solid var(--color-border)',
    margin: '1rem 0',
  },
  sectionLabel: {
    fontFamily: FONT,
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text)',
    letterSpacing: '0.12em',
    marginBottom: '0.5rem',
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
    borderBottom: '1px solid var(--color-border)',
  },
  thRight: {
    textAlign: 'right' as const,
    color: 'var(--color-muted)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    paddingBottom: '0.25rem',
    fontWeight: 'normal',
    borderBottom: '1px solid var(--color-border)',
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
    marginBottom: '1rem',
    borderLeft: '2px solid var(--color-primary)',
    paddingLeft: '0.75rem',
  },
  badgeLabel: {
    fontFamily: FONT,
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--color-primary)',
    letterSpacing: '0.1em',
  },
  badgeRecipient: {
    fontFamily: FONT,
    fontSize: '15px',
    fontWeight: 'bold',
    color: 'var(--color-accent)',
    marginTop: '0.1rem',
  },
  badgeDesc: {
    fontFamily: FONT,
    fontSize: '12px',
    color: 'var(--color-muted)',
    marginTop: '0.1rem',
  },
}

// ---------------------------------------------------------------------------
// Sub-componente: Card visual de jogo (copiado de RecapBottomSheet)
// ---------------------------------------------------------------------------

function RecapGameCard({ game }: { game: RecapGame }) {
  const teamStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: FONT,
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--color-border)',
        padding: '0.2rem 0.5rem',
        marginBottom: '0.2rem',
        backgroundColor: 'var(--color-bg)',
        gap: '4px',
      }}
    >
      <div style={teamStyle}>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{getTeamFlag(game.home_team_code)}</span>
        {game.home_team_code}
      </div>

      <div
        style={{
          fontFamily: FONT,
          fontSize: '12px',
          fontWeight: 'bold',
          color: 'var(--color-accent)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {game.home_score} × {game.away_score}
      </div>

      <div style={{ ...teamStyle, flexDirection: 'row-reverse' }}>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{getTeamFlag(game.away_team_code)}</span>
        {game.away_team_code}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecapPanelContentProps {
  data: DailyRecapData | null
  currentUserId: string
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecapPanelContent({ data, currentUserId, onClose }: RecapPanelContentProps) {
  return (
    <div
      role="region"
      aria-label="Resumo do dia anterior"
      style={{ fontFamily: FONT, padding: '1rem' }}
    >
      {/* Cabeçalho interno do painel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          ONTEM{data ? ` — ${data.yesterdayLabel}` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: '13px',
            color: 'var(--color-muted)',
            padding: '0 0.25rem',
          }}
          aria-label="Fechar painel"
        >
          [ FECHAR ]
        </button>
      </div>

      {/* Mensagem lúdica */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: '12px',
          color: 'var(--color-muted)',
          lineHeight: 1.5,
          marginBottom: '1rem',
        }}
      >
        {OPENING_MSG}
      </div>

      {data && (
        <>
          {/* ----------------------------------------------------------------
              Seção: JOGOS DE ONTEM
          ---------------------------------------------------------------- */}
          <div style={{ ...S.sectionLabel, color: 'var(--color-muted)' }}>JOGOS DE ONTEM</div>

          {data.games.map((g) => (
            <RecapGameCard key={g.id} game={g} />
          ))}

          <div style={S.separator} />

          {/* ----------------------------------------------------------------
              Seção: RANKING DO DIA
          ---------------------------------------------------------------- */}
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

                let rowBg: string | undefined
                if (isLeader) {
                  rowBg = 'rgba(255, 223, 0, 0.08)'
                } else if (isCurrentUser) {
                  rowBg = 'rgba(0, 156, 59, 0.08)'
                }

                const nameColor = isLeader
                  ? 'var(--color-accent)'
                  : isCurrentUser
                    ? 'var(--color-primary)'
                    : 'var(--color-text)'

                const ptsStyle = isLeader
                  ? { fontSize: '15px', fontWeight: 'bold' as const, color: 'var(--color-accent)' }
                  : {}

                return (
                  <tr key={entry.user_id} style={rowBg ? { backgroundColor: rowBg } : {}}>
                    <td style={{ ...S.td, color: isLeader ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ ...S.td, color: nameColor }}>
                      {isLeader ? '► ' : '  '}
                      {entry.participant_name}
                      {isCurrentUser ? ' (você)' : ''}
                    </td>
                    <td style={{ ...S.tdRight, ...ptsStyle }}>
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
    </div>
  )
}
