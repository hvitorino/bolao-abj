import Link from 'next/link'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { JoinGroupButton } from '@/components/bolao/JoinGroupButton'

interface ConvitePageProps {
  params: Promise<{ token: string }>
}

export const metadata = {
  title: 'Convite — Bolão da Copa',
}

// Rota pública: a resolução do token precisa contornar o RLS de `groups`,
// já que um usuário ainda não-membro (ou nem autenticado) precisa ver o
// nome do grupo antes de decidir entrar. Mesmo padrão de
// app/api/groups/resolve-invite/route.ts, mas em query direta server-side
// (sem round-trip HTTP) já que esta página roda no servidor.
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  padding: '2rem',
}

const pageWrapperStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

export default async function ConvitePage({ params }: ConvitePageProps) {
  const { token } = await params

  const { data: group, error } = await serviceClient()
    .from('groups')
    .select('id, name')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !group) {
    return (
      <div style={pageWrapperStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-error)',
                margin: 0,
              }}
            >
              ✗ CONVITE INVÁLIDO OU EXPIRADO
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: '1.5rem',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontSize: '12px',
                textTransform: 'uppercase',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
              }}
            >
              IR PARA O LOGIN
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const redirectTarget = `/convite/${token}`

  return (
    <div style={pageWrapperStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-accent)',
              margin: 0,
            }}
          >
            CONVITE PARA GRUPO
          </h1>
          <p
            style={{
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text)',
              margin: '0.75rem 0 0',
              fontWeight: 'bold',
            }}
          >
            {group.name}
          </p>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            marginBottom: '1.5rem',
          }}
        />

        {!user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-muted)',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Entre ou cadastre-se para participar deste grupo.
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
              style={{ textDecoration: 'none' }}
            >
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '0.625rem 1.5rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-bg)',
                  border: '1px solid var(--color-primary)',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                ENTRAR / CADASTRAR
              </button>
            </Link>
          </div>
        ) : (
          <JoinGroupButton inviteToken={token} groupId={group.id} />
        )}
      </div>
    </div>
  )
}
