import { ParticipantEntry } from '@/lib/types/participant'

interface GameParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  currentUserId?: string
}

export default function GameParticipantsList({
  participants,
  gameStatus,
  currentUserId,
}: GameParticipantsListProps) {
  const showPoints = gameStatus === 'finished'
  const isPending = gameStatus === 'pending'

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
          fontSize: '10px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '0.5rem',
        }}
      >
        PALPITES DOS PARTICIPANTES
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
              {showPoints && (
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
                  PTS
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => {
              const isCurrentUser = p.userId === currentUserId
              const shouldHidePrediction = isPending && !isCurrentUser
              const predictionLabel = shouldHidePrediction
                ? 'OCULTO'
                : p.prediction
                  ? `${p.prediction.home_score} × ${p.prediction.away_score}`
                  : '-'

              return (
                <tr key={p.userId}>
                  {/* Coluna PARTICIPANTE */}
                  <td
                    style={{
                      padding: '0.35rem 0',
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
                      color:
                        shouldHidePrediction || p.prediction
                          ? 'var(--color-accent)'
                          : 'var(--color-muted)',
                      textTransform: shouldHidePrediction ? 'uppercase' : undefined,
                      letterSpacing: shouldHidePrediction ? '0.05em' : undefined,
                    }}
                  >
                    {predictionLabel}
                  </td>

                  {/* Coluna PTS — somente quando jogo encerrado */}
                  {showPoints && (
                    <td
                      style={{
                        padding: '0.35rem 0',
                        paddingLeft: '0.75rem',
                        borderBottom: '1px solid var(--color-border)',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color:
                          p.prediction === null
                            ? 'var(--color-muted)'
                            : p.points !== null && p.points > 0
                              ? 'var(--color-accent)'
                              : 'var(--color-muted)',
                      }}
                    >
                      {p.prediction === null
                        ? '-'
                        : p.points !== null
                          ? `+${p.points}`
                          : '-'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
