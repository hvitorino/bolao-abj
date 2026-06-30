import { getTeamFlag } from '@/lib/flags'
import type { StandingEntry } from '@/lib/analytics/group-standings'

interface GroupStandingsCardProps {
  groupLetter: string
  standings: StandingEntry[]
  homeTeamCode: string
  awayTeamCode: string
}

const GRID_COLS = '20px 1fr 22px 22px 20px 20px 20px 24px 24px 26px'

function SgCell({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span style={{ color: 'var(--color-win)', textAlign: 'center' }}>
        +{value}
      </span>
    )
  }
  if (value < 0) {
    return (
      <span style={{ color: 'var(--color-error)', textAlign: 'center' }}>
        {value}
      </span>
    )
  }
  return (
    <span style={{ color: 'var(--color-muted)', textAlign: 'center' }}>
      0
    </span>
  )
}

export default function GroupStandingsCard({
  groupLetter,
  standings,
  homeTeamCode,
  awayTeamCode,
}: GroupStandingsCardProps) {
  const isHighlighted = (code: string) =>
    code === homeTeamCode || code === awayTeamCode

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Header da seção */}
      <div
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-bg)',
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        ► CLASSIFICAÇÃO — GRUPO {groupLetter}
      </div>

      {standings.length === 0 ? (
        /* Estado vazio */
        <div
          style={{
            padding: '0.75rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            textAlign: 'center',
          }}
        >
          — sem jogos encerrados anteriores —
        </div>
      ) : (
        <>
          {/* Cabeçalho da tabela */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLS,
              alignItems: 'center',
              backgroundColor: 'rgba(26, 74, 46, 0.3)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '9px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              padding: '0.3rem 0.5rem',
            }}
          >
            <span>#</span>
            <span>TIME</span>
            <span style={{ textAlign: 'center' }}>P</span>
            <span style={{ textAlign: 'center' }}>J</span>
            <span style={{ textAlign: 'center' }}>V</span>
            <span style={{ textAlign: 'center' }}>E</span>
            <span style={{ textAlign: 'center' }}>D</span>
            <span style={{ textAlign: 'center' }}>GP</span>
            <span style={{ textAlign: 'center' }}>GC</span>
            <span style={{ textAlign: 'center' }}>SG</span>
          </div>

          {/* Linhas de times */}
          {standings.map((entry, index) => {
            const highlighted = isHighlighted(entry.teamCode)
            const isLast = index === standings.length - 1

            const rowBg = highlighted
              ? 'rgba(0, 156, 59, 0.15)'
              : index % 2 === 1
              ? 'rgba(26, 74, 46, 0.08)'
              : 'transparent'

            return (
              <div
                key={entry.teamCode}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLS,
                  alignItems: 'center',
                  padding: '0.35rem 0.5rem',
                  borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  fontSize: '11px',
                  backgroundColor: rowBg,
                  fontWeight: highlighted ? 'bold' : 'normal',
                }}
              >
                {/* Posição */}
                <span
                  style={{
                    color: highlighted ? 'var(--color-accent)' : 'var(--color-muted)',
                    fontWeight: highlighted ? 'bold' : 'normal',
                  }}
                >
                  {entry.position}
                </span>

                {/* Time: flag + code */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>
                    {getTeamFlag(entry.teamCode)}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.teamCode}
                  </span>
                </div>

                {/* Pontos */}
                <span
                  style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: 'var(--color-text)',
                  }}
                >
                  {entry.points}
                </span>

                {/* Jogados */}
                <span style={{ textAlign: 'center' }}>{entry.played}</span>

                {/* Vitórias */}
                <span style={{ textAlign: 'center' }}>{entry.wins}</span>

                {/* Empates */}
                <span style={{ textAlign: 'center' }}>{entry.draws}</span>

                {/* Derrotas */}
                <span style={{ textAlign: 'center' }}>{entry.losses}</span>

                {/* Gols pró */}
                <span style={{ textAlign: 'center' }}>{entry.goalsFor}</span>

                {/* Gols contra */}
                <span style={{ textAlign: 'center' }}>{entry.goalsAgainst}</span>

                {/* Saldo */}
                <SgCell value={entry.goalDifference} />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
