# Plano de Implementação: Perfil com Estatísticas

**Slug:** perfil-com-estatisticas
**Branch:** feature/perfil-com-estatisticas
**Data:** 2026-06-21
**Spec:** .pipeline/perfil-com-estatisticas-spec.md

## Tarefas

- [ ] 1. Criar migration `20260621400000_create_profile_stats_function.sql` com a função `get_profile_stats(p_group_id, p_user_id)` usando lógica de gaps-and-islands para `best_streak`
- [ ] 2. Implementar `GET /api/profile/stats` em `app/api/profile/stats/route.ts` — autenticação Bearer JWT, verificação de membership, chamadas paralelas RPC + queries, cálculo de taxas no JS, retorno JSON com o shape definido na spec
- [ ] 3. Criar Client Component `components/bolao/ProfileStats.tsx` com estados loading/error/populated, fetch do endpoint com JWT, layout terminal estilo Elifoot conforme especificado na spec
- [ ] 4. Criar Server Component `app/(dashboard)/perfil/page.tsx` — autenticação via `createClient()`, `resolveActiveGroup()`, busca de `profile.name`, e renderização do `<ProfileStats>`
- [ ] 5. Adicionar entrada `{ href: '/perfil', label: 'PERFIL' }` no array `NAV_ITEMS` de `app/(dashboard)/nav-links.tsx`
