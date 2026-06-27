'use client'

import { useState } from 'react'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface CompartilharButtonProps {
  groupId: string
  selectedDate: string
}

export function CompartilharButton({ groupId, selectedDate }: CompartilharButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}/publico/${groupId}/${selectedDate}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silencioso em contextos sem HTTPS ou sem permissão
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        ...MONO,
        flex: 1,
        padding: '0.4rem 0.75rem',
        border: '1px solid var(--color-border)',
        backgroundColor: 'transparent',
        color: copied ? 'var(--color-win)' : 'var(--color-muted)',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ COPIADO!' : '⎘ COMPARTILHAR'}
    </button>
  )
}
