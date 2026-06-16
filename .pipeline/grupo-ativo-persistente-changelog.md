# Changelog: Seleção Persistente de Grupo Ativo

**Slug:** grupo-ativo-persistente
**Branch:** feature/grupo-ativo-persistente
**Data:** 2026-06-16
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handlers)

- `app/api/groups/active/route.ts` (novo) — `POST /api/groups/active`. Autentica via Bearer JWT (mesmo padrão de `app/api/groups/route.ts`), valida `group_id` (formato UUID, 422 caso inválido) e membership via `service_client` (403 se o usuário não for membro), e em sucesso grava o cookie `bolao_active_group` (`Path=/`, `SameSite=Lax`, `Secure` condicional a `NODE_ENV === 'production'`, `Max-Age` de 1 ano) na `NextResponse` e retorna `{ group_id, group_name }` (200). Único endpoint do produto que escreve esse cookie.

### Frontend (Next.js/React)

- `lib/active-group.ts` (modificado) — `resolveActiveGroup()` ganhou um 6º parâmetro opcional `cookieGroupId`. Nova ordem de prioridade: `groupParam` (deep link, nunca grava cookie) > `cookieGroupId` válido (sem redirect, URL permanece limpa) > fallback primeiro grupo por `joined_at ASC` (grava cookie best-effort em `try/catch`, auto-cura silenciosa de cookie órfão). O comportamento antigo de `redirect()` para anexar `?group=` quando o param estava ausente foi removido — a função agora resolve e retorna o grupo diretamente.
- `app/(dashboard)/grupos/page.tsx` (modificado) — lê o cookie `bolao_active_group` via `cookies()` para destacar o grupo ativo na lista (seta `►` em `color-accent` + badge `ATIVO`). Cada linha deixou de ser um único `<Link>` envolvendo toda a área: agora o nome do grupo é um `<Link>` independente para `/grupos/[id]`, e o badge `ATIVO`/botão `AtivarGrupoButton` fica em um container irmão (não aninhado no link), evitando `<a>` dentro de `<button>`.
- `app/(dashboard)/grupos/[id]/page.tsx` (modificado) — adiciona ao cabeçalho do card (ao lado do badge `ADMIN`/`MEMBRO`) um badge somente-leitura `GRUPO ATIVO` (`color-accent`) quando o grupo da rota já é o ativo, ou o componente `AtivarGrupoButton` caso contrário.
- `app/(dashboard)/layout.tsx` (modificado) — remove import/renderização de `GroupSwitcher`. Lê o cookie diretamente (`cookies()`) e resolve o nome do grupo ativo (cookie válido > `groups[0]`) **apenas para exibição** — substitui o `<select>` por um `<Link href="/grupos">` estático mostrando `GRUPO: <NOME>`. Mantém o CTA "CRIAR/ENTRAR EM UM GRUPO" inalterado para lista de grupos vazia.
- `app/(dashboard)/group-switcher.tsx` (removido) — componente `GroupSwitcher` (dropdown `<select>` no header) excluído por completo, conforme spec.
- `components/bolao/AtivarGrupoButton.tsx` (novo) — client component (`'use client'`). Estados idle/loading/error. Obtém o JWT via `supabase.auth.getSession()` (mesmo padrão de `JoinGroupButton`/`InviteUserSearch`), chama `POST /api/groups/active` com `Authorization: Bearer <jwt>`, e em sucesso chama `router.refresh()`. Em erro, exibe mensagem inline em `color-error` sob o botão, sem navegar.
- `app/(dashboard)/jogos/page.tsx`, `app/(dashboard)/ranking/page.tsx`, `app/(dashboard)/meus-palpites/page.tsx` (modificados) — cada página agora lê `cookieStore.get('bolao_active_group')?.value` e passa esse valor como 6º argumento de `resolveActiveGroup(...)`. Nenhuma outra mudança de lógica ou layout nessas três páginas.

### Banco de Dados

Nenhuma migration. Esta feature não introduz nem altera nenhuma tabela do Supabase — o único estado persistente novo é o cookie HTTP `bolao_active_group` no navegador do usuário, conforme a spec.

---

## Decisões técnicas

