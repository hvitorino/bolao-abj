import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { RankingTable } from '@/components/bolao/RankingTable'

export const metadata = {
  title: 'Ranking — Bolão do Cartola ABJ',
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

  const activeGroup = await resolveActiveGroup(supabase, user.id, params.group, '/ranking')

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
