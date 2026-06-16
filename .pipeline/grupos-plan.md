# Plano de Implementação: Grupos Privados (Bolões Isolados)

**Slug:** grupos
**Branch:** feature/grupos
**Data:** 2026-06-15
**Spec:** .pipeline/grupos-spec.md

## Observações de leitura prévia

- Confirmado: todos os endpoints ativos (`predictions`, `predictions/[id]`, `ranking`) já são Next.js Route Handlers TypeScript em `app/api/**/route.ts`. Os endpoints novos desta feature seguem o mesmo padrão (sem Ruby).
- Confirmado: `calculate_scores_for_game` vigente (migration `20260614000003_fix_goleada_scoring.sql`) já usa a regra de goleada corrigida (`>=4` em ambos os lados). A nova versão do trigger deve preservar essa lógica linha a linha, adicionando apenas `group_id`.
- Confirmado: `get_ranking()` vigente usa `profiles LEFT JOIN scores` com `COALESCE`. A nova versão troca a base para `group_members` filtrado por `p_group_id`.
- Confirmado: páginas `/jogos`, `/ranking`, `/meus-palpites` e o layout do dashboard existem exatamente como descrito na spec — todas precisarão ser tocadas.
- Como o ambiente local não tem acesso direto ao Supabase de produção, as migrations serão escritas e ficarão prontas para aplicação manual seguindo a ordem estrita da spec (1→2→3→validar→4→5→6→7). O passo de "validar manualmente o nome do usuário Hamon" e "confirmar nome da constraint antiga" serão documentados como instruções explícitas no changelog para quem aplicar em produção, já que não há acesso ao banco real nesta sessão.

## Tarefas

### Banco de dados (migrations, espelhadas em `supabase/migrations/` e `db/migrations/`)

- [x] 1. Migration 1 — `create_groups_and_members`: criar tabelas `groups` e `group_members`, índices, RLS habilitado (sem policies ainda, adicionadas na migration 1 mesmo, conforme spec) e função auxiliar `is_group_member`.
- [x] 2. Migration 2 — `add_group_id_to_predictions_and_scores`: `ALTER TABLE` adicionando `group_id` nullable em `predictions` e `scores`, com índices, sem remover constraint antiga.
- [x] 3. Migration 3 — `seed_bolao_ingrisia_group`: script idempotente de backfill (grupo "Bolão da Ingrisia ABJ", admin "Hamon", memberships, backfill de `group_id`), com token gerado via `translate(encode(gen_random_bytes(24),'base64'),'+/','-_')`.
- [x] 4. Migration 4 — `enforce_group_id_not_null`: `NOT NULL` + drop da constraint antiga (nome a confirmar via comentário explícito) + nova constraint `UNIQUE(user_id, game_id, group_id)`.
- [x] 5. Migration 5 — `group_scoped_rls`: substituir policies de `predictions`/`scores` por versões escopadas por grupo via `is_group_member`.
- [x] 6. Migration 6 — `group_scoped_scoring_trigger`: reescrever `calculate_scores_for_game` incluindo `group_id` no INSERT/ON CONFLICT, preservando 100% da lógica de pontuação vigente.
- [x] 7. Migration 7 — `get_ranking_by_group`: `DROP FUNCTION get_ranking()` + `CREATE FUNCTION get_ranking(p_group_id uuid)`.
- [x] 8. Espelhar as 7 migrations em `db/migrations/` com a convenção `YYYYMMDD_descricao.sql` já usada no projeto.

### Backend — Route Handlers novos

- [x] 9. Criar `lib/invite-token.ts` com `generateInviteToken()` (24 bytes → base64url).
- [x] 10. `POST /api/groups` + `GET /api/groups` em `app/api/groups/route.ts`.
- [x] 11. `GET /api/groups/[id]` em `app/api/groups/[id]/route.ts`.
- [x] 12. `GET /api/groups/resolve-invite` em `app/api/groups/resolve-invite/route.ts`.
- [x] 13. `POST /api/groups/join` em `app/api/groups/join/route.ts`.

### Backend — Route Handlers modificados

- [x] 14. `app/api/predictions/route.ts`: exigir `group_id` no POST e no GET, validar membership, incluir `group_id` na verificação de duplicidade e no INSERT.
- [x] 15. `app/api/predictions/[id]/route.ts`: incluir `group_id` no select (sem mudança de lógica de autorização).
- [x] 16. `app/api/ranking/route.ts`: exigir `group_id` via query param, validar membership, chamar `get_ranking(p_group_id)`.

### Frontend — tipos e hooks

- [x] 17. Adicionar tipos `lib/types/group.ts` (`Group`, `GroupMembership`, etc.).
- [x] 18. Atualizar `lib/hooks/useRankingRealtime.ts` para receber `groupId` (query param + filtro de canal + nome de canal escopado).
- [x] 19. Atualizar `lib/hooks/useLivePointsByUser.ts` para receber `groupId` (filtro de predictions por grupo).

### Frontend — componentes novos

- [x] 20. `app/(dashboard)/group-switcher.tsx` (`GroupSwitcher`, client component).
- [x] 21. `components/bolao/CreateGroupForm.tsx`.
- [x] 22. `components/bolao/CopyInviteLink.tsx`.
- [x] 23. `components/bolao/JoinGroupButton.tsx`.

### Frontend — páginas novas

- [x] 24. `app/(dashboard)/grupos/page.tsx` (lista de grupos).
- [x] 25. `app/(dashboard)/grupos/novo/page.tsx` (formulário de criação).
- [x] 26. `app/(dashboard)/grupos/[id]/page.tsx` (detalhes + link de convite + membros).
- [x] 27. `app/convite/[token]/page.tsx` (rota pública de aceite de convite).

### Frontend — páginas/componentes modificados

- [x] 28. `app/(dashboard)/layout.tsx`: buscar grupos do usuário, renderizar `GroupSwitcher` ou CTA "criar/entrar em grupo".
- [x] 29. `app/(dashboard)/jogos/page.tsx`: ler `group` de `searchParams`, fallback/redirect, filtrar todas as queries por `group_id`, trocar `allProfiles` por membros do grupo.
- [x] 30. `app/(dashboard)/ranking/page.tsx`: ler `group` de `searchParams`, fallback/redirect, passar `groupId`/`groupName` para `RankingTable`.
- [x] 31. `app/(dashboard)/meus-palpites/page.tsx`: ler `group` de `searchParams`, fallback/redirect, filtrar predictions por `group_id`, exibir nome do grupo no cabeçalho.
- [x] 32. `components/bolao/RankingTable.tsx`: nova prop `groupId`/`groupName`, repassar para os hooks, atualizar título.
- [x] 33. `components/games/GameList.tsx`, `GameCard.tsx`, `PredictionForm.tsx`: propagar `groupId` até o body do POST/PATCH de predictions.
- [x] 34. `app/(auth)/login/page.tsx` e `app/(auth)/cadastro/page.tsx`: suportar `?redirect=` opcional, navegando para essa URL após sucesso em vez de `/jogos` fixo.

### Validação final

- [x] 35. Rodar `npm run lint` e `npm run build`; corrigir erros de tipos/lint introduzidos.
- [x] 36. Escrever `.pipeline/grupos-changelog.md` com lista de arquivos, decisões técnicas, passos manuais de produção (ordem de migrations, validação do nome "Hamon", nome da constraint antiga) e pontos de atenção para o Revisor.
- [x] 37. Commit do changelog e invocação do Revisor.
