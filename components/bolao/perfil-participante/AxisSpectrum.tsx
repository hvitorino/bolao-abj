import type { Axis } from '@/lib/participant-profile'

interface AxisSpectrumProps {
  axis: Axis
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

const LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: '11px',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  letterSpacing: '0.06em',
}

function poleLabelStyle(active: boolean): React.CSSProperties {
  return {
    ...MONO,
    fontSize: '12px',
    fontWeight: active ? 'bold' : 'normal',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
  }
}

/**
 * Renderiza um eixo de comportamento como espectro ASCII, no mesmo padrão de
 * linha (label → valor% + barra) usado em PerformancePanel: `leftLabel ◄
 * [barra █/░] ► rightLabel`, com o percentual explícito, as stats de apoio em
 * grid, e um selo "amostra pequena" quando `axis.confident === false`.
 */
export function AxisSpectrum({ axis }: AxisSpectrumProps) {
  const pct = Math.round(axis.position * 100)

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
          marginBottom: '0.5rem',
          gap: '0.5rem',
        }}
      >
        <span style={poleLabelStyle(axis.position < 0.5)}>{axis.leftLabel}</span>
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
        <span style={poleLabelStyle(axis.position >= 0.5)}>{axis.rightLabel}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <span
          style={{
            ...MONO,
            fontSize: '14px',
            letterSpacing: '0.05em',
            color: 'var(--color-primary)',
            flex: 1,
            wordBreak: 'break-all',
          }}
        >
          {axis.bar}
        </span>
        <span style={{ ...MONO, fontSize: '12px', color: 'var(--color-text)', minWidth: '2.5rem', textAlign: 'right' }}>
          {pct}%
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.4rem 1rem',
        }}
      >
        {axis.stats.map((stat) => (
          <div key={stat.label}>
            <div style={LABEL}>{stat.label}</div>
            <div style={{ ...MONO, fontSize: '12px', color: 'var(--color-text)' }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
