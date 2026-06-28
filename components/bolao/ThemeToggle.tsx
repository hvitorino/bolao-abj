'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div style={{ width: 28, height: 28 }} />

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-muted)',
        fontFamily: FONT,
        fontSize: '16px',
        lineHeight: 1,
        width: 28,
        height: 28,
        flexShrink: 0,
      }}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
