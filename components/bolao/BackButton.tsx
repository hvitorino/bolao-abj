'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  fallbackHref: string
  label?: string
}

export default function BackButton({ fallbackHref, label = '← VOLTAR AO PALPITE' }: BackButtonProps) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--color-primary)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
