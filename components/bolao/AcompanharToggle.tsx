'use client'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface AcompanharToggleProps {
  isActive: boolean
  onToggle: () => void
}

export function AcompanharToggle({ isActive, onToggle }: AcompanharToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...MONO,
        flex: 1,
        padding: '0.4rem 0.75rem',
        border: '1px solid var(--color-primary)',
        backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
        color: isActive ? 'var(--color-bg)' : 'var(--color-primary)',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        cursor: 'pointer',
      }}
    >
      {isActive ? '● ACOMPANHANDO' : '◉ ACOMPANHAR'}
    </button>
  )
}
