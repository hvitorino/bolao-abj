import type { ScoreBreakdown } from '@/lib/types/score'
import { BREAKDOWN_LABELS } from '@/lib/scoring'

interface ScoreDisplayProps {
  points: number
  breakdown: ScoreBreakdown
}

/**
 * Exibe o breakdown de pontuação de um palpite em jogo encerrado.
 *
 * Design DESIGN.md — Pontuação por Jogo:
 * ┌──────────────────────────────────────────────────────┐
 * │  BRA 3×1 ARG  ·  SEU PALPITE: 3×1  ·  +8 PTS       │
 * │  ─────────────────────────────────────────────────── │
 * │  ✓ Acertou o vencedor        +3                      │
 * │  ✓ Placar exato              +5                      │
 * │  ─────────────────────────────────────────────────── │
 * │  TOTAL                        8 pontos               │
 * └──────────────────────────────────────────────────────┘
 */
export default function ScoreDisplay({ points, breakdown }: ScoreDisplayProps) {
  // Monta lista ordenada de itens do breakdown com pontos > 0
  const breakdownItems: Array<{ label: string; pts: number }> = [
    { label: BREAKDOWN_LABELS.winner, pts: breakdown.winner },
    { label: BREAKDOWN_LABELS.exact, pts: breakdown.exact },
    { label: BREAKDOWN_LABELS.winner_score, pts: breakdown.winner_score },
    { label: BREAKDOWN_LABELS.diff, pts: breakdown.diff },
    { label: BREAKDOWN_LABELS.loser_score, pts: breakdown.loser_score },
    { label: BREAKDOWN_LABELS.goleada, pts: breakdown.goleada },
  ].filter((item) => item.pts > 0)

  return (
    <div
      style={{
        border: '1px solid var(--color-primary)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '11px',
      }}
    >
      {/* Breakdown — apenas itens com pontos */}
      {breakdownItems.length > 0 && (
        <>
          <div
            style={{
              padding: '0.4rem 0.75rem',
            }}
          >
            {breakdownItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.15rem 0',
                }}
              >
                <span style={{ color: 'var(--color-win)' }}>
                  ✓{' '}
                  <span
                    style={{
                      color: 'var(--color-text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {item.label}
                  </span>
                </span>
                <span
                  style={{
                    color: 'var(--color-accent)',
                    fontWeight: 'bold',
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  +{item.pts}
                </span>
              </div>
            ))}
          </div>

          {/* Linha separadora + total */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              padding: '0.4rem 0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              TOTAL
            </span>
            <span
              style={{
                color: 'var(--color-accent)',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              {points} pontos
            </span>
          </div>
        </>
      )}

      {/* Estado zero: sem pontos */}
      {breakdownItems.length === 0 && (
        <div
          style={{
            padding: '0.4rem 0.75rem',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
          }}
        >
          ✗ SEM PONTOS NESTE JOGO
        </div>
      )}
    </div>
  )
}
