import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GroupMenu } from './group-switcher'
import { TabBar } from '@/components/bolao/TabBar'
import { SidePanelContainer } from '@/components/bolao/SidePanelContainer'

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
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
      </header>

      <main
        style={{
          padding: '1.5rem',
          paddingTop: 'calc(44px + env(safe-area-inset-top) + 1.5rem)',
          paddingBottom: 'calc(52px + env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>{children}</div>
      </main>

      <TabBar />

      {activeGroup && (
        <SidePanelContainer
          groupId={activeGroup.id}
          currentUserId={user.id}
          activeGroupName={activeGroup.name}
        />
      )}
    </div>
  )
}
