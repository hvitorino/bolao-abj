'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const MAX_NAME_LENGTH = 60

type FormState = 'idle' | 'loading' | 'error'

export function CreateGroupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [estado, setEstado] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')

  const nomeVazio = name.trim().length === 0
  const nomeMuitoLongo = name.trim().length > MAX_NAME_LENGTH

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensagemErro('')

    const trimmed = name.trim()
    if (!trimmed) {
      setEstado('error')
      setMensagemErro('Informe um nome para o grupo.')
      return
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setEstado('error')
      setMensagemErro(`O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`)
      return
    }

    setEstado('loading')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setEstado('error')
        setMensagemErro('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEstado('error')
        setMensagemErro(data.message || 'Erro ao criar grupo. Tente novamente.')
        return
      }

      router.push(`/grupos/${data.id}`)
    } catch {
      setEstado('error')
      setMensagemErro('Erro de conexão. Tente novamente.')
    }
  }

  const isLoading = estado === 'loading'

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      <Input
        label="Nome do grupo"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Bolão da Família"
        maxLength={MAX_NAME_LENGTH}
        required
        hasError={nomeMuitoLongo}
        error={nomeMuitoLongo ? `Máximo de ${MAX_NAME_LENGTH} caracteres.` : undefined}
      />

      {estado === 'error' && mensagemErro && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-error)',
            padding: '0.5rem',
            border: '1px solid var(--color-error)',
          }}
        >
          ✗ {mensagemErro}
        </div>
      )}

      <Button type="submit" fullWidth disabled={isLoading || nomeVazio}>
        {isLoading ? 'CRIANDO...' : 'CRIAR GRUPO'}
      </Button>
    </form>
  )
}
