import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'
const ACTIVE_GROUP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 ano

/**
 * Resolve o grupo ativo de uma página do dashboard (`/jogos`, `/ranking`,
 * `/meus-palpites`) conforme a spec da feature `grupo-ativo-persistente`.
 *
 * Ordem de prioridade:
 *
 * 1. `groupParam` (query `?group=`), se presente — prioridade absoluta sobre
 *    o cookie, para preservar deep links/links compartilhados. Se o usuário
 *    não for membro, retorna `{ error: 'forbidden' }` (sem fallback). Esta
 *    leitura **nunca** grava o cookie — abrir um deep link é uma
 *    visualização pontual, não uma troca de preferência permanente.
 * 2. `cookieGroupId`, se presente e o usuário for membro — usa esse grupo
 *    como ativo, sem redirect (a página renderiza direto com esse groupId,
 *    mantendo a URL "limpa").
 * 3. Fallback: primeiro grupo do usuário por `joined_at ASC`. Se existir,
 *    define como ativo e grava o cookie best-effort (auto-cura de cookie
 *    ausente/órfão). Se o usuário não tiver nenhum grupo, `redirect('/grupos')`.
 *
 * Cookie órfão/inválido (usuário não é mais membro daquele grupo) nunca gera
 * `{ error: 'forbidden' }` — esse erro é reservado exclusivamente para
 * `groupParam` inválido. Cookie órfão cai silenciosamente no fallback.
 *
 * `redirect()` do Next.js lança internamente (nunca retorna).
 */
export async function resolveActiveGroup(
  supabase: SupabaseClient,
  userId: string,
  groupParam: string | undefined,
  pathname: string,
  extraParams: Record<string, string | undefined> = {},
  cookieGroupId: string | undefined = undefined
): Promise<{ groupId: string; groupName: string } | { error: 'forbidden' }> {
  // pathname/extraParams não são mais usados para redirect de `?group=`
  // (mantidos na assinatura por compatibilidade com os chamadores existentes
  // e para eventual uso futuro de outros params específicos de página).
  void pathname
  void extraParams

  async function bestEffortSetCookie(groupId: string) {
    try {
      const cookieStore = await cookies()
      cookieStore.set(ACTIVE_GROUP_COOKIE, groupId, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ACTIVE_GROUP_COOKIE_MAX_AGE,
      })
    } catch {
      // `cookies().set()` falha em Server Components (apenas Route Handlers
      // e Server Actions podem gravar cookies de forma garantida) — ignorado
      // intencionalmente, igual ao padrão já existente em
      // `lib/supabase/server.ts`. A próxima navegação repete o fallback.
    }
  }

  async function firstGroupFallback(): Promise<{ groupId: string; groupName: string } | { error: 'forbidden' }> {
    const { data: firstMembership } = await supabase
      .from('group_members')
      .select('group_id, joined_at, groups(name)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!firstMembership) {
      redirect('/grupos')
    }

    const groupData = firstMembership.groups as { name: string } | { name: string }[] | null
    const groupName = Array.isArray(groupData) ? groupData[0]?.name : groupData?.name

    await bestEffortSetCookie(firstMembership.group_id)

    return { groupId: firstMembership.group_id, groupName: groupName ?? '' }
  }

  if (groupParam) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('user_id', userId)
      .eq('group_id', groupParam)
      .maybeSingle()

    if (!membership) {
      return { error: 'forbidden' }
    }

    const groupData = membership.groups as { name: string } | { name: string }[] | null
    const groupName = Array.isArray(groupData) ? groupData[0]?.name : groupData?.name

    return { groupId: groupParam, groupName: groupName ?? '' }
  }

  if (cookieGroupId) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('user_id', userId)
      .eq('group_id', cookieGroupId)
      .maybeSingle()

    if (membership) {
      const groupData = membership.groups as { name: string } | { name: string }[] | null
      const groupName = Array.isArray(groupData) ? groupData[0]?.name : groupData?.name

      return { groupId: cookieGroupId, groupName: groupName ?? '' }
    }
    // cookie órfão/inválido — cai para o fallback abaixo, sem erro visível.
  }

  return firstGroupFallback()
}
