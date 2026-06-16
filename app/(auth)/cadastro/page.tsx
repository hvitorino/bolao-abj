'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type FormState = 'idle' | 'loading' | 'error' | 'success'

function mapErrorMessage(error: string): string {
  if (error.includes('User already registered') || error.includes('already been registered')) {
    return 'E-mail já cadastrado. Faça login.'
  }
  if (error.includes('Password should be at least')) {
    return 'Senha muito fraca. Use pelo menos 6 caracteres.'
  }
  return 'Ocorreu um erro. Tente novamente.'
}

export default function CadastroPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/jogos'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [estado, setEstado] = useState<FormState>('idle')
  const [mensagemErro, setMensagemErro] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  const senhasDiv = senha.length > 0 && confirmarSenha.length > 0 && senha !== confirmarSenha

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensagemErro('')
    setMensagemSucesso('')

    if (senha !== confirmarSenha) {
      setEstado('error')
      setMensagemErro('As senhas não coincidem.')
      return
    }

    setEstado('loading')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { name: nome },
      },
    })

    if (error) {
      setEstado('error')
      setMensagemErro(mapErrorMessage(error.message))
      return
    }

    // Se confirmação de e-mail está ativa, o usuário não tem sessão ainda
    if (data.session === null) {
      setEstado('success')
      setMensagemSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      return
    }

    // Confirmação desativada — redireciona direto
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
          NOVO PARTICIPANTE
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
          CADASTRO
        </p>
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '1.5rem',
        }}
      />

      {/* Mensagem de sucesso */}
      {estado === 'success' && mensagemSucesso && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '13px',
            color: 'var(--color-win)',
            padding: '0.5rem',
            border: '1px solid var(--color-win)',
            marginBottom: '1rem',
          }}
        >
          ✓ {mensagemSucesso}
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="Nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          autoComplete="name"
          placeholder="Seu nome"
        />

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
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
        />

        <Input
          label="Confirmar Senha"
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Repita a senha"
          hasError={senhasDiv}
          error={senhasDiv ? 'As senhas não coincidem' : undefined}
        />

        {/* Mensagem de erro do servidor */}
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
          {estado === 'loading' ? 'CRIANDO CONTA...' : 'CRIAR CONTA'}
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
        Já tem conta?{' '}
        <Link
          href={searchParams.get('redirect') ? `/login?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : '/login'}
          style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          FAÇA LOGIN
        </Link>
      </p>
    </div>
  )
}
