'use client'

import { Fragment, useState } from 'react'
import { ParticipantEntry } from '@/lib/types/participant'
import { calculateLiveScore } from '@/lib/scoring'
import PredictionBreakdown from '@/components/bolao/PredictionBreakdown'

interface GameParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  currentUserId?: string
  liveGame?: { home_score: number | null; away_score: number | null } // placar atual ao vivo
}

export default function GameParticipantsList({
  participants,
  gameStatus,
  currentUserId,
  liveGame,
}: GameParticipantsListProps) {
  const showPoints = gameStatus === 'finished'
  const showLivePoints = gameStatus === 'live'
  const isPending = gameStatus === 'pending'
  const columnCount = showPoints || showLivePoints ? 3 : 2

  // Accordion exclusivo: no máximo uma linha com o detalhamento de
  // breakdown expandido por vez, dentro desta instância de lista
  // (um jogo). Reinicia a cada montagem (ex: ao expandir o card pai).
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null)

  return (
    <div
      style={{
        borderTop: '1px dashed var(--color-border)',
        padding: '0.75rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Título da seção */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          PALPITES DOS PARTICIPANTES
        </span>
        {showLivePoints && (
          <span
            style={{
              fontSize: '9px',
              color: 'var(--color-live)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            AO VIVO
          </span>
        )}
      </div>

      {/* Estado vazio */}
      {participants.length === 0 && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0.25rem 0',
          }}
        >
          SEM PARTICIPANTES
        </div>
      )}

      {/* Tabela de participantes */}
      {participants.length > 0 && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  color: 'var(--color-muted)',
                  fontWeight: 'normal',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                PARTICIPANTE
              </th>
              <th
                style={{
                  textAlign: 'center',
                  color: 'var(--color-muted)',
                  fontWeight: 'normal',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--color-border)',
                  paddingLeft: '0.75rem',
                }}
              >
                PALPITE
              </th>
              {(showPoints || showLivePoints) && (
                <th
                  style={{
                    textAlign: 'right',
                    color: 'var(--color-muted)',
                    fontWeight: 'normal',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingBottom: '0.4rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingLeft: '0.75rem',
                  }}
                >
                  {showLivePoints ? 'PTS*' : 'PTS'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => {
              const isCurrentUser = p.userId === currentUserId
              const shouldHidePrediction = isPending && !isCurrentUser
              const predictionLabel = shouldHidePrediction
                ? p.hasPrediction
                  ? 'OCULTO'
                  : 'PENDENTE'
                : p.prediction
                  ? `${p.prediction.home_score} × ${p.prediction.away_score}`
                  : '-'

              // Para jogos ao vivo: calcula resultado completo (points + breakdown)
              // no cliente. Trata home/away_score null como 0 (placar inicial 0×0).
              const liveResult =
                showLivePoints && p.prediction && liveGame
                  ? calculateLiveScore(
                      {
                        home_score: liveGame.home_score ?? 0,
                        away_score: liveGame.away_score ?? 0,
                      },
                      p.prediction
                    )
                  : null

              const livePoints = liveResult?.points ?? null
              const effectivePoints = showLivePoints ? livePoints : p.points
              const effectiveBreakdown = showLivePoints ? (liveResult?.breakdown ?? null) : p.breakdown

              const isExpandable = p.prediction !== null && effectiveBreakdown !== null
              const isExpanded = expandedUserId === p.userId

              function handleToggle() {
                if (!isExpandable) return
                setExpandedUserId((prev) => (prev === p.userId ? null : p.userId))
              }

              return (
                <Fragment key={p.userId}>
                  <tr
                    onClick={isExpandable ? handleToggle : undefined}
                    onKeyDown={
                      isExpandable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleToggle()
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={isExpandable ? () => setHoveredUserId(p.userId) : undefined}
                    onMouseLeave={isExpandable ? () => setHoveredUserId(null) : undefined}
                    role={isExpandable ? 'button' : undefined}
                    tabIndex={isExpandable ? 0 : undefined}
                    aria-expanded={isExpandable ? isExpanded : undefined}
                    style={{
                      cursor: isExpandable ? 'pointer' : undefined,
                      backgroundColor:
                        isExpandable && hoveredUserId === p.userId
                          ? 'rgba(0, 156, 59, 0.08)'
                          : undefined,
                    }}
                  >
                    {/* Coluna PARTICIPANTE */}
                    <td
                      style={{
                        padding: '0.35rem 0',
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        maxWidth: '120px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.35rem',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isCurrentUser && (
                            <span
                              style={{
                                color: 'var(--color-primary)',
                                marginRight: '0.35rem',
                                fontWeight: 'bold',
                              }}
                            >
                              &#9632;
                            </span>
                          )}
                          {p.name}
                        </span>
                      </div>
                    </td>

                    {/* Coluna PALPITE */}
                    <td
                      style={{
                        padding: '0.35rem 0',
                        paddingLeft: '0.75rem',
                        borderBottom: '1px solid var(--color-border)',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        color: shouldHidePrediction
                          ? p.hasPrediction
                            ? 'var(--color-muted)'
                            : 'var(--color-error)'
                          : p.prediction
                            ? 'var(--color-accent)'
                            : 'var(--color-muted)',
                        textTransform: shouldHidePrediction ? 'uppercase' : undefined,
                        letterSpacing: shouldHidePrediction ? '0.05em' : undefined,
                      }}
                    >
                      {predictionLabel}
                    </td>

                    {/* Coluna PTS — pontuação oficial (finished) ou provisória (live) */}
                    {showPoints && (
                      <td
                        style={{
                          padding: '0.35rem 0',
                          paddingLeft: '0.75rem',
                          borderBottom: '1px solid var(--color-border)',
                          textAlign: 'right',
                        }}
                      >
                        {isExpandable && p.points !== null ? (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              letterSpacing: '0.05em',
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-bg)',
                              lineHeight: 1.4,
                              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            }}
                          >
                            +{p.points} {isExpanded ? '▴' : '▾'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 'bold',
                              color:
                                p.prediction === null
                                  ? 'var(--color-muted)'
                                  : p.points !== null && p.points > 0
                                    ? 'var(--color-accent)'
                                    : 'var(--color-muted)',
                            }}
                          >
                            {p.prediction === null ? '-' : p.points !== null ? `+${p.points}` : '-'}
                          </span>
                        )}
                      </td>
                    )}
                    {showLivePoints && (
                      <td
                        style={{
                          padding: '0.35rem 0',
                          paddingLeft: '0.75rem',
                          borderBottom: '1px solid var(--color-border)',
                          textAlign: 'right',
                        }}
                      >
                        {isExpandable && livePoints !== null ? (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              letterSpacing: '0.05em',
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'var(--color-live)',
                              color: 'var(--color-bg)',
                              lineHeight: 1.4,
                              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            }}
                          >
                            +{livePoints} {isExpanded ? '▴' : '▾'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 'bold',
                              color:
                                p.prediction === null
                                  ? 'var(--color-muted)'
                                  : livePoints !== null && livePoints > 0
                                    ? 'var(--color-live)'
                                    : 'var(--color-muted)',
                            }}
                          >
                            {p.prediction === null ? '-' : livePoints !== null ? `+${livePoints}` : '-'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && effectiveBreakdown && effectivePoints !== null && (
                    <tr>
                      <td
                        colSpan={columnCount}
                        style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}
                      >
                        <PredictionBreakdown points={effectivePoints} breakdown={effectiveBreakdown} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
