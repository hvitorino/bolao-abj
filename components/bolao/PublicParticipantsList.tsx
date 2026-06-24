'use client'

import { useEffect, useState } from 'react'
import { ParticipantEntry } from '@/lib/types/participant'
import { calculateLiveScore } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/client'
import type { ScoreBreakdown } from '@/lib/types/score'

interface PublicParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  gameId: string
  liveHomeScore: number | null
  liveAwayScore: number | null
}

/**
 * Tabela pública de palpites e pontuações dos participantes do bolão.
 * Sem accordion de breakdown (simplificado em relação a GameParticipantsList).
 * Sem destacar usuário atual (sem currentUserId na página pública).
 *
 * Visibilidade:
 * - pending: OCULTO (hasPrediction=true) ou PENDENTE (hasPrediction=false); sem coluna PTS
 * - live: palpite real + pontuação provisória calculada no cliente via calculateLiveScore
 * - finished: palpite real + pontuação oficial de scores
 *
 * Realtime de scores (finished): subscreve ao canal public-scores-${gameId} para atualizar
 * pontos quando scores são inseridos/atualizados no Supabase.
 */
export default function PublicParticipantsList({
  participants: initialParticipants,
  gameStatus,
  gameId,
  liveHomeScore,
  liveAwayScore,
}: PublicParticipantsListProps) {
  const [participants, setParticipants] = useState<ParticipantEntry[]>(initialParticipants)

  const showPoints = gameStatus === 'finished'
  const showLivePoints = gameStatus === 'live'
  const isPending = gameStatus === 'pending'

  // Realtime de scores — somente para jogos encerrados
  // (ao vivo, pontuação é calculada no cliente; pending, não há pontuação)
  useEffect(() => {
    if (gameStatus !== 'finished') return

    const supabase = createClient()

    const channel = supabase
      .channel(`public-scores-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newScore = payload.new as {
            user_id: string
            points: number
            breakdown: ScoreBreakdown
          }
          if (!newScore?.user_id) return

          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === newScore.user_id
                ? { ...p, points: newScore.points, breakdown: newScore.breakdown }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, gameStatus])

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho da seção */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              color: 'var(--color-primary)',
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
            padding: '0.75rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          SEM PARTICIPANTES
        </div>
      )}

      {/* Tabela */}
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
                  padding: '0.4rem 0.75rem',
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
                  padding: '0.4rem 0.75rem',
                  borderBottom: '1px solid var(--color-border)',
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
                    padding: '0.4rem 0.75rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {showLivePoints ? 'PTS*' : 'PTS'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => {
              // Visibilidade de palpites em jogos pendentes
              const predictionLabel = isPending
                ? p.hasPrediction
                  ? 'OCULTO'
                  : 'PENDENTE'
                : p.prediction
                  ? `${p.prediction.home_score} × ${p.prediction.away_score}`
                  : '-'

              // Pontuação ao vivo calculada no cliente
              const liveResult =
                showLivePoints && p.prediction && liveHomeScore !== null && liveAwayScore !== null
                  ? calculateLiveScore(
                      {
                        home_score: liveHomeScore,
                        away_score: liveAwayScore,
                      },
                      p.prediction
                    )
                  : null

              const effectivePoints = showLivePoints
                ? (liveResult?.points ?? null)
                : p.points

              const predictionColor = isPending
                ? p.hasPrediction
                  ? 'var(--color-muted)'
                  : 'var(--color-error)'
                : p.prediction
                  ? 'var(--color-accent)'
                  : 'var(--color-muted)'

              const pointsColor =
                p.prediction === null
                  ? 'var(--color-muted)'
                  : effectivePoints !== null && effectivePoints > 0
                    ? 'var(--color-accent)'
                    : 'var(--color-muted)'

              return (
                <tr key={p.userId}>
                  {/* PARTICIPANTE */}
                  <td
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </td>

                  {/* PALPITE */}
                  <td
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      color: predictionColor,
                      textTransform: isPending ? 'uppercase' : undefined,
                      letterSpacing: isPending ? '0.05em' : undefined,
                    }}
                  >
                    {predictionLabel}
                  </td>

                  {/* PTS / PTS* */}
                  {(showPoints || showLivePoints) && (
                    <td
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderBottom: '1px solid var(--color-border)',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: pointsColor,
                      }}
                    >
                      {p.prediction === null
                        ? '-'
                        : effectivePoints !== null
                          ? `+${effectivePoints}`
                          : '-'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Rodapé com legenda para pontuação ao vivo */}
      {showLivePoints && (
        <div
          style={{
            padding: '0.4rem 0.75rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          * PONTUAÇÃO PROVISÓRIA — ATUALIZA EM TEMPO REAL
        </div>
      )}
    </div>
  )
}
