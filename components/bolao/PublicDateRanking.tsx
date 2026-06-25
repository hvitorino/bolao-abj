interface RankingParticipant {
  userId: string
  name: string
  officialPoints: number
  livePoints: number
  hasLivePoints: boolean
}

interface PublicDateRankingProps {
  participants: RankingParticipant[]
}

/**
 * Ranking do dia na página pública por data.
 * Exibe pontos oficiais (jogos finished) + pontos ao vivo provisórios (jogos live).
 * Sem animação FLIP — versão simplificada para a página pública.
 */
export default function PublicDateRanking({ participants }: PublicDateRankingProps) {
  const sorted = [...participants].sort((a, b) => {
    const totalA = a.officialPoints + a.livePoints
    const totalB = b.officialPoints + b.livePoints
    if (totalA !== totalB) return totalB - totalA
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  const hasAnyLivePoints = sorted.some((p) => p.hasLivePoints)

  if (sorted.length === 0) return null

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho */}
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
          RANKING DO DIA
        </span>
        {hasAnyLivePoints && (
          <span
            style={{
              fontSize: '9px',
              color: 'var(--color-live)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ★ INCLUI PONTOS AO VIVO
          </span>
        )}
      </div>

      {/* Tabela */}
      <div role="table" aria-label="Ranking do dia" style={{ width: '100%', fontSize: '11px' }}>
        {/* Cabeçalho da tabela */}
        <div role="rowgroup">
          <div
            role="row"
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div
              role="columnheader"
              style={{
                flex: '0 0 32px',
                textAlign: 'center',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.4rem 0.5rem',
              }}
            >
              #
            </div>
            <div
              role="columnheader"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                textAlign: 'left',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.4rem 0.5rem',
              }}
            >
              PARTICIPANTE
            </div>
            <div
              role="columnheader"
              style={{
                flex: '0 0 auto',
                minWidth: '60px',
                textAlign: 'right',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.4rem 0.75rem',
              }}
            >
              PONTOS
            </div>
          </div>
        </div>

        {/* Corpo da tabela */}
        <div role="rowgroup">
          {sorted.map((participant, index) => {
            const isLeader = index === 0
            const totalPoints = participant.officialPoints + participant.livePoints

            return (
              <div
                key={participant.userId}
                role="row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {/* Posição */}
                <div
                  role="cell"
                  style={{
                    flex: '0 0 32px',
                    textAlign: 'center',
                    padding: '0.35rem 0.5rem',
                    fontSize: '11px',
                    color: isLeader ? 'var(--color-accent)' : 'var(--color-muted)',
                    fontWeight: isLeader ? 'bold' : 'normal',
                  }}
                >
                  {index + 1}
                </div>

                {/* Nome com seta líder */}
                <div
                  role="cell"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    padding: '0.35rem 0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    overflow: 'hidden',
                  }}
                >
                  {isLeader && (
                    <span
                      style={{
                        color: 'var(--color-accent)',
                        fontWeight: 'bold',
                        flexShrink: 0,
                        fontSize: '11px',
                      }}
                    >
                      ►
                    </span>
                  )}
                  <span
                    style={{
                      color: 'var(--color-text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {participant.name}
                  </span>
                </div>

                {/* Pontos + badge ao vivo */}
                <div
                  role="cell"
                  style={{
                    flex: '0 0 auto',
                    minWidth: '60px',
                    padding: '0.35rem 0.75rem',
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.35rem',
                  }}
                >
                  {participant.hasLivePoints && (
                    <span
                      style={{
                        fontSize: '9px',
                        color: 'var(--color-live)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        flexShrink: 0,
                      }}
                    >
                      ★ AO VIVO
                    </span>
                  )}
                  <span
                    style={{
                      fontWeight: 'bold',
                      color: totalPoints > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                      fontSize: '13px',
                    }}
                  >
                    {totalPoints}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rodapé: nota sobre pontuação provisória */}
      {hasAnyLivePoints && (
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
          * PONTOS AO VIVO SÃO PROVISÓRIOS
        </div>
      )}
    </div>
  )
}
