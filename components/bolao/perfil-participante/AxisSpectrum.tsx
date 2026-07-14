import type { Axis } from '@/lib/participant-profile'

interface AxisSpectrumProps {
  axis: Axis
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
 * Renderiza um eixo de comportamento como medidor de largura total: os polos
 * (`leftLabel`/`rightLabel`) na linha de cima, ponta a ponta, e uma barra
 * cheia (não texto ASCII) preenchida até `position` logo abaixo. As stats de
 * apoio aparecem como cards de "scout" em grid, e um selo "amostra pequena"
 * quando `axis.confident === false`.
 */
export function AxisSpectrum({ axis }: AxisSpectrumProps) {
  const pct = Math.round(axis.position * 100)

  return (
    <div
      style={{
        padding: '0.75rem 1rem 1rem',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <span style={poleLabelStyle(axis.position < 0.5)}>{axis.leftLabel}</span>
        <span style={poleLabelStyle(axis.position >= 0.5)}>{axis.rightLabel}</span>
      </div>

      <div
        style={{
          position: 'relative',
          height: '10px',
          width: '100%',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          margin: '0.4rem 0 0.3rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct}%`,
            backgroundColor: 'var(--color-primary)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: '1px',
            backgroundColor: 'var(--color-border)',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: !axis.confident ? 'space-between' : 'flex-end',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
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
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-muted)' }}>{pct}%</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {axis.stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              padding: '0.4rem 0.5rem',
            }}
          >
            <div
              style={{
                ...MONO,
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--color-muted)',
                letterSpacing: '0.05em',
                marginBottom: '0.15rem',
              }}
            >
              {stat.label}
            </div>
            <div style={{ ...MONO, fontSize: '14px', fontWeight: 'bold', color: 'var(--color-accent)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
