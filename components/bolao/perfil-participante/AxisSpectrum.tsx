import type { Axis } from '@/lib/participant-profile'

interface AxisSpectrumProps {
  axis: Axis
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

/**
 * Renderiza um eixo de comportamento como espectro ASCII:
 * `leftLabel ◄ [barra █/░] ► rightLabel`, com as stats de apoio abaixo e um
 * selo "amostra pequena" quando `axis.confident === false`.
 */
export function AxisSpectrum({ axis }: AxisSpectrumProps) {
  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '0.35rem',
          flexWrap: 'wrap',
          gap: '0.35rem',
        }}
      >
        <div
          style={{
            ...MONO,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '12px',
          }}
        >
          <span
            style={{
              color: axis.position < 0.5 ? 'var(--color-accent)' : 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {axis.leftLabel}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>◄</span>
          <span
            style={{
              color: 'var(--color-primary)',
              letterSpacing: '0.05em',
              fontSize: '14px',
            }}
          >
            {axis.bar}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>►</span>
          <span
            style={{
              color: axis.position >= 0.5 ? 'var(--color-accent)' : 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {axis.rightLabel}
          </span>
        </div>

        {!axis.confident && (
          <span
            style={{
              ...MONO,
              fontSize: '10px',
              color: 'var(--color-bg)',
              backgroundColor: 'var(--color-muted)',
              padding: '0.1rem 0.4rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            AMOSTRA PEQUENA
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem 1.25rem',
        }}
      >
        {axis.stats.map((stat) => (
          <div key={stat.label} style={{ ...MONO, fontSize: '11px' }}>
            <span style={{ color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}:{' '}
            </span>
            <span style={{ color: 'var(--color-text)' }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
