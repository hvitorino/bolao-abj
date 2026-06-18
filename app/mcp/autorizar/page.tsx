'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

export default function McpAutorizarPage() {
  return (
    <Suspense fallback={null}>
      <McpLoginForm />
    </Suspense>
  )
}

function McpLoginForm() {
  const searchParams = useSearchParams()
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const state = searchParams.get('state') ?? ''
  const codeChallenge = searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? ''

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormState('loading')
    setMensagemErro('')

    if (!redirectUri || !state || !codeChallenge) {
      setFormState('error')
      setMensagemErro('Parâmetros de autorização ausentes. Tente reconectar pelo cliente MCP.')
      return
    }

    if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
      setFormState('error')
      setMensagemErro('Método de code challenge não suportado.')
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error || !data.session) {
      setFormState('error')
      setMensagemErro(mapErrorMessage(error?.message ?? 'Erro desconhecido'))
      return
    }

    const { access_token, refresh_token } = data.session

    try {
      const res = await fetch('/api/mcp/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token,
          refresh_token,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.redirect_url) {
        setFormState('error')
        setMensagemErro(json.message ?? 'Erro ao gerar código de autorização.')
        return
      }

      setFormState('success')
      window.location.href = json.redirect_url
    } catch {
      setFormState('error')
      setMensagemErro('Erro de conexão. Tente novamente.')
    }
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    padding: '2rem',
  }

  const monoStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        padding: '1rem',
      }}
    >
      <div style={cardStyle}>
        {/* Cabeçalho */}
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
            BOLÃO ABJ — CONEXÃO MCP
          </h1>
          <div
            style={{
              ...monoStyle,
              fontSize: '12px',
              color: 'var(--color-border)',
              margin: '0.5rem 0',
              letterSpacing: '0.05em',
            }}
          >
            ━━━━━━━━━━━━━━━━━━━━━━━
          </div>
          <p
            style={{
              ...monoStyle,
              fontSize: '12px',
              color: 'var(--color-muted)',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            Faça login para autorizar o acesso do cliente MCP.
          </p>
        </div>

        {/* Separador */}
        <div style={{ borderTop: '1px solid var(--color-border)', marginBottom: '1.5rem' }} />

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
          {formState === 'error' && mensagemErro && (
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

          {/* Mensagem de sucesso */}
          {formState === 'success' && (
            <div
              style={{
                ...monoStyle,
                fontSize: '13px',
                color: 'var(--color-win)',
                padding: '0.5rem',
                border: '1px solid var(--color-win)',
              }}
            >
              ✓ Redirecionando para o cliente MCP...
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={formState === 'loading' || formState === 'success'}
            style={{ marginTop: '0.5rem' }}
          >
            {formState === 'loading' ? 'AUTORIZANDO...' : 'AUTORIZAR ACESSO'}
          </Button>
        </form>

        {/* Separador */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '1.5rem 0' }} />

        {/* Rodapé informativo */}
        <p
          style={{
            ...monoStyle,
            fontSize: '11px',
            color: 'var(--color-muted)',
            margin: 0,
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          Ao autorizar, este cliente MCP terá acesso às suas informações do bolão.
          Você pode revogar o acesso a qualquer momento.
        </p>
      </div>
    </div>
  )
}
