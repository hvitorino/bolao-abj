# Changelog: Grupos Privados (Bolões Isolados)

**Slug:** grupos
**Branch:** feature/grupos
**Data:** 2026-06-15
**Status:** aprovado

**Notas da revisão:** Aprovado sem ressalvas bloqueantes. Duas observações não-bloqueantes registradas para limpeza futura:
1. A migration `group_scoped_rls` remove a policy `predictions_insert_own`, que na verdade já existia desde `20260613000003_create_predictions.sql` (a spec afirmava incorretamente que ela não existia antes). Funcionalmente inofensivo — todas as escritas passam pelo `service_role`, que ignora RLS.
2. A view `ranking_view` (criada em `20260614000001_fix_ranking_all_profiles.sql`) não foi removida nem escopada por `group_id` nesta feature. Confirmado que não é referenciada em nenhum código de aplicação ativo (`grep` em todo o repo), portanto sem risco de vazamento de dados hoje. Recomenda-se removê-la ou escopá-la em uma limpeza futura.

---

## O que foi implementado

### Banco de Dados (migrations, espelhadas em `supabase/migrations/` e `db/migrations/`)

- `create_groups_and_members` — cria tabelas `groups` (`id`, `name`, `invite_token UNIQUE`, `created_by`, `created_at`) e `group_members` (`group_id`, `user_id`, `role`, `joined_at`), índices (`idx_group_members_user_id`, `idx_group_members_group_id`), RLS habilitado, função `is_group_member(p_group_id, p_user_id)` (`SECURITY DEFINER`) e policies `groups_select_member`, `groups_insert_own`, `group_members_select_member`.
- `add_group_id_to_predictions_and_scores` — adiciona `group_id` **nullable** (ainda sem `NOT NULL`) em `predictions` e `scores`, com FK `ON DELETE CASCADE` e índices (`idx_predictions_group_id`, `idx_scores_group_id`, `idx_predictions_user_game_group`).
- `seed_bolao_ingrisia_group` — script idempotente (`DO $...$`, `ON CONFLICT`/`WHERE ... IS NULL`) que cria o grupo "Bolão da Ingrisia ABJ", torna "Hamon" admin (lookup por `profiles.name ILIKE 'Hamon'`, com `RAISE EXCEPTION` se não encontrado — interrompe a migration em vez de seguir silenciosamente em estado inconsistente), cria memberships `member` para os demais perfis existentes, e faz o backfill de `group_id` em `predictions`/`scores` (`WHERE group_id IS NULL`). Token gerado via `translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_')` (URL-safe, pgcrypto).
- `enforce_group_id_not_null` — `ALTER COLUMN group_id SET NOT NULL` em ambas as tabelas; remove a constraint antiga `UNIQUE(user_id, game_id)` e cria `predictions_user_game_group_unique UNIQUE(user_id, game_id, group_id)`.
- `group_scoped_rls` — substitui as policies de `SELECT` de `predictions`/`scores` por versões escopadas via `is_group_member`. Esta migration faz `DROP POLICY IF EXISTS` de **todas** as policies de `SELECT` encontradas via grep no histórico de migrations do projeto (ver "Decisões técnicas").
- `group_scoped_scoring_trigger` — `calculate_scores_for_game` reescrita preservando 100% da lógica de pontuação vigente (incluindo a correção de goleada `>=4`/`>=4` já em produção), adicionando apenas `group_id` ao loop e ao `INSERT ... ON CONFLICT (prediction_id) DO UPDATE`.
- `get_ranking_by_group` — `DROP FUNCTION get_ranking()` (assinatura antiga sem parâmetro) e `CREATE FUNCTION get_ranking(p_group_id uuid)`, com a base trocada de `profiles LEFT JOIN scores` para `group_members` filtrado por `p_group_id` `LEFT JOIN scores` (`ON s.user_id = gm.user_id AND s.group_id = gm.group_id`).

### Backend (Next.js Route Handlers — TypeScript, conforme stack real do projeto)

