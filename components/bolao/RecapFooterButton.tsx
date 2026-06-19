'use client'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface RecapFooterButtonProps {
  loading: boolean
  hasData: boolean
  onOpen: () => void
}

export function RecapFooterButton({ loading, hasData, onOpen }: RecapFooterButtonProps) {
  if (loading || !hasData) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: '0.75rem',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            fontFamily: FONT,
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-muted)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '0.625rem 1rem',
            width: '100%',
            cursor: 'pointer',
            boxShadow: 'none',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.color = 'var(--color-accent)'
            el.style.borderColor = 'var(--color-accent)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.color = 'var(--color-muted)'
            el.style.borderColor = 'var(--color-border)'
          }}
        >
          ► RESUMO DE ONTEM
        </button>
      </div>
    </div>
  )
}
