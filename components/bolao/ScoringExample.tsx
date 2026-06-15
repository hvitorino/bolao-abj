interface BreakdownItem {
  label: string
  points: number
  hit: boolean
}

interface ScoringExampleProps {
  title: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  predHome: number
  predAway: number
  breakdown: BreakdownItem[]
  total: number
  note?: string
}

export function ScoringExample({
  title,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  predHome,
  predAway,
  breakdown,
  total,
  note,
}: ScoringExampleProps) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Título */}
      <div
        style={{
          padding: '0.5rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-primary)',
        }}
      >
        {title}
      </div>

      {/* Linha de placares */}
      <div
        style={{
          padding: '0.5rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '13px',
        }}
      >
        <span style={{ color: 'var(--color-text)' }}>{homeTeam} </span>
        <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
          {homeScore}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>x</span>
        <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
          {awayScore}
        </span>
        <span style={{ color: 'var(--color-text)' }}> {awayTeam}</span>
        <span style={{ color: 'var(--color-muted)' }}>
          {' '}
          · SEU PALPITE:{' '}
        </span>
        <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
          {predHome}x{predAway}
        </span>
      </div>

      {/* Breakdown */}
      <div style={{ padding: '0.25rem 0' }}>
        {breakdown.map((item, index) => (
          <div
            key={index}
            style={{
              padding: '0.3rem 1rem',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span>
              <span
                style={{
                  color: item.hit ? 'var(--color-win)' : 'var(--color-muted)',
                  marginRight: '0.5rem',
                  fontWeight: 'bold',
                }}
              >
                {item.hit ? '✓' : '✗'}
              </span>
              <span
                style={{
                  color: item.hit ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {item.label}
              </span>
            </span>
            <span
              style={{
                color: item.hit ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: item.hit ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
              }}
            >
              {item.points > 0 ? `+${item.points}` : '+0'}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '0.5rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        <span style={{ color: 'var(--color-text)', textTransform: 'uppercase' }}>
          TOTAL
        </span>
        <span style={{ color: 'var(--color-accent)' }}>
          {total} pontos
        </span>
      </div>

      {/* Nota pedagógica (opcional) */}
      {note && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '0.4rem 1rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            fontStyle: 'italic',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}
