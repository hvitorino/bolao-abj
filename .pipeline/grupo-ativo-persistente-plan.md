# Plano de Implementação: Seleção Persistente de Grupo Ativo

**Slug:** grupo-ativo-persistente
**Branch:** feature/grupo-ativo-persistente
**Data:** 2026-06-16
**Spec:** .pipeline/grupo-ativo-persistente-spec.md

## Tarefas

- [x] 1. Atualizar `lib/active-group.ts` — adicionar 6º parâmetro `cookieGroupId`, nova ordem de prioridade (`groupParam` > cookie > fallback por `joined_at ASC` com auto-cura best-effort via `cookies().set()` em try/catch), sem mais redirect para anexar `?group=` quando `groupParam` ausente.
- [x] 2. Criar `app/api/groups/active/route.ts` — `POST` autenticado (Bearer JWT, mesmo padrão de `app/api/groups/route.ts`), valida formato UUID + membership via `service_client`, grava cookie `bolao_active_group` na `NextResponse` e retorna `{ group_id, group_name }`.
- [x] 3. Criar `components/bolao/AtivarGrupoButton.tsx` — client component (`'use client'`) com estados idle/loading/error, usa `supabase.auth.getSession()` para obter JWT, chama `POST /api/groups/active`, em sucesso chama `router.refresh()`.
- [x] 4. Atualizar `app/(dashboard)/grupos/page.tsx` — ler cookie via `cookies()`, calcular `activeGroupId` (cookie válido > primeiro grupo), reestruturar cada linha da lista para separar `<Link>` do nome (para `/grupos/[id]`) do indicador `►`/badge `ATIVO` ou botão `AtivarGrupoButton`, sem aninhar botão dentro do link.
- [x] 5. Atualizar `app/(dashboard)/grupos/[id]/page.tsx` — comparar `id` da rota contra o cookie; exibir badge somente-leitura `GRUPO ATIVO` (`color-accent`) se já ativo, ou `AtivarGrupoButton` caso contrário, ao lado do badge `ADMIN`/`MEMBRO`.
- [x] 6. Atualizar `app/(dashboard)/layout.tsx` — remover import/uso de `GroupSwitcher`; ler cookie `bolao_active_group` diretamente; resolver nome do grupo ativo (cookie > `groups[0]`) apenas para exibição; renderizar indicador estático (`<Link href="/grupos">` recomendado) em vez do `<select>`.
- [x] 7. Remover `app/(dashboard)/group-switcher.tsx` (arquivo `GroupSwitcher` inteiro).
- [x] 8. Atualizar `app/(dashboard)/jogos/page.tsx`, `app/(dashboard)/ranking/page.tsx`, `app/(dashboard)/meus-palpites/page.tsx` — ler `cookieGroupId` via `cookies()` e passar como 6º argumento de `resolveActiveGroup(...)`.
- [x] 9. Validar manualmente os fluxos críticos (deep link não persiste cookie, cookie órfão auto-cura, navegação pelo menu mantém grupo) e rodar `npm run lint` e `npm run build`.
