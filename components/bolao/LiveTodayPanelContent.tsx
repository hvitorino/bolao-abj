'use client'

import type { LiveTodayEntry, LiveTodayGame } from '@/lib/hooks/useLiveTodayRanking'
import { getTeamFlag } from '@/lib/utils/teamFlag'

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ---------------------------------------------------------------------------
// Sub-componente: card de jogo do dia (copiado de LiveTodayBottomSheet)
// ---------------------------------------------------------------------------

function LiveTodayGameCard({ game }: { game: LiveTodayGame }) {
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'

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
        border: '1px solid var(--color-border)',
        padding: '0.3rem 0.5rem',
        marginBottom: '0.2rem',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
        }}
      >
        <div style={teamStyle}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>
            {getTeamFlag(game.home_team_code)}
          </span>
          {game.home_team_code}
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {game.status === 'pending'
            ? '— × —'
            : `${game.home_score ?? 0} × ${game.away_score ?? 0}`}
        </div>

        <div style={{ ...teamStyle, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>
            {getTeamFlag(game.away_team_code)}
          </span>
          {game.away_team_code}
        </div>
      </div>

      {(isLive || isFinished) && (
        <div
          style={{
            marginTop: '0.2rem',
            fontFamily: FONT,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isLive ? 'var(--color-live)' : 'var(--color-muted)',
            animation: isLive ? 'blink 1s step-end infinite' : 'none',
          }}
        >
          {isLive ? '● AO VIVO' : '✓ ENCERRADO'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LiveTodayPanelContentProps {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]
  loading: boolean
  currentUserId: string
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LiveTodayPanelContent({
  entries,
  games,
  loading,
  currentUserId,
  onClose: _onClose,
}: LiveTodayPanelContentProps) {
  const hasAnyLiveGame = entries.some((e) => e.hasLiveGame)
  const allZero = entries.length > 0 && entries.every((e) => e.points === 0 && !e.hasLiveGame)

  return (
    <div
      role="region"
      aria-label="Ranking ao vivo do dia"
      style={{ fontFamily: FONT, padding: '1rem' }}
    >
      {/* Sublegenda */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: '11px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '1rem',
        }}
      >
        PONTUAÇÃO DO DIA · AO VIVO
      </div>

      {/* Seção: JOGOS DE HOJE */}
      {games.length > 0 && (
        <>
          <div
            style={{
              fontFamily: FONT,
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              color: 'var(--color-text)',
              letterSpacing: '0.12em',
              marginBottom: '0.4rem',
            }}
          >
            JOGOS DE HOJE
          </div>
          {games.map((g) => (
            <LiveTodayGameCard key={g.id} game={g} />
          ))}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              margin: '0.75rem 0',
            }}
          />
        </>
      )}

      {loading ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '1rem 0',
          }}
        >
          CARREGANDO...
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '1rem 0',
          }}
        >
          SEM PALPITES PARA OS JOGOS DE HOJE
        </div>
      ) : allZero ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '1rem 0',
          }}
        >
          SEM PONTUAÇÃO DISPONÍVEL — AGUARDANDO INÍCIO DOS JOGOS
        </div>
      ) : (
        <>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: FONT,
              fontSize: '13px',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    color: 'var(--color-muted)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    paddingBottom: '0.25rem',
                    fontWeight: 'normal',
                    borderBottom: '1px solid var(--color-border)',
                    width: '2rem',
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    color: 'var(--color-muted)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    paddingBottom: '0.25rem',
                    fontWeight: 'normal',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  PARTICIPANTE
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    color: 'var(--color-muted)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    paddingBottom: '0.25rem',
                    fontWeight: 'normal',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  PTS
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isLeader = entry.rankPosition === 1
                const isCurrentUser = entry.userId === currentUserId

                const nameColor = isLeader
                  ? 'var(--color-accent)'
                  : isCurrentUser
                    ? 'var(--color-primary)'
                    : 'var(--color-text)'

                const ptsColor =
                  entry.hasLiveGame && entry.points > 0
                    ? 'var(--color-live)'
                    : 'var(--color-text)'

                return (
                  <tr key={entry.userId}>
                    <td
                      style={{
                        paddingTop: '0.2rem',
                        paddingBottom: '0.2rem',
                        color: 'var(--color-muted)',
                        verticalAlign: 'middle',
                        width: '2rem',
                      }}
                    >
                      {entry.rankPosition}
                    </td>
                    <td
                      style={{
                        paddingTop: '0.2rem',
                        paddingBottom: '0.2rem',
                        color: nameColor,
                        fontWeight: isLeader ? 'bold' : 'normal',
                        verticalAlign: 'middle',
                      }}
                    >
                      {isLeader ? '► ' : '  '}
                      {entry.name}
                    </td>
                    <td
                      style={{
                        paddingTop: '0.2rem',
                        paddingBottom: '0.2rem',
                        color: ptsColor,
                        textAlign: 'right',
                        verticalAlign: 'middle',
                      }}
                    >
                      {entry.points}
                      {entry.hasLiveGame && entry.points > 0 ? '*' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {hasAnyLiveGame && (
            <div
              style={{
                marginTop: '0.5rem',
                fontFamily: FONT,
                fontSize: '11px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              * PARCIAL — AO VIVO
            </div>
          )}
        </>
      )}
    </div>
  )
}
