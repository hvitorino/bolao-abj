import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './logout-button'
import { NavLinks } from './nav-links'
import { GroupSwitcher } from './group-switcher'

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
          padding: '0.625rem 1.5rem 0',
        }}
      >
        {/* Linha 1: grid 3 colunas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            paddingBottom: '0.5rem',
          }}
        >
          {/* Col 1: logo à esquerda */}
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

          {/* Col 2: grupo ativo + convites (centralizado) */}
          <GroupSwitcher
            groups={groups}
            activeGroupId={activeGroup?.id}
            pendingInvitesCount={pendingInvitesCount ?? 0}
          />

          {/* Col 3: email + logout à direita */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <LogoutButton />
          </div>
        </div>

        {/* Linha 2: navegação */}
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <NavLinks />
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