- **Constante `ACTIVE_GROUP_COOKIE` duplicada em 5 arquivos** (`lib/active-group.ts`, `app/api/groups/active/route.ts`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/grupos/page.tsx`, `app/(dashboard)/grupos/[id]/page.tsx`) em vez de centralizada em um módulo compartilhado. Optei por isso para não introduzir um novo arquivo `lib/` para uma única string constante (`'bolao_active_group'`), seguindo o padrão já existente no projeto de pequenas constantes locais por arquivo (ex: `isValidUUID` duplicada em múltiplas rotas de `app/api/groups/**`). Se o Revisor preferir, é trivial extrair para `lib/active-group.ts` e exportar.
- **`pathname` e `extraParams` mantidos na assinatura de `resolveActiveGroup()`** mesmo não sendo mais usados para montar um redirect de `?group=`. Mantive a assinatura para não quebrar as três chamadas existentes (que já passam esses argumentos posicionalmente) e para preservar a possibilidade de uso futuro. Marquei como `void pathname` / `void extraParams` para satisfazer o ESLint (`no-unused-vars`) sem remover os parâmetros.
- **Restruturação da linha em `/grupos`**: a spec exigia que o botão "ATIVAR" não ficasse aninhado dentro do `<Link>` que antes envolvia toda a linha. Implementei trocando o `<Link>` único por um `<div>` de linha contendo um `<Link>` menor (apenas nome + seta) e um `<div>` irmão com badge de role + indicador de ativo/botão. Isso preserva a navegação para `/grupos/[id]` ao clicar no nome, sem violar regras de HTML (nada de `<button>`/`<a>` aninhado).
- **Header (`layout.tsx`) usa fallback `groups[0]` apenas para exibição**, nunca grava cookie nem redireciona dali — a spec é explícita que o layout é só um "espelho de leitura". A função `resolveActiveGroup()` em cada página continua sendo a única responsável por de fato persistir o grupo ativo (via auto-cura) ou redirecionar para `/grupos`.

---

## Pontos de atenção para o Revisor

1. **Deep link não persiste o cookie** — confirmar que `resolveActiveGroup()` realmente não chama `bestEffortSetCookie` no branch de `groupParam` (linhas do branch `if (groupParam)` em `lib/active-group.ts`). Esse é o ponto crítico mais fácil de "corrigir por engano" — a spec pede explicitamente que isso NÃO seja tratado como bug.
2. **Cookie órfão cai silenciosamente no fallback** — testar removendo manualmente o usuário de um grupo cujo `id` está no cookie e confirmar que não aparece nenhum erro visível, apenas o primeiro grupo por `joined_at` é exibido e o cookie é regravado.
3. **Idempotência de `POST /api/groups/active`** — chamar com um `group_id` já ativo deve retornar 200 normalmente (não há tratamento especial no código, e não deveria precisar).
4. **Ausência de testes automatizados** — não há suíte de testes no projeto (confirmar); a validação foi feita via `npm run lint` + `npm run build` (ambos passaram) e leitura cuidadosa do fluxo. Recomendo ao Revisor validar manualmente os critérios de aceite mais sensíveis (navegação pelo menu mantendo grupo, F5 mantendo grupo, deep link não persistindo) em ambiente local com Supabase configurado.
5. **`app/(dashboard)/grupos/[id]/page.tsx`** — o `AtivarGrupoButton` é renderizado mesmo quando `groupError || !group || !membership` já causou um `return` antecipado de tela de erro — confirmar que esse early return (já existente, inalterado) realmente impede a renderização do card e do botão em caso de grupo inacessível.
6. **Estilo do indicador no header** — usei `color-muted` para o texto do indicador de grupo ativo (`GRUPO: <NOME>`), igual ao que o `GroupSwitcher` antigo usava como cor base do `<select>` fechado; a spec sugere `color-muted` ou `color-text` — fiquei com `color-muted` por ser o que mais se aproxima visualmente do "rótulo informativo" descrito. Avaliar se o Revisor prefere `color-text` para maior destaque.
7. **Mobile** — não há `media query` nova; os containers usam `flexWrap: 'wrap'` consistente com o padrão já existente nas páginas, mas vale confirmar visualmente em viewport estreita que o botão `AtivarGrupoButton` (que tem `alignItems: 'flex-end'` interno) não quebra o alinhamento da linha em `/grupos`.

---

## Commits realizados

```
8718aaa feat(grupo-ativo-persistente): passa cookieGroupId para resolveActiveGroup em jogos, ranking e meus-palpites
3fc00b0 feat(grupo-ativo-persistente): remove GroupSwitcher e adiciona indicador estático de grupo ativo no header
dc74c63 feat(grupo-ativo-persistente): adiciona badge GRUPO ATIVO e AtivarGrupoButton em /grupos/[id]
4186ca3 feat(grupo-ativo-persistente): destaca grupo ativo e adiciona AtivarGrupoButton em /grupos
583e43d feat(grupo-ativo-persistente): adiciona componente AtivarGrupoButton
7550f6d feat(grupo-ativo-persistente): adiciona POST /api/groups/active para ativar grupo via cookie
1217f08 feat(grupo-ativo-persistente): adiciona cookieGroupId e nova ordem de prioridade em resolveActiveGroup
ddcbdb7 chore(grupo-ativo-persistente): adiciona plano de implementação
```

`npm run lint` e `npm run build` executados com sucesso após a última alteração (rota `/api/groups/active` aparece corretamente na listagem de rotas do build).
