'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type FormState = 'idle' | 'loading' | 'sucesso' | 'error'

function mapErrorMessage(error: string): string {
  if (error.includes('New password should be different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual'
  }
  if (error.includes('Auth session missing')) {
    return 'Sessão expirada. Faça login novamente.'
  }
  return 'Ocorreu um erro ao atualizar a senha. Tente novamente.'
}

const monoStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

export function ChangePasswordForm() {
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [estado, setEstado] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')
  const [erroConfirmar, setErroConfirmar] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Reset de erros
    setErroConfirmar(false)
    setMensagemErro('')

    // Validação client-side
    if (novaSenha.length < 6) {
      setMensagemErro('A senha deve ter pelo menos 6 caracteres')
      setEstado('error')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErroConfirmar(true)
      setMensagemErro('As senhas não coincidem')
      setEstado('error')
      return
    }

    setEstado('loading')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: novaSenha })

    if (error) {
      setMensagemErro(mapErrorMessage(error.message))
      setEstado('error')
      return
    }

    setNovaSenha('')
    setConfirmarSenha('')
    setEstado('sucesso')
  }

  if (estado === 'sucesso') {
    return (
      <div
        style={{
          ...monoStyle,
          padding: '1rem',
          border: '1px solid var(--color-win)',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'var(--color-win)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.25rem',
          }}
        >
          ✓ SENHA ATUALIZADA
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-muted)',
          }}
        >
          Sua senha foi alterada com sucesso.
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <Input
        label="Nova Senha"
        type="password"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
        required
        autoComplete="new-password"
        placeholder="••••••"
      />

      <Input
        label="Confirmar Nova Senha"
        type="password"
        value={confirmarSenha}
        onChange={(e) => setConfirmarSenha(e.target.value)}
        required
        autoComplete="new-password"
        placeholder="••••••"
        hasError={erroConfirmar}
      />

      {/* Bloco de erro */}
      {estado === 'error' && mensagemErro && (
        <div
          style={{
            ...monoStyle,
            fontSize: '13px',
            color: 'var(--color-error)',
            padding: '0.5rem',
            border: '1px solid var(--color-error)',
          }}
        >
          ✗ {mensagemErro}
        </div>
      )}

      <Button
        type="submit"
        disabled={estado === 'loading'}
        style={{ alignSelf: 'flex-start' }}
      >
        {estado === 'loading' ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
      </Button>
    </form>
  )
}
