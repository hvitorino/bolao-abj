'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface CopyInviteLinkProps {
  inviteUrl: string
}

const FEEDBACK_DURATION_MS = 2000

export function CopyInviteLink({ inviteUrl }: CopyInviteLinkProps) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), FEEDBACK_DURATION_MS)
    } catch {
      // Falha silenciosa — sem navigator.clipboard disponível (ex: contexto não-seguro).
      // Não há fallback nesta feature; o link já está visível em texto para cópia manual.
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '13px',
          color: 'var(--color-text)',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          wordBreak: 'break-all',
        }}
      >
        {inviteUrl}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={handleCopy}
        style={
          copiado
            ? { borderColor: 'var(--color-win)', color: 'var(--color-win)' }
            : undefined
        }
      >
        {copiado ? 'COPIADO!' : 'COPIAR LINK'}
      </Button>
    </div>
  )
}
