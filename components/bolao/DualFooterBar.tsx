'use client'

import { useState } from 'react'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface DualFooterBarProps {
  // Lado "Rolou ontem"
  recapLoading: boolean
  recapHasData: boolean
  onOpenRecap: () => void

  // Lado "Tá rolando"
  todayHasGames: boolean
  onOpenToday: () => void
}

export function DualFooterBar({
  recapLoading,
  recapHasData,
  onOpenRecap,
  todayHasGames,
  onOpenToday,
}: DualFooterBarProps) {
  const [hoveredRecap, setHoveredRecap] = useState(false)
  const [hoveredToday, setHoveredToday] = useState(false)

  const showRecap = !recapLoading && recapHasData
  const showToday = todayHasGames

  // Nenhum botão visível: não renderiza a barra
  if (!showRecap && !showToday) return null

  const bothVisible = showRecap && showToday

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '2px solid var(--color-accent)',
        backgroundColor: 'var(--color-primary)',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          paddingTop: '0.4rem',
          paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom))',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}
      >
        {/* Botão ROLOU ONTEM */}
        {showRecap && (
          <button
            type="button"
            onClick={onOpenRecap}
            onMouseEnter={() => setHoveredRecap(true)}
            onMouseLeave={() => setHoveredRecap(false)}
            style={{
              flex: 1,
              fontFamily: FONT,
              fontSize: '13px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-bg)',
              backgroundColor: hoveredRecap ? '#007a2e' : 'transparent',
              border: 'none',
              borderRadius: 0,
              borderRight: bothVisible ? '1px solid var(--color-border)' : 'none',
              padding: '0.375rem 1rem',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
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
            ► ROLOU ONTEM
          </button>
        )}

        {/* Botão TÁ ROLANDO */}
        {showToday && (
          <button
            type="button"
            onClick={onOpenToday}
            onMouseEnter={() => setHoveredToday(true)}
            onMouseLeave={() => setHoveredToday(false)}
            style={{
              flex: 1,
              fontFamily: FONT,
              fontSize: '13px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-bg)',
              backgroundColor: hoveredToday ? '#007a2e' : 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '0.375rem 1rem',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              boxShadow: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-live)',
                marginRight: '0.5rem',
                verticalAlign: 'middle',
                animation: 'blink 1s step-end infinite',
              }}
            />
            ► TÁ ROLANDO
          </button>
        )}
      </div>
    </div>
  )
}
