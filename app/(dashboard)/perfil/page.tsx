import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { PerfilDashboard } from '@/components/bolao/perfil/PerfilDashboard'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

export const metadata = {
  title: 'Perfil — Bolão da Copa',
}

export default async function PerfilPage() {
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
    undefined,
    '/perfil',
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
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <PerfilDashboard groupId={activeGroup.groupId} userId={user.id} />
    </div>
  )
}
