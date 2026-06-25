import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesLiveSection } from './palpites-live-section'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface GroupRow {
  joined_at: string
  groups: { id: string } | { id: string }[] | null
}

export default async function PalpitesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Resolver groupId — idêntico ao layout.tsx
  const { data: groupRows } = await supabase
    .from('group_members')
    .select('joined_at, groups(id)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const groups = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return { id: g?.id ?? '' }
  })

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value
  const activeGroup = groups.find((g) => g.id === cookieGroupId) ?? groups[0]

  if (!activeGroup?.id) redirect('/grupos')

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Título da página */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-muted)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.5rem',
        }}
      >
        PALPITES
      </div>

      {/* Componente client que orquestra dados e UI */}
      <PalpitesLiveSection groupId={activeGroup.id} currentUserId={user.id} />
    </div>
  )
}
