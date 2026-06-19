'use client'

import { useDailyRecap } from '@/lib/hooks/useDailyRecap'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface RecapFloatingButtonProps {
  groupId: string
  currentUserId: string
  onOpen: () => void
}

export function RecapFloatingButton({ groupId, onOpen }: RecapFloatingButtonProps) {
  const { loading, hasData } = useDailyRecap(groupId)

  if (loading || !hasData) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        zIndex: 50,
        fontFamily: FONT,
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-muted)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 0,
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        boxShadow: 'none',
        transition: 'color 0.15s ease, border-color 0.15s ease',
        whiteSpace: 'nowrap',
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
  )
}
