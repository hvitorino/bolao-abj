import type { ScoreBreakdown } from '@/lib/types/score'
import { BREAKDOWN_LABELS } from '@/lib/scoring'

interface PredictionBreakdownProps {
  points: number
  breakdown: ScoreBreakdown
}

/**
 * Exibe o detalhamento da pontuação de um palpite específico dentro da
 * lista de participantes de um jogo (`GameParticipantsList`).
 *
 * Componente de apresentação pura — nunca calcula pontuação. Recebe
 * `breakdown`/`points` já resolvidos a partir do registro oficial em
 * `scores` (propagados via `ParticipantEntry`). Reaproveita os mesmos
 * rótulos de `ScoreDisplay.tsx` (`BREAKDOWN_LABELS`), em versão compacta
 * adequada para uma linha de tabela.
 *
 * Layout (DESIGN.md — Pontuação por Jogo, versão compacta):
 * ┌──────────────────────────────────────────────────────┐
 * │  ✓ Acertou o vencedor                          +3    │
 * │  ✓ Placar exato                                +5    │
 * │  ────────────────────────────────────────────────── │
 * │  TOTAL                                      8 pontos │
 * └──────────────────────────────────────────────────────┘
 */
export default function PredictionBreakdown({ points, breakdown }: PredictionBreakdownProps) {
  type BreakdownItem = { key: keyof ScoreBreakdown; label: string; pts: number }

  const allItems: BreakdownItem[] = [
    { key: 'winner', label: BREAKDOWN_LABELS.winner, pts: breakdown.winner },
    { key: 'exact', label: BREAKDOWN_LABELS.exact, pts: breakdown.exact },
    { key: 'winner_score', label: BREAKDOWN_LABELS.winner_score, pts: breakdown.winner_score },
    { key: 'diff', label: BREAKDOWN_LABELS.diff, pts: breakdown.diff },
    { key: 'loser_score', label: BREAKDOWN_LABELS.loser_score, pts: breakdown.loser_score },
    { key: 'goleada', label: BREAKDOWN_LABELS.goleada, pts: breakdown.goleada },
  ]
  const breakdownItems = allItems.filter((item) => item.pts > 0)

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '10px',
        padding: '0.5rem 0.75rem',
      }}
    >
      {breakdownItems.length > 0 && (
        <>
          {breakdownItems.map((item) => (
            <div
              key={item.key}
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
                  minWidth: '28px',
                  textAlign: 'right',
                }}
              >
                +{item.pts}
              </span>
            </div>
          ))}

          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              marginTop: '0.25rem',
              paddingTop: '0.3rem',
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
                fontSize: '11px',
              }}
            >
              {points} pontos
            </span>
          </div>
        </>
      )}

      {breakdownItems.length === 0 && (
        <div
          style={{
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
            padding: '0.15rem 0',
          }}
        >
          ✗ SEM PONTOS NESTE PALPITE
        </div>
      )}
    </div>
  )
}