- `lib/invite-token.ts` — `generateInviteToken()`: `randomBytes(24).toString('base64url')`.
- `lib/types/group.ts` — tipos `GroupRole`, `GroupMembership`, `GroupDetails`, `GroupMemberEntry`.
- `app/api/groups/route.ts` — `GET` (lista grupos do usuário) e `POST` (cria grupo + membership admin; retry único de token em colisão `23505`; rollback manual do grupo se a criação da membership falhar, já que o REST do Supabase não oferece transação multi-tabela).
- `app/api/groups/[id]/route.ts` — `GET`: 401/404/403 conforme acesso; retorna `invite_token` somente se `role === 'admin'`; inclui `member_count`.
- `app/api/groups/resolve-invite/route.ts` — `GET` público (`service_role`), resolve `token → {id, name}`.
- `app/api/groups/join/route.ts` — `POST`, idempotente (200 se já membro, 201 se nova membership), 404 se token inválido. `role` sempre `'member'` neste fluxo.
- `app/api/predictions/route.ts` — `GET`/`POST` agora exigem `group_id`; `POST` valida membership (403 `forbidden` se não membro) e inclui `group_id` na checagem de duplicidade e no `INSERT`.
- `app/api/predictions/[id]/route.ts` — `group_id` incluído no `.select()` do `PATCH` (sem mudança de autorização — ownership já é suficiente).
- `app/api/ranking/route.ts` — `GET` exige `group_id`, valida membership, chama `get_ranking(p_group_id)`.

### Frontend (Next.js/React)

**Hooks:**
- `lib/hooks/useRankingRealtime.ts` — assinatura `(groupId: string)`; fetch em `/api/ranking?group_id=`; canal `ranking-scores-${groupId}` com filtro `group_id=eq.${groupId}`.
- `lib/hooks/useLivePointsByUser.ts` — assinatura `(groupId: string)`; query de predictions filtrada por `group_id`; canal `live-points-games-${groupId}`.
- `lib/active-group.ts` (novo) — `resolveActiveGroup()`: helper compartilhado pelas três páginas (`/jogos`, `/ranking`, `/meus-palpites`) que resolve o grupo ativo a partir de `searchParams.group`, com fallback para o primeiro grupo do usuário (redirect preservando outros params) ou para `/grupos` se o usuário não pertence a nenhum grupo; retorna `{ error: 'forbidden' }` (sem redirect) se o `group_id` informado não pertence ao usuário, para a página renderizar um estado de erro contextual.

**Componentes novos:**
- `app/(dashboard)/group-switcher.tsx` — `<select>` que troca o `group` query param preservando os demais (ex: `date`); lê `activeGroupId` via prop opcional ou via `useSearchParams()` como fallback (ver "Decisões técnicas").
- `components/bolao/CreateGroupForm.tsx` — formulário client-side com validação de nome vazio/tamanho máximo, `POST /api/groups`, redirect para `/grupos/[novo_id]`.
- `components/bolao/CopyInviteLink.tsx` — botão `navigator.clipboard.writeText`, feedback "COPIADO!" por 2s.
- `components/bolao/JoinGroupButton.tsx` — `POST /api/groups/join`, loading "ENTRANDO...", redirect para `/jogos?group=<id>`.

**Páginas novas:**
- `app/(dashboard)/grupos/page.tsx` — lista "Meus Grupos" com badge ADMIN/MEMBRO e botão "CRIAR NOVO GRUPO"; estado vazio com CTA.
- `app/(dashboard)/grupos/novo/page.tsx` — wrapper de `CreateGroupForm`.
- `app/(dashboard)/grupos/[id]/page.tsx` — detalhes do grupo: card de convite (somente admin, com `CopyInviteLink`) e lista de participantes (admins primeiro); estado de erro "grupo não encontrado/sem acesso".
- `app/convite/[token]/page.tsx` — rota pública (fora de `(dashboard)`); resolve o token via `service_role`; estado "CONVITE INVÁLIDO OU EXPIRADO"; CTA "ENTRAR/CADASTRAR" (com `?redirect=`) se deslogado, ou `JoinGroupButton` se logado.

**Páginas/componentes modificados:**
- `app/(dashboard)/layout.tsx` — busca os grupos do usuário; renderiza `GroupSwitcher` no header ou link "CRIAR/ENTRAR EM UM GRUPO" se a lista estiver vazia.
- `app/(dashboard)/jogos/page.tsx` — usa `resolveActiveGroup`; todas as queries (`predictions`, `allPredictions`, `allScores`) agora filtram por `group_id`; a lista de "participantes" deixou de ser todos os perfis do sistema e passou a ser os membros do grupo ativo (`group_members JOIN profiles`); cabeçalho exibe o nome do grupo; `GameList`/`GameCard`/`PredictionForm` propagam `groupId` até o `POST /api/predictions`.
- `app/(dashboard)/ranking/page.tsx` — usa `resolveActiveGroup`; passa `groupId`/`groupName` para `RankingTable`.
- `app/(dashboard)/meus-palpites/page.tsx` — usa `resolveActiveGroup`; queries de `predictions` e `scores` filtradas por `group_id`; cabeçalho "MEUS PALPITES — `<NOME DO GRUPO>`".
- `components/bolao/RankingTable.tsx`, `components/games/GameList.tsx`, `components/games/GameCard.tsx`, `components/bolao/PredictionForm.tsx` — propagação de `groupId` ponta a ponta.
- `app/(auth)/login/page.tsx`, `app/(auth)/cadastro/page.tsx` — suportam `?redirect=` opcional (default `/jogos`); ambos os formulários foram movidos para um componente interno envolvido em `<Suspense>` no export default (exigência do Next.js para `useSearchParams()` em página estática — ver "Decisões técnicas").

