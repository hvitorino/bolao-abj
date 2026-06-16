const SCORING_RULES = [
  {
    event: 'Acerto do vencedor',
    points: 3,
    note: 'base obrigatória para bônus cumulativos',
    highlight: true,
  },
  {
    event: 'Placar exato',
    points: 5,
    note: 'requer acerto do vencedor',
    highlight: false,
  },
  {
    event: 'Somente placar do vencedor',
    points: 3,
    note: 'acertou o placar do time que ganhou',
    highlight: false,
  },
  {
    event: 'Diferença de gols correta',
    points: 2,
    note: 'requer acerto do vencedor',
    highlight: false,
  },
  {
    event: 'Somente placar do perdedor',
    points: 1,
    note: 'requer acerto do vencedor',
    highlight: false,
  },
  {
    event: 'Goleada',
    points: 1,
    note: 'vencedor no palpite fez 4+ gols E diferença real >= 4 gols',
    highlight: false,
  },
]

// Máximo real calculável conforme lib/scoring.ts:
// Caminho exact: winner(3) + exact(5) + goleada(1) = 9
// Caminho winner_score+diff: winner(3) + winner_score(3) + diff(2) + goleada(1) = 9
const MAX_POINTS = 9

export function ScoringRulesTable() {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-secondary)',
          padding: '0.5rem 1rem',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-text)',
        }}
      >
        TABELA DE PONTUAÇÃO
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <th
              style={{
                padding: '0.4rem 1rem',
                textAlign: 'left',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
              }}
            >
              EVENTO
            </th>
            <th
              style={{
                padding: '0.4rem 1rem',
                textAlign: 'right',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              PONTOS
            </th>
          </tr>
        </thead>
        <tbody>
          {SCORING_RULES.map((rule, index) => (
            <tr
              key={rule.event}
              style={{
                borderBottom: '1px solid var(--color-border)',
                backgroundColor:
                  index % 2 === 0 ? 'transparent' : 'var(--color-surface)',
              }}
            >
              <td
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '14px',
                  color: 'var(--color-text)',
                }}
              >
                <span
                  style={{
                    color: rule.highlight ? 'var(--color-primary)' : 'transparent',
                    marginRight: '0.5rem',
                    userSelect: 'none',
                  }}
                >
                  ►
                </span>
                {rule.event}
                {rule.note && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--color-muted)',
                      marginLeft: '1.25rem',
                      marginTop: '1px',
                    }}
                  >
                    {rule.note}
                  </span>
                )}
              </td>
              <td
                style={{
                  padding: '0.5rem 1rem',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'var(--color-accent)',
                  whiteSpace: 'nowrap',
                }}
              >
                +{rule.points}
              </td>
            </tr>
          ))}

          <tr
            style={{
              borderTop: '2px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <td
              style={{
                padding: '0.5rem 1rem',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
              }}
            >
              MÁXIMO POSSÍVEL POR JOGO
            </td>
            <td
              style={{
                padding: '0.5rem 1rem',
                textAlign: 'right',
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
                whiteSpace: 'nowrap',
              }}
            >
              +{MAX_POINTS}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
