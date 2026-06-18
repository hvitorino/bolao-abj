import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavLinks } from './nav-links'
import { GroupMenu } from './group-switcher'
import { GroupChatWidget } from '@/components/bolao/GroupChatWidget'

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

  const [{ data: groupRows }, { data: profile }] = await Promise.all([
    supabase
      .from('group_members')
      .select('role, joined_at, groups(id, name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true }),
    supabase.from('profiles').select('name').eq('id', user.id).single(),
  ])

  const groups = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return { id: g?.id ?? '', name: g?.name ?? '', role: row.role }
  })

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value
  const activeGroup = groups.find((g) => g.id === cookieGroupId) ?? groups[0]

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
          padding: '0.625rem 1.5rem 0',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Linha 1: logo à esquerda, menu de grupo à direita */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.5rem',
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

            <GroupMenu
              groups={groups}
              activeGroupId={activeGroup?.id}
              pendingInvitesCount={pendingInvitesCount ?? 0}
              userName={profile?.name ?? user.email ?? ''}
            />
          </div>

          {/* Linha 2: navegação */}
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            <NavLinks />
          </div>
        </div>
      </header>

      <main style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>{children}</div>
      </main>

      {activeGroup && (
        <GroupChatWidget
          activeGroupId={activeGroup.id}
          activeGroupName={activeGroup.name}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}
