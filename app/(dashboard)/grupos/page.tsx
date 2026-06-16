import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { AtivarGrupoButton } from '@/components/bolao/AtivarGrupoButton'
import { PendingInvitesList, type PendingInvite } from '@/components/bolao/PendingInvitesList'
import type { GroupMembership } from '@/lib/types/group'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

export const metadata = {
  title: 'Meus Grupos — Bolão da Copa',
}

interface GroupMembershipRow {
  role: 'admin' | 'member'
  joined_at: string
  groups: { id: string; name: string; created_at: string } | { id: string; name: string; created_at: string }[] | null
}

interface PendingInviteRow {
  id: string
  group_id: string
  invited_by: string
  created_at: string
}

export default async function GruposPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('role, joined_at, groups(id, name, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const groups: GroupMembership[] = ((data ?? []) as GroupMembershipRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return {
      id: g?.id ?? '',
      name: g?.name ?? '',
      role: row.role,
      created_at: g?.created_at ?? '',
    }
  })

  // Convites nominais pendentes endereçados a este usuário, em qualquer grupo.
  const { data: pendingInviteRows } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_by, created_at')
    .eq('invited_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const pendingRows = (pendingInviteRows ?? []) as PendingInviteRow[]

  // Grupo ativo (somente leitura aqui) — cookie válido > primeiro grupo por
  // joined_at (melhor esforço, mesma lógica de fallback de resolveActiveGroup).
  // Esta página é a fonte de verdade da TROCA (via AtivarGrupoButton), mas a
  // leitura para destacar o item ativo na lista não grava nem redireciona.
  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value
  const activeGroupId =
    (cookieGroupId && groups.some((g) => g.id === cookieGroupId) ? cookieGroupId : undefined) ??
    groups[0]?.id

  let pendingInvites: PendingInvite[] = []
  if (pendingRows.length > 0) {
    const groupIds = [...new Set(pendingRows.map((row) => row.group_id))]
    const inviterIds = [...new Set(pendingRows.map((row) => row.invited_by))]

    const [{ data: groupsData }, { data: profilesData }] = await Promise.all([
      supabase.from('groups').select('id, name').in('id', groupIds),
      supabase.from('profiles').select('id, name').in('id', inviterIds),
    ])

    const groupNameById = new Map((groupsData ?? []).map((g) => [g.id, g.name] as const))
    const inviterNameById = new Map((profilesData ?? []).map((p) => [p.id, p.name] as const))

    pendingInvites = pendingRows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: groupNameById.get(row.group_id) ?? '—',
      invitedByName: inviterNameById.get(row.invited_by) ?? '—',
      createdAt: row.created_at,
    }))
  }

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
        maxWidth: '720px',
        margin: '0 auto',
      }}
    >
      {/* Convites recebidos — informação mais urgente/actionable da tela */}
      <PendingInvitesList invites={pendingInvites} />

      {/* Erro ao buscar grupos */}
      {error && (
        <div
          style={{
            border: '1px solid var(--color-error)',
            backgroundColor: 'var(--color-surface)',
            padding: '1rem',
            marginBottom: '1rem',
            color: 'var(--color-error)',
            fontSize: '13px',
          }}
        >
          ✗ ERRO AO CARREGAR GRUPOS — tente recarregar a página
        </div>
      )}

      {/* Estado vazio */}
      {!error && groups.length === 0 && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            padding: '2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            VOCÊ AINDA NÃO PARTICIPA DE NENHUM GRUPO
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>
            Crie um grupo ou peça um link de convite a um amigo.
          </span>
          <Link href="/grupos/novo" style={{ textDecoration: 'none' }}>
            <Button type="button">CRIAR NOVO GRUPO</Button>
          </Link>
        </div>
      )}

      {/* Lista de grupos */}
      {!error && groups.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {groups.map((group, index) => {
            const isActive = group.id === activeGroupId
            return (
              <div
                key={group.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  padding: '0.75rem 1rem',
                  borderTop: index > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <Link
                  href={`/grupos/${group.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--color-text)',
                    minWidth: 0,
                  }}
                >
                  {isActive && (
                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>►</span>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{group.name}</span>
                </Link>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      color: group.role === 'admin' ? 'var(--color-accent)' : 'var(--color-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      border: '1px solid',
                      borderColor: group.role === 'admin' ? 'var(--color-accent)' : 'var(--color-muted)',
                      padding: '0.1rem 0.4rem',
                    }}
                  >
                    {group.role === 'admin' ? 'ADMIN' : 'MEMBRO'}
                  </span>

                  {isActive ? (
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 'bold',
                      }}
                    >
                      ATIVO
                    </span>
                  ) : (
                    <AtivarGrupoButton groupId={group.id} groupName={group.name} />
                  )}
                </div>
              </div>
            )
          })}

          {/* Botão de criar grupo no rodapé da lista */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Link href="/grupos/novo" style={{ textDecoration: 'none' }}>
              <Button type="button">CRIAR NOVO GRUPO</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
