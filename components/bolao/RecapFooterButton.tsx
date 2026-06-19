'use client'

import { useState } from 'react'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface RecapFooterButtonProps {
  loading: boolean
  hasData: boolean
  onOpen: () => void
}

export function RecapFooterButton({ loading, hasData, onOpen }: RecapFooterButtonProps) {
  const [hovered, setHovered] = useState(false)

  if (loading || !hasData) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: '0.4rem',
        paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom))',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        backgroundColor: hovered ? '#007a2e' : 'var(--color-primary)',
        borderTop: '2px solid var(--color-accent)',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-bg)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 0,
            padding: '0.375rem 1rem',
            width: '100%',
            cursor: 'pointer',
            boxShadow: 'none',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              marginRight: '0.5rem',
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }}
          />
          ► RESUMO DE ONTEM
        </button>
      </div>
    </div>
  )
}
