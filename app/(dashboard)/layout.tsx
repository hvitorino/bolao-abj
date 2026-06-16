import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './logout-button'
import { NavLinks } from './nav-links'
import { GroupSwitcher } from './group-switcher'

interface GroupRow {
  role: 'admin' | 'member'
  groups: { id: string; name: string } | { id: string; name: string }[] | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Grupos do usuário, para o seletor de grupo ativo no header.
  const { data: groupRows } = await supabase
    .from('group_members')
    .select('role, joined_at, groups(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const groups = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return { id: g?.id ?? '', name: g?.name ?? '', role: row.role }
  })

  // Contagem de convites nominais pendentes endereçados ao usuário, exibida
  // como badge no header em qualquer página do dashboard.
  const { count: pendingInvitesCount } = await supabase
    .from('group_invites')
    .select('id', { count: 'exact', head: true })
    .eq('invited_user_id', user.id)
    .eq('status', 'pending')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Logo + navegação principal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-accent)',
            }}
          >
            BOLÃO DO CARTOLA ABJ
          </span>

          {/* Links de navegação */}
          <NavLinks />
        </div>

        {/* Grupo ativo + usuário + logout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {groups.length > 0 ? (
            <GroupSwitcher groups={groups} />
          ) : (
            <Link
              href="/grupos"
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontWeight: 'bold',
                border: '1px solid var(--color-primary)',
                padding: '0.3rem 0.5rem',
              }}
            >
              CRIAR/ENTRAR EM UM GRUPO
            </Link>
          )}

          {(pendingInvitesCount ?? 0) > 0 && (
            <Link
              href="/grupos"
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-accent)',
                textDecoration: 'none',
                fontWeight: 'bold',
                border: '1px solid var(--color-accent)',
                padding: '0.3rem 0.5rem',
                whiteSpace: 'nowrap',
              }}
            >
              ✉ {pendingInvitesCount} {pendingInvitesCount === 1 ? 'CONVITE' : 'CONVITES'}
            </Link>
          )}
          <span
            className="hidden sm:inline-block"
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Conteúdo principal */}
      <main
        style={{
          padding: '1.5rem',
        }}
      >
        {children}
      </main>
    </div>
  )
}
