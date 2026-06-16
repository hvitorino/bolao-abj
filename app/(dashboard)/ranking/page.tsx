import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { RankingTable } from '@/components/bolao/RankingTable'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

export const metadata = {
  title: 'Ranking — Bolão da Copa',
}

interface RankingPageProps {
  searchParams: Promise<{ group?: string }>
}

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value

  const activeGroup = await resolveActiveGroup(
    supabase,
    user.id,
    params.group,
    '/ranking',
    {},
    cookieGroupId
  )

  if ('error' in activeGroup) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          border: '1px solid var(--color-error)',
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--color-error)',
          fontSize: '13px',
        }}
      >
        ✗ VOCÊ NÃO PARTICIPA DESTE GRUPO
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <RankingTable
        currentUserId={user.id}
        groupId={activeGroup.groupId}
        groupName={activeGroup.groupName}
      />
    </div>
  )
}
