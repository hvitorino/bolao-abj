'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type FormState = 'idle' | 'loading' | 'error' | 'success'

function mapErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos'
  }
  if (error.includes('Email not confirmed')) {
    return 'Confirme seu e-mail antes de fazer login'
  }
  return 'Ocorreu um erro. Tente novamente.'
}

export default function LoginClient() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/jogos'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [estado, setEstado] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstado('loading')
    setMensagemErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setEstado('error')
      setMensagemErro(mapErrorMessage(error.message))
      return
    }

    setEstado('success')
    router.push(redirectTo)
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
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
          LOGIN
        </p>
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '1.5rem',
        }}
      />

      {/* Formulário */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="seu@email.com"
        />

        <Input
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
          autoComplete="current-password"
          placeholder="••••••"
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
          {estado === 'loading' ? 'ENTRANDO...' : 'ENTRAR'}
        </Button>
      </form>

      {/* Link para recuperar senha */}
      <p
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '12px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          margin: '1rem 0 0',
        }}
      >
        Esqueceu a senha?{' '}
        <Link
          href="/esqueci-senha"
          style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          RECUPERAR ACESSO
        </Link>
      </p>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          margin: '1.5rem 0',
        }}
      />

      {/* Link para cadastro */}
      <p
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '12px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          margin: 0,
        }}
      >
        Não tem conta?{' '}
        <Link
          href={searchParams.get('redirect') ? `/cadastro?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : '/cadastro'}
          style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          CADASTRE-SE
        </Link>
      </p>
    </div>
  )
}
