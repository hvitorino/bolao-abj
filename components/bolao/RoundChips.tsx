'use client'

/**
 * RoundChips — faixa de chips para filtrar o ranking por fase da Copa.
 *
 * Sempre renderiza o chip "GERAL" como primeiro item. Os demais chips
 * vêm de `rounds` (fases com ao menos um palpite no grupo).
 *
 * A ordenação segue a sequência lógica da Copa:
 *   Grupos A–L → Oitavas de Final → Quartas de Final → Semifinal → Final
 * Fases não reconhecidas são colocadas ao final em ordem alfabética.
 *
 * O scroll horizontal permite navegação em mobile sem barra de scroll
 * visível (scrollbarWidth: none / ::-webkit-scrollbar { display: none }).
 */

const ROUND_ORDER = [
  'Grupo A',
  'Grupo B',
  'Grupo C',
  'Grupo D',
  'Grupo E',
  'Grupo F',
  'Grupo G',
  'Grupo H',
  'Grupo I',
  'Grupo J',
  'Grupo K',
  'Grupo L',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinal',
  'Final',
]

function sortRounds(rounds: string[]): string[] {
  return [...rounds].sort((a, b) => {
    const idxA = ROUND_ORDER.indexOf(a)
    const idxB = ROUND_ORDER.indexOf(b)

    // Ambos reconhecidos → ordem da Copa
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    // Só A reconhecido → A vem antes
    if (idxA !== -1) return -1
    // Só B reconhecido → B vem antes
    if (idxB !== -1) return 1
    // Nenhum reconhecido → alfabético
    return a.localeCompare(b, 'pt-BR')
  })
}

interface RoundChipsProps {
  rounds: string[]
  selectedRound: string
  onSelect: (round: string) => void
}

const CHIP_BASE_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.3rem 0.75rem',
  border: '1px solid',
  borderRadius: 0,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'border-color 0.15s, color 0.15s',
  lineHeight: 1.4,
}

export function RoundChips({ rounds, selectedRound, onSelect }: RoundChipsProps) {
  const sortedRounds = sortRounds(rounds)
  const allChips = ['GERAL', ...sortedRounds]

  return (
    <>
      {/* Estilo para suprimir a barra de scroll (webkit + padrão) */}
      <style>{`
        .round-chips-container::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="round-chips-container"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.4rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '0.5rem',
          scrollbarWidth: 'none',
        }}
      >
        {allChips.map((chip) => {
          const isActive = chip === selectedRound
          return (
            <button
              key={chip}
              onClick={() => onSelect(chip)}
              style={{
                ...CHIP_BASE_STYLE,
                color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
                borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                fontWeight: isActive ? 'bold' : 'normal',
              }}
            >
              {chip}
            </button>
          )
        })}
      </div>
    </>
  )
}
