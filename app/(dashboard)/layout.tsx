import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './logout-button'
import { NavLinks } from './nav-links'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

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

  // Grupos do usuário — usado para decidir se exibe o indicador de grupo
  // ativo (somente leitura) ou o CTA de lista vazia no header.
  const { data: groupRows } = await supabase
    .from('group_members')
    .select('role, joined_at, groups(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const groups = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return { id: g?.id ?? '', name: g?.name ?? '', role: row.role }
  })

  // Nome do grupo ativo, apenas para exibição estática no header (espelho de
  // leitura). cookie válido > primeiro grupo (melhor esforço) — não grava
  // cookie nem redireciona; resolveActiveGroup() em cada página é a única
  // fonte de verdade real do grupo ativo.
  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value
  const activeGroup = groups.find((g) => g.id === cookieGroupId) ?? groups[0]

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
            BOLÃO DA COPA
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
          {groups.length > 0 && activeGroup ? (
            <Link
              href="/grupos"
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-muted)',
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
                padding: '0.3rem 0.5rem',
                maxWidth: '50vw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              GRUPO: {activeGroup.name.toUpperCase()}
            </Link>
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
