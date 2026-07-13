import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { ParticipantProfile } from '@/components/bolao/perfil-participante/ParticipantProfile'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

export const metadata = {
  title: 'Perfil do Participante — Bolão da Copa',
}

interface PerfilParticipantePageProps {
  params: Promise<{ userId: string }>
}

function ErrorPanel({ message }: { message: string }) {
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
      {message}
    </div>
  )
}

export default async function PerfilParticipantePage({ params }: PerfilParticipantePageProps) {
  const { userId: targetUserId } = await params

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
    `/perfil/${targetUserId}`,
    {},
    cookieGroupId
  )

  if ('error' in activeGroup) {
    return <ErrorPanel message="✗ VOCÊ NÃO PARTICIPA DESTE GRUPO" />
  }

  // Valida que o alvo é membro do grupo ativo.
  const { data: targetMembership, error: targetMembershipError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', activeGroup.groupId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (targetMembershipError) {
    console.error('[perfil/[userId]] erro ao verificar membership do alvo:', targetMembershipError)
    return <ErrorPanel message="✗ ERRO AO CARREGAR PERFIL" />
  }

  if (!targetMembership) {
    return <ErrorPanel message="✗ PARTICIPANTE NÃO ENCONTRADO NESTE GRUPO" />
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', targetUserId)
    .maybeSingle()

  const targetName: string = targetProfile?.name ?? 'Participante'

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <ParticipantProfile
        groupId={activeGroup.groupId}
        targetUserId={targetUserId}
        targetName={targetName}
      />
    </div>
  )
}
