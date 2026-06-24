import { headers } from 'next/headers'
import { McpOnboarding } from '@/components/bolao/McpOnboarding'
import { ChangePasswordForm } from '@/components/bolao/ChangePasswordForm'

export const metadata = {
  title: 'Configurações — Bolão ABJ',
}

export default async function ConfiguracoesPage() {
  const headersList = await headers()
  const host = headersList.get('host') ?? 'bolao-abj.vercel.app'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const serverUrl = `${protocol}://${host}/api/mcp`

  const monoStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Título da página */}
      <div>
        <h1
          style={{
            ...monoStyle,
            fontSize: '18px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
            margin: 0,
            marginBottom: '0.25rem',
          }}
        >
          CONFIGURAÇÕES
        </h1>
        <div
          style={{
            ...monoStyle,
            fontSize: '12px',
            color: 'var(--color-muted)',
          }}
        >
          Preferências e integrações da sua conta
        </div>
      </div>

      {/* Separador */}
      <div style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* Seção MCP */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2
          style={{
            ...monoStyle,
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-muted)',
            margin: 0,
          }}
        >
          INTEGRAÇÕES
        </h2>

        <McpOnboarding serverUrl={serverUrl} />
      </section>

      {/* Separador */}
      <div style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* Seção Alterar Senha */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2
          style={{
            ...monoStyle,
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-muted)',
            margin: 0,
          }}
        >
          ALTERAR SENHA
        </h2>

        <ChangePasswordForm />
      </section>
    </div>
  )
}
