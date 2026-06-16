# Changelog: Convites Nominais para Grupos

**Slug:** convites-nominais
**Branch:** feature/convites-nominais
**Data:** 2026-06-16
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados (migrations, espelhadas em `supabase/migrations/` e `db/migrations/`)

- `create_group_invites` (`supabase/migrations/20260616120000_create_group_invites.sql`, espelhada em `db/migrations/20260616_create_group_invites.sql`):
  - Tabela `group_invites` (`id`, `group_id` FK `groups ON DELETE CASCADE`, `invited_user_id` FK `profiles ON DELETE CASCADE`, `invited_by` FK `profiles ON DELETE RESTRICT`, `status` com `CHECK IN ('pending','accepted','declined')`, `created_at`, `responded_at`).
  - Índices `idx_group_invites_group_id`, `idx_group_invites_invited_user_id`, `idx_group_invites_status`.
  - Índice único parcial `group_invites_unique_pending ON (group_id, invited_user_id) WHERE status = 'pending'` — garante no banco que nunca há dois convites pendentes simultâneos para o mesmo par.
  - RLS habilitado; função `is_group_admin(p_group_id, p_user_id)` (`SECURITY DEFINER`, mesmo padrão de `is_group_member` de `grupos`); policy `group_invites_select_admin_or_invitee` (SELECT: admin do grupo vê tudo do grupo, convidado vê o que é endereçado a ele). Sem policy de INSERT/UPDATE — toda escrita via `service_role`.
  - Função `search_users_to_invite(p_query, p_exclude_group_id)` (`SECURITY DEFINER`, `STABLE`) — busca em `profiles.name`/`auth.users.email` via `ILIKE`, exclui quem já é membro do grupo informado, nunca retorna e-mail no `SELECT`, `LIMIT 10`.

### Backend (Next.js Route Handlers — TypeScript, mesmo padrão de `grupos`)

- `lib/types/group-invite.ts` — tipos `GroupInviteStatus`, `GroupInviteSent`, `PendingInviteReceived`, `UserSearchResult`.
- `app/api/groups/[id]/invites/search-users/route.ts` — `GET`: autentica, valida `id` e `q` (mínimo 2 caracteres), exige admin do grupo, chama a RPC `search_users_to_invite`, marca `already_invited` por usuário com uma query adicional `IN (...)` sobre convites `pending` (sem N+1).
- `app/api/groups/[id]/invites/route.ts`:
  - `POST` — exige admin; valida `invited_user_id` (UUID, profile existente); idempotente: `already_member` (200) se já é membro, `already_pending` (200) se já há convite pendente, `created` (201) caso contrário; trata corrida de condição no `INSERT` (`23505`) reconsultando o convite pendente em vez de devolver 500.
  - `GET` — exige admin; lista convites do grupo com nome do convidado (lookup em `profiles`, sem depender de nome de FK para embed), filtro opcional `status`, ordenado por `created_at DESC`.
- `app/api/invites/pending/route.ts` — `GET`: convites `pending` endereçados ao usuário autenticado, com nome do grupo e de quem convidou.
- `app/api/invites/[id]/accept/route.ts` — `POST`: valida que o convite é do usuário autenticado e está `pending` (409 se já respondido); se ainda não é membro, insere em `group_members` com `role = 'member'`; sempre atualiza o convite para `accepted`; idempotente em relação a já ser membro (caso de entrada via link reutilizável enquanto o convite ficava pendente).
- `app/api/invites/[id]/decline/route.ts` — `POST`: mesma validação de propriedade/status; atualiza para `declined`, sem tocar em `group_members`.

### Frontend (Next.js/React)

