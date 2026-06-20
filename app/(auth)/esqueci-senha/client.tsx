'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Estado = 'idle' | 'loading' | 'enviado' | 'error'

function mapErrorMessage(error: string): string {
  if (error.includes('Unable to validate email address') || error.includes('invalid format')) {
    return 'Formato de e-mail inválido'
  }
  return 'Ocorreu um erro. Tente novamente.'
}

export default function EsqueciSenhaClient() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensagemErro, setMensagemErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstado('loading')
    setMensagemErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
    })

    if (error) {
      setEstado('error')
      setMensagemErro(mapErrorMessage(error.message))
      return
    }

    setEstado('enviado')
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--color-surface)',
    border: `1px solid ${estado === 'error' ? 'var(--color-error)' : 'var(--color-border)'}`,
    padding: '2rem',
  }

  return (
    <div style={cardStyle}>
      {/* Título */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-muted)',
            margin: '0.5rem 0 0',
          }}
        >
          RECUPERAR SENHA
        </p>
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '1.5rem',
        }}
      />

      {estado === 'enviado' ? (
        /* Estado de confirmação */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
              ✓ LINK ENVIADO
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-muted)',
                margin: 0,
                lineHeight: '1.6',
              }}
            >
              Se este e-mail estiver cadastrado, você receberá o link em instantes.
              <br />O link expira em 1 hora.
            </p>
          </div>

          <Link
            href="/login"
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ← VOLTAR PARA O LOGIN
          </Link>
        </div>
      ) : (
        /* Formulário */
        <>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seu@email.com"
              hasError={estado === 'error'}
            />

            {/* Mensagem de erro */}
            {estado === 'error' && mensagemErro && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
              fullWidth
              disabled={estado === 'loading'}
              style={{ marginTop: '0.5rem' }}
            >
              {estado === 'loading' ? 'ENVIANDO...' : 'ENVIAR LINK DE RECUPERAÇÃO'}
            </Button>
          </form>

          {/* Separador */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              margin: '1.5rem 0',
            }}
          />

          {/* Link para login */}
          <p
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              textAlign: 'center',
              color: 'var(--color-muted)',
              margin: 0,
            }}
          >
            Lembrou a senha?{' '}
            <Link
              href="/login"
              style={{
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}
            >
              LOGIN
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