---

## Decisões técnicas

1. **DROP POLICY mais abrangente do que a spec listou literalmente.** Ao escrever a migration `group_scoped_rls`, encontrei via `grep -rn "CREATE POLICY" supabase/migrations/*.sql` mais policies de `SELECT` em `predictions`/`scores` do que a spec mencionou explicitamente (`predictions_select_own`, `predictions_insert_own`, `scores_select_own`, `"Autenticados podem ler todos os scores"`, além das já citadas `predictions_select_started_or_own`/`predictions_select_all_authenticated`/`scores_select_all_authenticated`). Adicionei `DROP POLICY IF EXISTS` para todas elas, como medida de defesa em profundidade — uma policy permissiva esquecida de uma feature anterior poderia vazar dados entre grupos. **Pedido ao Revisor:** confirmar que a lista de `DROP POLICY` na migration cobre exatamente o que existe no histórico de migrations (useful: `grep -rn "CREATE POLICY" supabase/migrations/*.sql | grep -iE "predictions|scores"`).

2. **`GroupSwitcher.activeGroupId` tornou-se opcional.** A spec define a prop como `activeGroupId: string` (obrigatória) na interface, mas o texto descritivo da mesma seção explica que o layout do dashboard **não tem acesso a `searchParams`** (no App Router, apenas `page.tsx` recebe esse prop, não `layout.tsx`) e por isso o próprio `GroupSwitcher` deveria ler `useSearchParams().get('group')`. Resolvi a contradição tornando `activeGroupId` opcional: se não informado, o componente resolve internamente via `useSearchParams()` (com fallback para o primeiro grupo da lista). O layout hoje não passa essa prop. Isso está mais alinhado com a limitação estrutural do Next.js do que com a assinatura TS literal da spec.

3. **`resolveActiveGroup` como helper compartilhado (`lib/active-group.ts`), não previsto explicitamente como arquivo na spec.** A spec descreve a lógica de fallback/redirect repetida em prosa para as três páginas (`/jogos`, `/ranking`, `/meus-palpites`). Para evitar triplicar a lógica (e o risco de uma das três páginas divergir no comportamento), criei um helper único. Ele difere ligeiramente do texto da spec num ponto: quando o `group_id` da URL não pertence ao usuário, o helper retorna `{ error: 'forbidden' }` em vez de redirecionar — a spec sugere "redireciona para `/grupos` com mensagem de erro **ou** renderiza estado de erro", e optei pela segunda opção (estado de erro inline) por ser mais simples e por evitar um redirect silencioso que esconderia a causa do problema.

4. **Origem do link de convite (`https://<dominio>/convite/<token>`) derivada de `headers()`, não de uma env var.** Não existe `NEXT_PUBLIC_SITE_URL` (ou equivalente) configurada neste projeto. Em `app/(dashboard)/grupos/[id]/page.tsx`, a origem é montada a partir de `x-forwarded-host`/`host` e `x-forwarded-proto` (com fallback para `http`/`localhost:3000` em dev). Funciona corretamente em qualquer ambiente Vercel (preview/produção) sem exigir configuração manual adicional, mas é sensível a proxies que não populem esses headers corretamente — **ponto de atenção para o Revisor**.

5. **Suspense boundary obrigatória em `/login` e `/cadastro`.** Adicionar `useSearchParams()` a essas páginas quebrou o build estático (`useSearchParams() should be wrapped in a suspense boundary`). Resolvido movendo o conteúdo de cada página para um componente interno (`LoginForm`/`CadastroForm`) envolvido em `<Suspense fallback={null}>` no export default. Comportamento visual idêntico (o fallback nunca é percebido em produção pois o conteúdo é client-rendered quase instantaneamente), mas é uma mudança estrutural não mencionada na spec.

6. **Scores também filtrados por `group_id` em `/meus-palpites`**, além da filtragem de `predictions` que a spec pede explicitamente. Um usuário pode (no futuro) ter predictions para o mesmo `game_id` em grupos diferentes; sem o filtro de `group_id` em `scores`, o lookup por `prediction_id` ainda funcionaria corretamente (já que `prediction_id` é uma FK única), mas adicionei o filtro por clareza/defesa em profundidade.