- `components/bolao/InviteUserSearch.tsx` (novo, `'use client'`) — input de busca com debounce de 400ms, mínimo de 2 caracteres, estados `idle`/`searching`/`results`/`empty`/`error`; cada resultado mostra "+ CONVIDAR" ou "JÁ CONVIDADO"; trata as respostas `created`/`already_member`/`already_pending` do `POST /api/groups/[id]/invites` com feedback visual por item.
- `components/bolao/PendingInvitesList.tsx` (novo, `'use client'`) — lista de convites recebidos com botões "✓ ACEITAR" (`variant="primary"`, redireciona para `/jogos?group=<id>` em sucesso) e "✗ RECUSAR" (`variant="danger"`, remove da lista local em sucesso); erro inline por item, sem remover o item da lista; retorna `null` quando não há convites (sem estado vazio permanente).
- `app/(dashboard)/layout.tsx` (modificado) — busca a contagem de convites `pending` do usuário (`count` via RLS) e exibe badge `✉ N CONVITE(S)` em `color-accent`, linkando para `/grupos`, ao lado do `GroupSwitcher`; nada é renderizado se a contagem é zero.
- `app/(dashboard)/grupos/page.tsx` (modificado) — busca convites `pending` do usuário (com nome do grupo e de quem convidou) e renderiza `<PendingInvitesList>` acima da seção "Meus Grupos".
- `app/(dashboard)/grupos/[id]/page.tsx` (modificado) — nova seção "CONVIDAR PARTICIPANTE" (somente quando `role === 'admin'`), entre o card de link de convite e a lista de participantes: `<InviteUserSearch>` + lista "CONVITES ENVIADOS" (lida diretamente via client autenticado do Server Component, RLS cobre via `is_group_admin`), com cores de status `PENDENTE` (`color-muted`) / `ACEITO` (`color-win`) / `RECUSADO` (`color-error`).

### Banco de Dados — RLS

- Policy nova `group_invites_select_admin_or_invitee` (ver acima). Sem policies de INSERT/UPDATE para `authenticated` — escrita exclusiva via `service_role`, com autorização validada explicitamente em cada Route Handler.

---

## Decisões técnicas

1. **Lookup de nomes via queries separadas em vez de embeds Supabase (`select('...,profiles(...)')`).** `group_invites` tem duas FKs para `profiles` (`invited_user_id` e `invited_by`), o que tornaria um embed direto ambíguo sem especificar o nome exato da constraint (que não foi confirmado em nenhum ambiente real nesta sessão). Em vez de arriscar um nome de constraint incorreto, todos os quatro lugares que precisam exibir nome (`GET /api/groups/[id]/invites`, `GET /api/invites/pending`, e as duas queries equivalentes nos Server Components de `/grupos` e `/grupos/[id]`) fazem uma query adicional `profiles.select('id,name').in('id', [...])` e montam um `Map` local. Mais verboso, mas elimina uma classe de erro de nome de constraint que só seria descoberta em runtime contra um banco real.

2. **`InviteUserSearch` reestruturado para satisfazer a regra de lint `react-hooks/set-state-in-effect`** (ESLint do projeto usa o plugin do React Compiler, que rejeita `setState` síncrono no corpo de um `useEffect`). A spec descreve o debounce como "dispara fetch 400ms depois de parar de digitar"; implementei isso com `useCallback` para `runSearch` (sem chamadas de `setState` fora de um callback assíncrono ou de um `setTimeout`) e movi a transição para o estado `idle` (quando a query fica curta) para o `onChange` do input (`handleQueryChange`), em vez de deixar o `useEffect` decidir isso síncronamente. Comportamento observável é idêntico ao descrito na spec; só a forma como os estados são setados mudou para passar pelo lint do projeto.

3. **`POST /api/groups/[id]/invites` aceita apenas `invited_user_id` como UUID válido, retornando `422` se a string não bater com o formato UUID** — a spec pede 422 para "ausente/inválido"; tratei "não é uma string UUID" como inválido (em vez de deixar passar e falhar mais tarde na query, retornando um 404/500 confuso).

4. **`db/migrations/` é uma cópia byte-a-byte de `supabase/migrations/`** para esta migration, assim como confirmado ser o padrão em todas as migrations de `grupos` (`diff` entre os pares correspondentes não mostrou nenhuma diferença).

5. **`requireGroupAdmin` extraído como helper local dentro de `app/api/groups/[id]/invites/route.ts`**, reutilizado pelo `POST` e `GET` daquele arquivo — evita duplicar a checagem de "grupo existe + usuário é admin" nos dois handlers do mesmo arquivo. Não foi extraído para um módulo compartilhado em `lib/` porque os outros dois endpoints que também checam admin (`search-users`) têm uma forma ligeiramente diferente de compor a resposta de erro e a duplicação ali é pequena (cerca de 25 linhas) — optei por não introduzir uma abstração cross-arquivo para esse tamanho de duplicação.

---

## Pontos de atenção para o Revisor

