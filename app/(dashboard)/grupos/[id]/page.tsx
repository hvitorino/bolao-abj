import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CopyInviteLink } from '@/components/bolao/CopyInviteLink'
import type { GroupMemberEntry } from '@/lib/types/group'

interface GrupoDetalhesPageProps {
  params: Promise<{ id: string }>
}

interface GroupMemberRow {
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profiles: { id: string; name: string } | { id: string; name: string }[] | null
}

// Deriva a origem (protocolo + host) a partir dos headers da requisição —
// não há env var de site URL configurada neste projeto, e essa abordagem
// funciona corretamente tanto em dev local quanto em qualquer ambiente Vercel
// (preview/produção) sem precisar manter a URL em sincronia manualmente.
async function getSiteOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export default async function GrupoDetalhesPage({ params }: GrupoDetalhesPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, invite_token')
    .eq('id', id)
    .maybeSingle()

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (groupError || !group || !membership) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div
          style={{
            border: '1px solid var(--color-error)',
            backgroundColor: 'var(--color-surface)',
            padding: '1.5rem',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--color-error)', fontSize: '13px' }}>
            ✗ GRUPO NÃO ENCONTRADO OU VOCÊ NÃO TEM ACESSO
          </span>
          <Link
            href="/grupos"
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontSize: '12px',
              textTransform: 'uppercase',
              fontWeight: 'bold',
            }}
          >
            ← VOLTAR PARA MEUS GRUPOS
          </Link>
        </div>
      </div>
    )
  }

  const isAdmin = membership.role === 'admin'

  const { data: membersData } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at, profiles(id, name)')
    .eq('group_id', id)
    .order('role', { ascending: false }) // 'admin' > 'member' alfabeticamente — admins primeiro
    .order('joined_at', { ascending: true })

  const members: GroupMemberEntry[] = ((membersData ?? []) as GroupMemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      userId: row.user_id,
      name: profile?.name ?? '—',
      role: row.role,
      joinedAt: row.joined_at,
    }
  })

  let inviteUrl: string | null = null
  if (isAdmin && group.invite_token) {
    const origin = await getSiteOrigin()
    inviteUrl = `${origin}/convite/${group.invite_token}`
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        {/* Cabeçalho: nome do grupo + badge de papel */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text)',
            }}
          >
            {group.name}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: isAdmin ? 'var(--color-accent)' : 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: '1px solid',
              borderColor: isAdmin ? 'var(--color-accent)' : 'var(--color-muted)',
              padding: '0.1rem 0.4rem',
            }}
          >
            {isAdmin ? 'ADMIN' : 'MEMBRO'}
          </span>
        </div>

        {/* Seção de convite — somente admin */}
        {isAdmin && inviteUrl && (
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                marginBottom: '0.5rem',
              }}
            >
              LINK DE CONVITE (REUTILIZÁVEL)
            </div>
            <CopyInviteLink inviteUrl={inviteUrl} />
          </div>
        )}

        {/* Lista de participantes */}
        <div style={{ padding: '1rem' }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-muted)',
              marginBottom: '0.5rem',
            }}
          >
            PARTICIPANTES ({members.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {members.map((member) => (
              <div
                key={member.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: 'var(--color-text)' }}>
                  • {member.name.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: member.role === 'admin' ? 'var(--color-accent)' : 'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {member.role === 'admin' ? 'ADMIN' : 'MEMBRO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Link
          href="/grupos"
          style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontSize: '12px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          ← VOLTAR PARA MEUS GRUPOS
        </Link>
      </div>
    </div>
  )
}