7. **`PredictionForm` envia `group_id` apenas no `POST`, não no `PATCH`.** Conforme a spec: o endpoint `PATCH /api/predictions/[id]` não foi alterado para exigir `group_id` no body (a autorização continua baseada apenas em ownership da prediction). Não há necessidade de enviá-lo na edição.

---

## Pontos de atenção para o Revisor

1. **Ordem de aplicação das migrations em produção é estrita e manual** — não há acesso ao Supabase de produção nesta sessão, então as 7 migrations foram escritas e ficam prontas para aplicação manual, na ordem:
   1. `create_groups_and_members`
   2. `add_group_id_to_predictions_and_scores`
   3. `seed_bolao_ingrisia_group` — **validar antes de aplicar:** confirmar que existe exatamente um perfil com `name ILIKE 'Hamon'` (a migration usa `RAISE EXCEPTION` se não encontrar, então falha de forma segura, mas convém checar antes).
   4. **Checkpoint manual obrigatório:** rodar `SELECT count(*) FROM predictions WHERE group_id IS NULL` e `SELECT count(*) FROM scores WHERE group_id IS NULL` — ambos devem retornar `0` antes de seguir.
   5. `enforce_group_id_not_null` — **validar antes:** confirmar o nome real da constraint antiga a ser removida (a migration assume `predictions_user_id_game_id_key`, nome padrão do Postgres para `UNIQUE(user_id, game_id)`, mas convém confirmar via `\d predictions` em produção antes de aplicar).
   6. `group_scoped_rls`
   7. `group_scoped_scoring_trigger`
   8. `get_ranking_by_group`
   
   Aplicar fora dessa ordem (especialmente RLS antes do backfill) pode bloquear acesso a dados existentes.

2. **Confirmar a lista de `DROP POLICY IF EXISTS`** na migration `group_scoped_rls` contra o histórico real de migrations (ver decisão técnica #1) — fiz essa extensão por iniciativa própria, fora do que a spec listou literalmente.

3. **Mudança de comportamento visível para usuários existentes:** a tela `/jogos` deixou de mostrar "todos os perfis cadastrados no sistema" como participantes e passou a mostrar apenas os membros do grupo ativo. Após a migration de dados, isso não deve mudar nada visualmente (todos os perfis existentes serão membros do único grupo "Bolão da Ingrisia ABJ"), mas é uma mudança de modelo importante a validar.

4. **Geração da URL de convite via `headers()`** (decisão técnica #4) — verificar se funciona corretamente no ambiente de deploy real (Vercel), especialmente se há algum proxy/CDN que possa não popular `x-forwarded-host`/`x-forwarded-proto` como esperado.

5. **`npm run lint` e `npm run build` passam sem erros** (build gera todas as 19 rotas, incluindo as 4 novas: `/grupos`, `/grupos/[id]`, `/grupos/novo`, `/convite/[token]`). Não há testes automatizados no projeto para esta feature (não há suíte de testes configurada no repositório) — a validação ficou restrita a lint + build + revisão manual de código.

6. **Sem acesso a ambiente Supabase real nesta sessão** — as migrations não foram executadas contra nenhum banco (nem local, nem produção). A correção da sintaxe SQL foi verificada por leitura cuidadosa e comparação linha a linha com as migrations vigentes (especialmente o trigger de pontuação, que foi copiado do arquivo já em produção com a correção de goleada, alterando apenas as partes relativas a `group_id`), mas recomenda-se rodar as migrations contra um banco de homologação antes de aplicar em produção.

---

## Commits realizados

```
723eebb chore(grupos): adiciona plano de implementação
42d1bb2 feat(grupos): adiciona migrations de schema, backfill, RLS, trigger e ranking por grupo
32a498b feat(grupos): adiciona endpoints de grupos e escopa predictions/ranking por grupo
aee6774 feat(grupos): escopa hooks de ranking por grupo e adiciona GroupSwitcher/CreateGroupForm
baa83ff feat(grupos): adiciona CopyInviteLink e JoinGroupButton
b9445ac feat(grupos): adiciona páginas de listagem, criação, detalhes de grupo e aceite de convite
37e7f42 feat(grupos): adiciona seletor de grupo ativo no layout e helper resolveActiveGroup
4e28006 feat(grupos): escopa página de jogos e fluxo de palpites por grupo ativo
77f8f13 feat(grupos): escopa páginas de ranking e meus-palpites por grupo ativo
6c7cfda feat(grupos): suporta parametro redirect opcional no login e cadastro
36a1f23 fix(grupos): envolve useSearchParams em Suspense no login e cadastro para build estatico
```
