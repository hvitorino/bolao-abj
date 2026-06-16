'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface JoinGroupButtonProps {
  inviteToken: string
  groupId: string
}

type FormState = 'idle' | 'loading' | 'error'

export function JoinGroupButton({ inviteToken, groupId }: JoinGroupButtonProps) {
  const router = useRouter()
  const [estado, setEstado] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')

  async function handleClick() {
    setEstado('loading')
    setMensagemErro('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setEstado('error')
        setMensagemErro('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEstado('error')
        setMensagemErro(data.message || 'Erro ao entrar no grupo. Tente novamente.')
        return
      }

      router.push(`/jogos?group=${groupId}`)
    } catch {
      setEstado('error')
      setMensagemErro('Erro de conexão. Tente novamente.')
    }
  }

  const isLoading = estado === 'loading'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Button type="button" fullWidth disabled={isLoading} onClick={handleClick}>
        {isLoading ? 'ENTRANDO...' : 'ENTRAR NO GRUPO'}
      </Button>
      {estado === 'error' && mensagemErro && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-error)',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          ✗ {mensagemErro}
        </div>
      )}
    </div>
  )
}
