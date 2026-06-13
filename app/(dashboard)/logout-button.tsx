'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        padding: '0.375rem 0.75rem',
        backgroundColor: 'transparent',
        color: 'var(--color-muted)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
        boxShadow: 'none',
      }}
    >
      SAIR
    </button>
  )
}
