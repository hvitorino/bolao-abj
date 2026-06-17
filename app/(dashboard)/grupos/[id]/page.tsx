import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CopyInviteLink } from '@/components/bolao/CopyInviteLink'
import { InviteUserSearch } from '@/components/bolao/InviteUserSearch'
import { AtivarGrupoButton } from '@/components/bolao/AtivarGrupoButton'
import { DeleteGroupButton } from '@/components/bolao/DeleteGroupButton'
import { MembersList } from '@/components/bolao/MembersList'
import type { GroupMemberEntry } from '@/lib/types/group'
import type { GroupInviteSent } from '@/lib/types/group-invite'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface GrupoDetalhesPageProps {
  params: Promise<{ id: string }>
}

interface GroupMemberRow {
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profiles: { id: string; name: string } | { id: string; name: string }[] | null
}

interface GroupInviteRow {
  id: string
  invited_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  responded_at: string | null
}

const STATUS_LABEL: Record<GroupInviteSent['status'], string> = {
  pending: 'PENDENTE',
  accepted: 'ACEITO',
  declined: 'RECUSADO',
}

const STATUS_COLOR: Record<GroupInviteSent['status'], string> = {
  pending: 'var(--color-muted)',
  accepted: 'var(--color-win)',
  declined: 'var(--color-error)',
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
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

  const cookieStore = await cookies()
  const isActiveGroup = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value === id

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

  // Convites nominais enviados pelo admin deste grupo — somente leitura,
  // a policy de RLS group_invites_select_admin_or_invitee permite a consulta
  // direta via client autenticado do usuário (is_group_admin(group_id, auth.uid())).
  let sentInvites: GroupInviteSent[] = []
  if (isAdmin) {
    const { data: invitesData } = await supabase
      .from('group_invites')
      .select('id, invited_user_id, status, created_at, responded_at')
      .eq('group_id', id)
      .order('created_at', { ascending: false })

    const inviteRows = (invitesData ?? []) as GroupInviteRow[]

    if (inviteRows.length > 0) {
      const invitedUserIds = [...new Set(inviteRows.map((row) => row.invited_user_id))]
      const { data: invitedProfiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', invitedUserIds)

      const nameById = new Map((invitedProfiles ?? []).map((p) => [p.id, p.name] as const))

      sentInvites = inviteRows.map((row) => ({
        id: row.id,
        invitedUserId: row.invited_user_id,
        invitedUserName: nameById.get(row.invited_user_id) ?? '—',
        status: row.status,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      }))
    }
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
        {/* Cabeçalho: nome do grupo + badge de papel + ativação de grupo */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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

            {isActiveGroup ? (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 'bold',
                }}
              >
                GRUPO ATIVO
              </span>
            ) : (
              <AtivarGrupoButton groupId={id} groupName={group.name} />
            )}
          </div>
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

        {/* Convidar participante nominalmente — somente admin */}
        {isAdmin && (
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
              CONVIDAR PARTICIPANTE
            </div>
            <InviteUserSearch groupId={id} />

            {sentInvites.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-muted)',
                    marginBottom: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  CONVITES ENVIADOS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {sentInvites.map((invite) => (
                    <div
                      key={invite.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: 'var(--color-text)' }}>
                        • {invite.invitedUserName.toUpperCase()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            color: STATUS_COLOR[invite.status],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {STATUS_LABEL[invite.status]}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                          {formatDateTime(invite.createdAt)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          <MembersList
            groupId={id}
            initialMembers={members}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* Zona de perigo — somente admin */}
      {isAdmin && (
        <div
          style={{
            border: '1px solid var(--color-error)',
            background: 'var(--color-surface)',
            marginTop: '1rem',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          <div
            style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--color-error)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-error)',
            }}
          >
            ZONA DE PERIGO
          </div>
          <div style={{ padding: '1rem' }}>
            <DeleteGroupButton groupId={id} groupName={group.name} />
          </div>
        </div>
      )}

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
