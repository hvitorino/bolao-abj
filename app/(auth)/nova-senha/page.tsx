'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Estado = 'idle' | 'loading' | 'sucesso' | 'error' | 'sessao-invalida'

function mapErrorMessage(error: string): string {
  if (error.includes('New password should be different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual'
  }
  if (error.includes('Auth session missing')) {
    return 'Sessão expirada. Solicite um novo link de recuperação.'
  }
  return 'Ocorreu um erro ao atualizar a senha. Tente novamente.'
}

export default function NovaSenhaPage() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensagemErro, setMensagemErro] = useState('')
  const [erroCampoConfirmar, setErroCampoConfirmar] = useState(false)
  const [erroSessao, setErroSessao] = useState(false)

  useEffect(() => {
    async function verificarSessao() {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setEstado('sessao-invalida')
      }
    }
    verificarSessao()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensagemErro('')
    setErroCampoConfirmar(false)
    setErroSessao(false)

    // Validações client-side
    if (novaSenha.length < 6) {
      setEstado('error')
      setMensagemErro('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setEstado('error')
      setErroCampoConfirmar(true)
      setMensagemErro('As senhas não coincidem')
      return
    }

    setEstado('loading')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: novaSenha })

    if (error) {
      const mensagem = mapErrorMessage(error.message)
      setEstado('error')
      setMensagemErro(mensagem)
      if (error.message.includes('Auth session missing')) {
        setErroSessao(true)
      }
      return
    }

    setEstado('sucesso')
    setTimeout(() => {
      router.push('/jogos')
    }, 2000)
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--color-surface)',
    border: `1px solid ${estado === 'error' || estado === 'sessao-invalida' ? 'var(--color-error)' : 'var(--color-border)'}`,
    padding: '2rem',
  }

  const monoStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  }

  return (
    <div style={cardStyle}>
      {/* Título */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1
          style={{
            ...monoStyle,
            fontSize: '16px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
            margin: 0,
          }}
        >
          BOLÃO DA COPA
        </h1>
        <p
          style={{
            ...monoStyle,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-muted)',
            margin: '0.5rem 0 0',
          }}
        >
          NOVA SENHA
        </p>
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '1.5rem',
        }}
      />

      {/* Estado: sessão inválida */}
      {estado === 'sessao-invalida' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div
            style={{
              ...monoStyle,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-error)',
                margin: '0 0 0.75rem',
                lineHeight: '1.6',
              }}
            >
              ✗ LINK INVÁLIDO OU EXPIRADO
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-muted)',
                margin: 0,
              }}
            >
              Solicite um novo link de recuperação.
            </p>
          </div>

          <Link
            href="/esqueci-senha"
            style={{
              ...monoStyle,
              fontSize: '12px',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            SOLICITAR NOVO LINK
          </Link>
        </div>
      )}

      {/* Estado: sucesso */}
      {estado === 'sucesso' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div
            style={{
              ...monoStyle,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'var(--color-win)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                margin: '0 0 0.75rem',
              }}
            >
              ✓ SENHA ATUALIZADA
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-muted)',
                margin: 0,
              }}
            >
              Sua nova senha foi definida com sucesso.
            </p>
          </div>

          <Link
            href="/jogos"
            style={{
              ...monoStyle,
              fontSize: '12px',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            IR PARA O BOLÃO →
          </Link>
        </div>
      )}

      {/* Formulário (estados idle / loading / error) */}
      {(estado === 'idle' || estado === 'loading' || estado === 'error') && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            hasError={erroCampoConfirmar}
          />

          {/* Mensagem de erro */}
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
              {erroSessao && (
                <>
                  {' '}
                  <Link
                    href="/esqueci-senha"
                    style={{
                      color: 'var(--color-primary)',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                    }}
                  >
                    Solicitar novo link
                  </Link>
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={estado === 'loading'}
            style={{ marginTop: '0.5rem' }}
          >
            {estado === 'loading' ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
          </Button>
        </form>
      )}
    </div>
  )
}
