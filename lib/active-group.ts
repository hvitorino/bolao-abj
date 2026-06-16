import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve o grupo ativo de uma página do dashboard (`/jogos`, `/ranking`,
 * `/meus-palpites`) a partir do query param `?group=`, com fallback/redirect
 * conforme a spec da feature `grupos`:
 *
 * - Se `groupParam` ausente: busca o primeiro grupo do usuário (por
 *   `joined_at ASC`) e redireciona para a mesma rota com `?group=<id>`
 *   anexado, preservando os demais params (ex: `date`).
 * - Se o usuário não pertence a nenhum grupo: redireciona para `/grupos`.
 * - Se `groupParam` presente mas o usuário não é membro: retorna
 *   `{ error: 'forbidden' }` para a página renderizar o estado de erro
 *   (sem redirect — evita loop e permite mensagem contextual).
 *
 * `redirect()` do Next.js lança internamente (nunca retorna), então as
 * chamadas abaixo não precisam de `return` explícito após `redirect`.
 */
export async function resolveActiveGroup(
  supabase: SupabaseClient,
  userId: string,
  groupParam: string | undefined,
  pathname: string,
  extraParams: Record<string, string | undefined> = {}
): Promise<{ groupId: string; groupName: string } | { error: 'forbidden' }> {
  function buildQuery(params: Record<string, string | undefined>): string {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value)
    }
    const str = qs.toString()
    return str ? `?${str}` : ''
  }

  if (!groupParam) {
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

    redirect(`${pathname}${buildQuery({ ...extraParams, group: firstMembership.group_id })}`)
  }

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
