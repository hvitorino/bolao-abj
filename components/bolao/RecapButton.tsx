'use client'

import { useState } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'
import { DailyRecapModal } from './DailyRecapModal'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface RecapButtonProps {
  groupId: string
  currentUserId: string
}

export function RecapButton({ groupId, currentUserId }: RecapButtonProps) {
  const [recapOpen, setRecapOpen] = useState(false)
  const { loading, hasData } = useDailyRecap(groupId)

  if (loading || !hasData) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setRecapOpen(true)}
        style={{
          fontFamily: FONT,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-muted)',
          background: 'none',
          border: 'none',
          borderBottom: '2px solid transparent',
          padding: '0.5rem 0',
          cursor: 'pointer',
          transition: 'color 0.15s ease, border-color 0.15s ease',
          display: 'inline-block',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.color = 'var(--color-accent)'
          el.style.borderBottomColor = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.color = 'var(--color-muted)'
          el.style.borderBottomColor = 'transparent'
        }}
      >
        RESUMO DE ONTEM
      </button>

      <DailyRecapModal
        groupId={groupId}
        currentUserId={currentUserId}
        forceOpen={recapOpen}
        onClose={() => setRecapOpen(false)}
      />
    </>
  )
}