1. **Nenhuma migration foi executada contra um banco real nesta sessão** (mesma limitação já registrada em `grupos`). A migration `20260616120000_create_group_invites.sql` foi escrita e revisada por leitura cuidadosa, comparando o SQL produzido linha a linha com o que a spec especifica literalmente — recomenda-se aplicá-la contra um ambiente de homologação antes de produção.

2. **Nome da constraint de FK para embeds Supabase não foi validado contra um banco real** (ver decisão técnica #1) — optei por evitar o problema inteiramente fazendo lookups separados, mas se o Revisor preferir embeds nomeados por padrão de performance, seria necessário primeiro confirmar os nomes reais das constraints (`invited_user_id_fkey` vs. nome customizado) contra a migration aplicada.

3. **`search_users_to_invite` faz `JOIN auth.users`** — mesma técnica (`SECURITY DEFINER`) já usada no projeto para outras necessidades de acesso a `auth.users`? Não há precedente direto no código atual (a feature `grupos` não precisou ler `auth.users`), então esta é a primeira function do projeto a fazer esse tipo de JOIN. Vale confirmar que a permissão padrão do Supabase para functions `SECURITY DEFINER` sobre `auth.users` funciona como esperado no projeto real (deveria, pois o owner da function é o `postgres`/superuser que já tem acesso, mas não há como testar nesta sessão sem acesso a um Supabase real).

4. **Idempotência da criação de convite testada apenas por leitura de código, não por execução real** — a sequência "checa membership → checa pending → insere → trata 23505 como fallback" está implementada exatamente como a spec descreve (incluindo o fallback de corrida de condição), mas não foi exercitada contra um banco real nesta sessão.

5. **`PendingInvitesList` redireciona via `router.push` apenas no aceite, nunca no recurso** — conforme a decisão já tomada explicitamente na spec ("redireciona imediatamente para `/jogos?group=<id>`"), sem o estado de confirmação "✓ Você entrou em..." por 2 segundos que a spec menciona como alternativa descartada. Comportamento implementado é a opção que a spec definiu como decisão final.

6. **Badge no header (`app/(dashboard)/layout.tsx`) usa `count: 'exact', head: true`** sobre `group_invites` filtrado por `invited_user_id = auth.uid() AND status = 'pending'`, via client autenticado do usuário (não `service_role`) — depende da policy `group_invites_select_admin_or_invitee` permitir a leitura (`invited_user_id = auth.uid()` cobre o caso). Mesmo padrão de leitura direta via RLS já usado pelo layout para a lista de `groups`.

7. **`npm run lint` e `npm run build` executados com sucesso** após todas as mudanças (rodados várias vezes durante a implementação, última vez após o commit final). Build gera as 3 novas rotas de API dentro de `/api/groups/[id]/invites`, `/api/groups/[id]/invites/search-users`, `/api/invites/pending`, `/api/invites/[id]/accept`, `/api/invites/[id]/decline`, mais as páginas existentes modificadas (`/grupos`, `/grupos/[id]`) sem nenhuma rota nova de página. Não há suíte de testes automatizados no projeto (mesma situação já registrada em `grupos`) — validação restrita a lint + build + revisão manual de código.

8. **Mecanismo de convite por link reutilizável não foi tocado** — nenhum arquivo de `CopyInviteLink.tsx`, `JoinGroupButton.tsx`, `app/convite/[token]/page.tsx`, `app/api/groups/resolve-invite/route.ts`, `app/api/groups/join/route.ts` foi modificado nesta feature, conforme exigido pela spec. Validação manual (entrar em um grupo via link) não foi possível nesta sessão por falta de acesso a um ambiente real, mas a ausência de diff nesses arquivos pode ser confirmada via `git diff main..feature/convites-nominais -- components/bolao/CopyInviteLink.tsx components/bolao/JoinGroupButton.tsx app/convite app/api/groups/resolve-invite app/api/groups/join`.

---

## Commits realizados

```
eff4a5d chore(convites-nominais): adiciona plano de implementação
f7b6ed2 feat(convites-nominais): adiciona migration de group_invites com RLS e busca de usuarios
cd7822d feat(convites-nominais): adiciona endpoints de busca, criacao, listagem e resposta a convites
4db9c70 feat(convites-nominais): adiciona componentes InviteUserSearch e PendingInvitesList
125f672 feat(convites-nominais): integra badge, lista de recebidos e secao de convidar nas paginas de grupos
```
