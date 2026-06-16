# Changelog — Bolão da Copa

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

## [collapse-game-card] — Colapsar/Expandir Card de Jogo com Palpites dos Participantes — 2026-06-16

- Cada `GameCard` em `/jogos` passa a carregar **colapsado** por padrão, ocultando a seção "PALPITES DOS PARTICIPANTES" (`GameParticipantsList`); novo estado local `isParticipantsExpanded` (`useState(false)`) em `components/games/GameCard.tsx`
- Botão `<button type="button">` de toggle (renderizado apenas quando `participants.length > 0`) alterna a exibição, com texto `VER PALPITES ▾` (colapsado) / `OCULTAR PALPITES ▴` (expandido), `aria-expanded` e `aria-controls` corretos — focável via Tab, ativável via Enter/Espaço nativamente
- Estado de expansão é local a cada card via `useState`: múltiplos cards podem ficar expandidos simultaneamente, sem interferência entre eles; ao trocar de dia na navegação, os cards do dia revisitado voltam a montar colapsados (comportamento natural de desmontagem/remontagem do React, sem mecanismo de persistência)
- `useGameRealtime`/`useScoreRealtime` permanecem incondicionais no topo do componente — colapsar a seção de participantes não interrompe as subscriptions Realtime; placar e pontuação provisória continuam atualizando mesmo com o card colapsado
- Feature puramente de UI/interação client-side: sem mudança de schema, sem migration, sem endpoint novo, sem alteração em `GameParticipantsList.tsx`, `GameList.tsx` ou `app/(dashboard)/jogos/page.tsx`

## [fix-loser-score-rule] — Correção da Regra "Somente Placar do Perdedor" — 2026-06-16

- Inverte a condição do bônus "Somente placar do perdedor" (+1 pt) em `lib/scoring.ts` e na função Postgres `calculate_scores_for_game`: antes era concedido quando o usuário ERRAVA o vencedor mas acertava o placar de quem perdeu; agora exige que o usuário TAMBÉM tenha acertado o vencedor (mesmo pré-requisito já usado por "diferença de gols correta" e "somente placar do vencedor"), permanecendo mutuamente exclusivo com placar exato
- Nova migration `supabase/migrations/20260616130000_fix_loser_score_rule.sql` (`CREATE OR REPLACE FUNCTION calculate_scores_for_game`, preservando 100% das demais regras e o scoping por `group_id`), incluindo bloco de recálculo retroativo (`PERFORM calculate_scores_for_game(g.id)`) para todos os jogos `finished`, corrigindo scores já gravados pela regra antiga; migration criada mas não aplicada ao banco como parte desta correção
- `CLAUDE.md` e `components/bolao/ScoringRulesTable.tsx` atualizados para refletir o novo pré-requisito ("Somente placar do perdedor (acertou vencedor)" / nota `requer acerto do vencedor`)
- Página `/como-pontuar`: `EXEMPLO_5` reescrito para ilustrar a regra corrigida (BRA 3×1 ARG, palpite 2×1 → +4 pts); `EXEMPLO_1` e `EXEMPLO_6` ajustados porque, com a regra nova, seus cenários originais passavam a acionar `loser_score` incidentalmente (totais recalculados e validados via `calculateScore()` real)
- Sem mudança de schema, RLS, endpoints Ruby ou mecanismo de Realtime — correção isolada à lógica de pontuação

## [exemplos-por-regra] — Exemplo Dedicado por Regra de Pontuação — 2026-06-16

- Página `/como-pontuar`: os antigos 3 exemplos (cobrindo só 2 das 6 regras isoladamente) foram substituídos por 7 exemplos — 6 numerados (`EXEMPLO_1` a `EXEMPLO_6`), alinhados 1:1 e na mesma ordem das linhas de `SCORING_RULES` em `ScoringRulesTable.tsx`, mais 1 exemplo bônus de empate exato em subseção própria ("EXEMPLO COMPLEMENTAR")
- `components/bolao/ScoringExample.tsx` ganha prop opcional `ruleLabel` — renderiza rótulo `REGRA: <texto>` abaixo do título vinculando visualmente cada card à linha correspondente da tabela; comportamento existente preservado quando a prop não é usada
- Todos os 7 breakdowns (pontos e composição) foram validados programaticamente contra `calculateScore()` de `lib/scoring.ts`, tanto pelo Programador quanto de forma independente pelo Revisor — bateram byte-a-byte
- Exemplo 5 ("Somente placar do perdedor") isola corretamente o cenário em que o vencedor é errado no palpite, evitando o bug histórico do fix-1 de `como-pontuar`
- Grid responsivo ajustado: 1 coluna (`<640px`), 2 colunas (`640–1023px`), 3 colunas (`≥1024px`)
- Sem alteração de backend, banco de dados ou proteção de rotas — feature inteiramente estática

## [grupo-ativo-persistente] — Seleção Persistente de Grupo Ativo — 2026-06-16

- A seleção de "grupo ativo" passa a persistir via cookie HTTP `bolao_active_group` (`Path=/`, `SameSite=Lax`, `Secure` em produção, `Max-Age` de 1 ano, sem `HttpOnly`), eliminando a regressão em que navegar pelo menu perdia o `?group=` da URL e recalculava o primeiro grupo por `joined_at`
- **Endpoint criado:** `POST /api/groups/active` (Next.js Route Handler) — autentica via Bearer JWT, valida `group_id` (UUID + membership via `service_client`, 403 se não-membro) e grava o cookie de grupo ativo em caso de sucesso (200); único endpoint do produto autorizado a escrever esse cookie
- `lib/active-group.ts` (`resolveActiveGroup`) ganha 6º parâmetro `cookieGroupId` e nova ordem de prioridade: `?group=` (deep link, nunca grava cookie) > cookie válido (sem redirect) > primeiro grupo por `joined_at ASC` (fallback com gravação best-effort/auto-cura de cookie órfão)
- **Componente criado:** `components/bolao/AtivarGrupoButton.tsx` (client component) — único gatilho de troca de grupo ativo, presente em `/grupos` (lista, com seta `►`/badge `ATIVO`) e `/grupos/[id]` (badge `GRUPO ATIVO` ou botão conforme o caso)
- `app/(dashboard)/group-switcher.tsx` (`GroupSwitcher`, dropdown no header) removido por completo; `app/(dashboard)/layout.tsx` passa a exibir um indicador estático somente-leitura (`GRUPO: <NOME>`) linkando para `/grupos`
- `app/(dashboard)/jogos/page.tsx`, `app/(dashboard)/ranking/page.tsx`, `app/(dashboard)/meus-palpites/page.tsx` passam a ler o cookie e propagá-lo para `resolveActiveGroup`, sem nenhuma outra mudança de lógica/layout
- Sem migrations — nenhuma tabela do Supabase introduzida ou alterada; nenhuma mudança em RLS, regras de pontuação ou Realtime herdadas da feature `grupos`

## [convites-nominais] — Convites Nominais para Grupos — 2026-06-16

- **Banco de dados** (`create_group_invites`, espelhada em `supabase/migrations/` e `db/migrations/`): tabela `group_invites` (`group_id`, `invited_user_id`, `invited_by`, `status` `pending`/`accepted`/`declined`, `created_at`, `responded_at`), índices auxiliares e índice único parcial `group_invites_unique_pending` (nunca dois convites `pending` simultâneos para o mesmo par grupo/usuário); RLS habilitado com policy `group_invites_select_admin_or_invitee` (admin do grupo vê tudo do grupo, convidado vê o que é endereçado a ele); função `is_group_admin()` (`SECURITY DEFINER`, mesmo padrão de `is_group_member` de `grupos`); função `search_users_to_invite()` (`SECURITY DEFINER`) busca por nome/e-mail em `profiles`/`auth.users` sem nunca expor e-mail de terceiros no retorno
- **Endpoints (Next.js Route Handlers):** `GET /api/groups/[id]/invites/search-users` (busca de usuário a convidar, admin-only), `POST/GET /api/groups/[id]/invites` (criar convite idempotente — `already_member`/`already_pending`/`created` — e listar convites enviados, admin-only), `GET /api/invites/pending` (convites pendentes do usuário autenticado), `POST /api/invites/[id]/accept` e `POST /api/invites/[id]/decline` (resposta do convidado, com checagem de propriedade e status, `409` se já respondido)
- **Componentes/páginas:** `InviteUserSearch` (busca com debounce 400ms + convite) e `PendingInvitesList` (aceitar/recusar) novos; badge `✉ N CONVITE(S)` no header do dashboard (`app/(dashboard)/layout.tsx`); seção "Convites Recebidos" em `/grupos`; seção "Convidar Participante" + "Convites Enviados" em `/grupos/[id]` (somente admin)
- Feature aditiva: nenhuma alteração no fluxo de convite por link reutilizável (`groups.invite_token`, `/convite/[token]`, `resolve-invite`, `join`) nem em `predictions`/`scores`/`ranking`/regras de pontuação

## [grupos] — Grupos Privados (Bolões Isolados) — 2026-06-16

- **Banco de dados (7 migrations, espelhadas em `supabase/migrations/` e `db/migrations/`):**
  - `create_groups_and_members`: tabelas `groups`/`group_members`, função `is_group_member()` (`SECURITY DEFINER`), policies `groups_select_member`/`groups_insert_own`/`group_members_select_member`
  - `add_group_id_to_predictions_and_scores`: coluna `group_id` nullable + índices em `predictions`/`scores`
  - `seed_bolao_ingrisia_group`: cria grupo "Bolão da Ingrisia ABJ", torna "Hamon" admin, migra membros e dados existentes (backfill idempotente)
  - `enforce_group_id_not_null`: `group_id` passa a `NOT NULL`; nova constraint `UNIQUE(user_id, game_id, group_id)` substitui a antiga `UNIQUE(user_id, game_id)`
  - `group_scoped_rls`: policies de `SELECT` em `predictions`/`scores` reescritas para escopo por grupo via `is_group_member`
  - `group_scoped_scoring_trigger`: `calculate_scores_for_game` passa a gravar `group_id`, sem nenhuma alteração na lógica de pontuação (regra de goleada `>=4`/`>=4` preservada)
  - `get_ranking_by_group`: `get_ranking(p_group_id uuid)` substitui a função global, baseada em `group_members` filtrado por grupo
- **Endpoints (Next.js Route Handlers):** `GET/POST /api/groups`, `GET /api/groups/[id]`, `GET /api/groups/resolve-invite`, `POST /api/groups/join`; `predictions` e `ranking` agora exigem `group_id` e validam membership (403 se não-membro)
- **Componentes/páginas:** `/grupos`, `/grupos/novo`, `/grupos/[id]`, `/convite/[token]`, `GroupSwitcher`, `CreateGroupForm`, `CopyInviteLink`, `JoinGroupButton`; `/jogos`, `/ranking`, `/meus-palpites` escopados pelo grupo ativo via novo helper `lib/active-group.ts` (`resolveActiveGroup`)
- `lib/hooks/useRankingRealtime.ts` e `lib/hooks/useLivePointsByUser.ts` passam a receber `groupId` e escopam os canais Realtime por grupo
- `/login` e `/cadastro` passam a suportar `?redirect=`, com `useSearchParams()` envolvido em `Suspense` para preservar o build estático
- Observações não-bloqueantes registradas na revisão: a policy legada `predictions_insert_own` (já existente antes desta feature) foi removida sem impacto, pois todas as escritas usam `service_role`; a view `ranking_view` (não utilizada por nenhum código de aplicação) não foi escopada por grupo e deve ser limpa em uma manutenção futura

## [live-scoring] — Pontuação em Tempo Real Durante Jogos ao Vivo — 2026-06-15

- `lib/scoring.ts`: nova função `calculateLiveScore(game, prediction)` — reaproveita `calculateScore()` sem duplicar regras, tolera placar nulo (`home_score`/`away_score` ainda não definidos) retornando `null`
- `components/bolao/GameParticipantsList.tsx`: nova prop `liveGame`; durante jogos `status === 'live'`, exibe coluna `PTS*` com pontuação parcial por participante (`color-live`), `-` para quem não tem palpite, e legenda `* PROVISÓRIO — RECALCULADO AO VIVO`
- `components/games/GameCard.tsx`: passa `liveGame` (placar já mantido por `useGameRealtime`) para `GameParticipantsList`, sem nova subscription
- `lib/hooks/useLivePointsByUser.ts` (novo): busca jogos `live` + palpites, calcula pontuação parcial agregada por `user_id`, assina canal Realtime `live-points-games` (tabela `games`, evento `UPDATE`) com debounce de 1000ms; degrada graciosamente em erro de rede (loga no console, mantém último valor)
- `components/bolao/RankingTable.tsx`: combina `useRankingRealtime()` + `useLivePointsByUser()`; soma pontuação oficial + pontos parciais de jogos `live`, reordena e recalcula `rank_position` no cliente reproduzindo a semântica de `RANK()` do Postgres (empates recebem a mesma posição, próxima posição distinta "pula" o número de empatados); exibe nota `INCLUI PONTOS PROVISÓRIOS` quando aplicável; `aproveitamento` permanece calculado apenas sobre jogos `finished`
- Nenhuma migration, nenhum endpoint Ruby novo, nenhuma escrita em `scores` — cálculo 100% client-side, sem persistência
- Correção pós-revisão (fix-1): `rank_position` calculado por `applyLivePoints()` inicialmente usava numeração sequencial estrita (`index + 1`), causando regressão visual em empates no topo do ranking (apenas um líder marcado com `►`); corrigido para herdar a posição do item anterior quando os pontos totais são iguais, reproduzindo `RANK() OVER (ORDER BY total_points DESC)` usado por `get_ranking()`

## [fix-live-sync] — Correção: Status ao Vivo e Polling de Fallback — 2026-06-15

- `mapStatus` corrigido em `app/api/admin/sync-games/route.ts` e `supabase/functions/sync-games/index.ts`: passa a usar `event.status.type.state` (`"pre"` | `"in"` | `"post"`) em vez de `name` (`STATUS_IN_PROGRESS`), cobrindo todos os status ao vivo da ESPN (`STATUS_FIRST_HALF`, `STATUS_SECOND_HALF`, `STATUS_HALF_TIME`, etc.)
- Edge Function `sync-games` redeployada com `--no-verify-jwt` para compatibilidade com chamadas do `pg_cron` via `pg_net` (sem header de autorização)
- `useGameRealtime` (`lib/hooks/useGameRealtime.ts`): polling de fallback adicionado — re-fetch direto no Supabase a cada 30s quando o jogo está dentro da janela ativa (10 min antes do início até 3h após); garante atualização de status e placar mesmo se o WebSocket Realtime cair silenciosamente; não roda para jogos encerrados ou fora da janela

## [como-pontuar] — Página Como Pontuar — 2026-06-15

- Página `/como-pontuar` criada com tabela de pontuação e 3 exemplos pedagógicos de cálculo
- Componente `ScoringRulesTable` com os 6 eventos de pontuação, coluna de pontos em `color-accent`, máximo possível (+9) conforme `scoring.ts`
- Componente `ScoringExample` com breakdown linha a linha (check/cross), total e nota explicativa opcional
- Exemplo 1 (BRA 3×1 ARG palpite 3×1): placar exato → +8 pts correto
- Exemplo 2 (BRA 2×0 MEX palpite 1×0): acerto parcial → +3 pts correto (fix-1: `loser_score` não aplica quando vencedor foi acertado)
- Exemplo 3 (ALE 1×1 FRA palpite 1×1): empate exato → +8 pts correto
- Item "REGRAS" adicionado ao array `NAV_ITEMS` em `app/(dashboard)/nav-links.tsx` com comportamento `isActive` automático
- Feature inteiramente estática — sem endpoints Ruby, sem migrations, sem chamadas de API
- Proteção de rota via `DashboardLayout` existente (grupo `(dashboard)`)

## [fix-prediction-visibility] — Correção: Visibilidade Temporal dos Palpites — 2026-06-14

- Migration criada: `supabase/migrations/20260614191000_fix_prediction_visibility_policy.sql` — substitui a política irrestrita de leitura em `predictions` por uma política temporal: usuários autenticados só podem ler palpites de terceiros em jogos que não estão mais em status `pending`.
- `components/bolao/GameParticipantsList.tsx` atualizado com defesa em profundidade: em jogos `pending`, palpites de outros participantes são renderizados como `OCULTO`, independentemente dos dados recebidos do backend.
- Próprio usuário continua vendo seu palpite normalmente em qualquer status de jogo.
- Fix de lint aplicado em `app/(dashboard)/jogos/page.tsx` (uso de `const` para satisfazer `prefer-const`) e em `lib/hooks/useRankingRealtime.ts` (uso de `setTimeout` para evitar `react-hooks/set-state-in-effect`).
- Verificação técnica completa via `npm run lint` e `npm run build` confirmando integridade do projeto.

## [fix-live-scores-display] — Correção: Exibição e Atualização de Placar em Tempo Real — 2026-06-14

- Guarda defensiva adicionada em `useGameRealtime` para não sobrescrever o estado quando `payload.new` chega incompleto (sem `REPLICA IDENTITY FULL` ativo, o payload pode ser `{}`); cast alterado de `payload.new as Game` para `payload.new as Partial<Game>` com validação de `id` e `status` antes de `setGame`
- Early return adicionado em `useScoreRealtime` quando `userId` está vazio ou undefined, evitando criação de canal com nome inválido (`score-${gameId}-`) e subscription que nunca corresponderia ao usuário real
- Migration criada: `db/migrations/20260614_fix_scores_realtime_rls.sql` — política RLS `"users can read own scores"` (`FOR SELECT TO authenticated USING (user_id = auth.uid())`) garantindo que o Realtime do Supabase entregue eventos de scores ao próprio usuário
- `lib/scoring.ts` verificado: sem falsy checks em `home_score` ou `away_score`; usa `===` e `!==` em parâmetros tipados como `number`
- `components/bolao/GameParticipantsList.tsx` verificado: Server Component puro sem hooks, sem alterações necessárias
- `components/games/GameCard.tsx` verificado: lógica `hasScore ? ... : isLive ? '0 × 0' : '- × -'` confirmada correta; sem alterações
- Cleanup de canais (`supabase.removeChannel`) verificado e correto em ambos os hooks modificados

## [fix-long-names] — Correção: Nomes Longos nos Cards de Jogo — 2026-06-14

- Nomes de times longos (ex: "COSTA DO MARFIM") truncados com reticências em vez de quebrar para segunda linha, garantindo altura uniforme em todos os `GameCard`
- `minWidth: 0` adicionado nas duas divs de container de time (colunas `1fr` do grid `1fr auto 1fr`) — correção padrão para truncamento funcionar dentro de CSS Grid items
- `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` adicionados na div do `home_team` e na div do `away_team`
- `minWidth: 0` adicionado no span do venue no footer (flex item já tinha `overflow/ellipsis/nowrap/maxWidth: 160px`, mas precisava de `minWidth: 0` para respeitar essas propriedades)
- Códigos de 3 letras (`home_team_code`, `away_team_code`) e placar central (`minWidth: '80px'`, coluna `auto`) não afetados
- Correção exclusivamente de frontend — nenhuma migration, endpoint ou componente além de `components/games/GameCard.tsx`

## [fix-team-code-display] — Correção: Exibição dos Códigos de Times — 2026-06-14

- Causa raiz identificada: 17 jogos de mata-mata tinham códigos placeholder de 2 chars (`"2A"`, `"SF"`) armazenados como `char(3)` com padding de espaço (`"2A "`, `"SF "`), quebrando alinhamento em fonte monospace
- **Migration 004** (`20260614000004_fix_team_code_padding.sql`): remove espaços trailing via `trim()` e converte colunas `home_team_code`/`away_team_code` de `char(3)` para `varchar(10)` para prevenir recorrência do padding automático
- **Migration 005** (`20260614000005_fix_team_code_placeholders.sql`): converte 17 códigos de 2 chars para 3 chars com mapeamento semântico — `"2A"` → `"2GA"`, `"SF"` → `"SFX"` — regex `'^[12][A-L]$'` cobre todos os 12 grupos da Copa
- **Migration 006** (`20260614000006_team_code_check_constraints.sql`): adiciona `CHECK (length(trim(home_team_code)) = 3)` e `CHECK (length(trim(away_team_code)) = 3)` reforçando a regra de negócio (exatamente 3 chars) na camada de banco
- **`app/api/admin/sync-games/route.ts`**: constante `TEAM_CODE_FALLBACK` (mapa ESPN displayName → código 3 chars) e função `getTeamCode` com fallback e `padEnd(3, 'X')` como salvaguarda final na camada de aplicação
- Nenhum componente frontend alterado — a correção é exclusivamente na camada de dados e de ingestão

## [fix-goleada-scoring] — Correção da Regra de Goleada na Pontuação — 2026-06-14

- Regra de goleada corrigida de `>= 3 gols do vencedor real` para três condições simultâneas: acertou vencedor + vencedor no palpite marcou `>= 4 gols` + diferença real `>= 4 gols`
- Empate nunca concede bônus de goleada (sem vencedor)
- `lib/scoring.ts` — bloco da Regra 6 reescrito com `predWinnerScore >= 4 && realGoalDiff >= 4`; comentário de cabeçalho atualizado
- **Migration criada:** `supabase/migrations/20260614000003_fix_goleada_scoring.sql` — `CREATE OR REPLACE FUNCTION calculate_scores_for_game` com nova variável `v_pred_winner_score` e condição `v_pred_winner_score >= 4 AND v_real_diff >= 4`
- **Documentação:** `CLAUDE.md` — tabela de pontuação atualizada com definição correta da goleada
- Alinhamento lógico exato entre TypeScript e Postgres verificado em todos os 5 casos de teste da spec
- `api/scores/calculate.rb` não alterado (faz apenas RPC, sem lógica de pontuação própria)

## [game-participants-view] — Palpites e Pontuação dos Participantes por Jogo — 2026-06-14

- Seção "PALPITES DOS PARTICIPANTES" adicionada a cada `GameCard` em `/jogos`: lista todos os perfis do bolão com palpite e pontuação
- Palpite exibido no formato `H × A` em `color-accent`; traço `-` em `color-muted` quando participante sem palpite
- Coluna PTS exibida apenas para jogos `finished`, no formato `+N`; omitida para jogos `pending` e `live`
- Usuário logado identificado com prefixo `■` (ASCII) em `color-primary` em sua linha na tabela
- Dados carregados em `Promise.all` com 4 queries paralelas (games, profiles, all predictions, all scores) — sem N+1
- Índices em memória `predByUserGame` e `scoreByUserGame` por chave `"userId:gameId"` para montagem O(1) de `participantsByGameId`
- **Tipo criado:** `lib/types/participant.ts` — interface `ParticipantEntry { userId, name, prediction, points }`
- **Componente criado:** `components/bolao/GameParticipantsList.tsx` — Server Component (sem `'use client'`), tabela compacta estilo Elifoot
- **Componentes modificados:** `components/games/GameList.tsx` (prop `participantsByGameId`), `components/games/GameCard.tsx` (prop `participants`, renderiza `GameParticipantsList`)
- **Página modificada:** `app/(dashboard)/jogos/page.tsx` — estendida para buscar `allProfiles`, `allPredictions` e `allScores` em paralelo e montar `participantsByGameId`
- **Migration SQL:** `db/migrations/20260614_participants_read_policies.sql` — substitui `predictions_select_own` e `scores_select_own` por políticas abertas a todos os autenticados (`USING (true)`); adiciona `profiles_select_all_authenticated` de forma idempotente

## [live-scores-realtime] — Placares em Tempo Real (Realtime) — 2026-06-14

- Migration `db/migrations/20260614_enable_realtime_publications.sql` criada: habilita `REPLICA IDENTITY FULL` em `games` e `scores` e as adiciona à publicação `supabase_realtime` de forma idempotente (blocos `DO $$ IF NOT EXISTS $$`); pré-requisito para que `payload.new` contenha o registro completo nos eventos UPDATE
- `useGameRealtime` refatorado: retorna `GameRealtimeState { game, lastUpdatedAt, connectionStatus }` em vez de `Game` diretamente; callback de status do canal mapeia `SUBSCRIBED → 'connected'` e `CHANNEL_ERROR`/`TIMED_OUT → 'error'`; interface `GameRealtimeState` exportada
- `GameCard` atualizado: desestrutura `{ game: liveGame, lastUpdatedAt }` do hook; exibe `· atualizado há Xs` (ou `Xmin`) em `color-muted` (11px) no footer de jogos ao vivo, apenas após receber o primeiro evento Realtime; `setInterval` de 10s criado somente quando `isLive === true` e limpo no cleanup; `flexWrap: 'wrap'` no footer para suporte a mobile
- `useRankingRealtime` atualizado: adiciona `lastUpdatedAt: Date | null` ao retorno; atualizado após cada `fetchRanking` bem-sucedido (carga inicial e refetches por evento Realtime)
- `RankingTable` atualizado: exibe `● AO VIVO · HH:MM:SS` no header quando `lastUpdatedAt !== null`, formatado com `toLocaleTimeString('pt-BR')`; helper `formatTime` adicionado
- Cleanup de canais Realtime (`supabase.removeChannel`) verificado e correto em todos os hooks modificados
- Build TypeScript e lint passam sem erros novos; único warning pré-existente em `useRankingRealtime.ts` (`react-hooks/set-state-in-effect`) já existia na main antes desta feature
- **Migration criada:** `db/migrations/20260614_enable_realtime_publications.sql`
- **Hooks modificados:** `lib/hooks/useGameRealtime.ts`, `lib/hooks/useRankingRealtime.ts`
- **Componentes modificados:** `components/games/GameCard.tsx`, `components/bolao/RankingTable.tsx`

## [ranking-mobile-fit] — Ajuste Mobile do Ranking — 2026-06-14

- Página `/ranking` cabe inteiramente em 375x667px sem scroll vertical com até 12 participantes (estimativa: 530px de altura total)
- Coluna APROVEIT. ocultada em mobile (`hidden md:table-cell` em `<th>` e `<td>`) e visível a partir de 768px
- Título "RANKING GERAL" e subtítulo removidos de `page.tsx` — redundantes com o cabeçalho interno da `RankingTable`
- Padding das células reduzido de `0.5rem 0.75rem` para `0.35rem 0.5rem` em todos os `<th>` e `<td>`
- Font-size do nome do participante: 12px em mobile, 14px a partir de 768px via classe `.ranking-name-cell` em `globals.css`
- `overflowX: 'auto'` removido do wrapper da `RankingTable` — desnecessário com 3 colunas em mobile
- Indicador `● AO VIVO`, rodapé com legenda, destaque de líder e usuário atual preservados
- Sem alterações no banco de dados, endpoints Ruby ou hook `useRankingRealtime`
- **Componentes modificados:** `app/(dashboard)/ranking/page.tsx`, `components/bolao/RankingTable.tsx`, `components/bolao/RankingRow.tsx`
- **CSS modificado:** `app/globals.css` (regra `.ranking-name-cell`)

## [fix-ranking-visibility] — Correção: Visibilidade no Ranking — 2026-06-14

- Corrigida causa raiz do ranking vazio: `get_ranking()` e `ranking_view` usavam INNER JOIN entre `scores` e `profiles`, excluindo todos os usuários sem pontuação calculada (tabela `scores` vazia antes do primeiro jogo encerrado)
- Migration `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` substitui INNER JOIN por `FROM profiles p LEFT JOIN scores s` com `COALESCE(SUM(s.points), 0)` — todos os perfis cadastrados aparecem com 0 pontos quando ainda sem jogos encerrados
- `RANK()` opera sobre `COALESCE(SUM(s.points), 0)`: participantes com 0 pontos recebem `rank_position = 1` (empate matematicamente correto); desempate estável por `p.name ASC`
- `COUNT(s.id)` retorna 0 corretamente no LEFT JOIN (sem COALESCE adicional necessário)
- `SECURITY DEFINER` mantido para contornar RLS `scores_select_own` e permitir agregação de pontos de todos os usuários
- **Componente modificado:** `components/bolao/RankingTable.tsx` — prop `isLeader` alterada para `entry.rank_position === 1 && entry.total_points > 0`, evitando que todos com 0 pontos sejam destacados simultaneamente como líderes
- Nenhuma alteração necessária em `route.ts`, `useRankingRealtime.ts`, `RankingRow.tsx` ou na página `/ranking` — todos já estavam alinhados

## [predictions-edit] — Edição de Palpites — 2026-06-14

- Usuário pode editar palpite existente enquanto faltam mais de 5 minutos para o jogo (deadline idêntico ao de criação)
- Botão "✎ EDITAR PALPITE" (ghost, borda `color-primary`) exibido em `PredictionDisplay` somente para jogos `pending` antes do deadline
- Clicar em EDITAR reabre o `PredictionForm` pré-preenchido com os placares anteriores
- Botão "CANCELAR" sempre visível no modo edição (independente de deadline expirado) — permite retornar ao display sem reload
- Label do CTA muda para "SALVAR ALTERAÇÃO" no modo edição; título do painel muda para "EDITAR PALPITE"
- Palpite atualizado exibido imediatamente após PATCH bem-sucedido (sem reload); `submitted_at` reflete horário da edição
- Jogos `live` ou `finished` nunca exibem botão EDITAR, mesmo que recebam `matchDate` via props
- Erros mapeados em PT-BR: `deadline_expired` → "Prazo encerrado. Não é possível editar o palpite.", `forbidden` → "Acesso negado."
- **Endpoint criado:** `PATCH /api/predictions/[id]` (Next.js Route Handler) — validações em cascata: 401 JWT → 400 UUID → 404 not found → 403 ownership → 422 status live/finished → 422 deadline temporal → 422 scores inválidos → 200 updated
- **Componentes modificados:** `PredictionDisplay.tsx` (+ `matchDate`, `onEditRequest`; `"use client"` para hover state), `PredictionForm.tsx` (+ `onCancelEdit`, `onSuccess`; modo edição com PATCH), `GameCard.tsx` (+ estado `isEditing`, `currentPrediction`; três ramos exclusivos de renderização)
- **Migration SQL:** `db/migrations/20260614_predictions_update_policy.sql` — política RLS `predictions_update_own` (`FOR UPDATE`, `USING + WITH CHECK auth.uid() = user_id`)
- **Nota:** mensagem client-side de race condition na linha 109 do `PredictionForm` usa "registrar" em vez de "editar" em modo edição — janela de ocorrência de milissegundos, sem impacto funcional

## [ranking] — Ranking em Tempo Real — 2026-06-13

- Página `/ranking` com classificação completa de todos os participantes, ordenada por pontos totais (decrescente)
- Líder destacado com `►` e cor `color-accent`; usuário atual destacado em `color-primary` com fundo sutil e sufixo `(VOCÊ)`
- Aproveitamento (%) calculado no backend: `total_points / (games_predicted * 9) * 100`
- Ranking atualiza automaticamente em tempo real via Supabase Realtime (canal `ranking-scores`, tabela `scores`) — sem reload
- Indicador `"● AO VIVO"` piscante no cabeçalho da tabela
- Links de navegação adicionados ao header do dashboard: `JOGOS | RANKING | PALPITES` com destaque de rota ativa
- **Banco:** `db/migrations/20260613_create_ranking_view.sql` — view `ranking_view`, função `get_ranking()` com `SECURITY DEFINER` para contornar RLS de `scores`
- **Endpoint criado:** `GET /api/ranking` (Ruby) — chama `get_ranking()` via RPC; aproveitamento calculado no servidor; 401/500 tratados
- **Tipo criado:** `lib/types/ranking.ts` — interface `RankingEntry`
- **Hook criado:** `lib/hooks/useRankingRealtime.ts` — fetch inicial + subscription Realtime com cleanup automático
- **Componentes criados:** `components/bolao/RankingRow.tsx`, `components/bolao/RankingTable.tsx` — tabela densa estilo Elifoot
- **Página criada:** `app/(dashboard)/ranking/page.tsx` — Server Component, auth via `supabase.auth.getUser()`
- **Componentes criados:** `app/(dashboard)/nav-links.tsx` — Client Component com `usePathname()` para destaque de nav ativa
- **Componente modificado:** `app/(dashboard)/layout.tsx` — integra `NavLinks` no header

## [scoring] — Pontuação por Jogo em Tempo Real — 2026-06-13

- Cálculo automático de pontos via trigger Postgres `on_game_finished`: quando admin muda status para `finished`, todos os palpites do jogo são calculados e persistidos em `scores` via UPSERT (sem chamada manual)
- Breakdown de bônus exibido no `GameCard` após jogo encerrado: `✓ Acertou o vencedor +3`, `✓ Placar exato +5`, etc. — apenas itens com pontos > 0
- Pontuação atualiza em tempo real via Supabase Realtime (hook `useScoreRealtime`, tabela `scores`)
- Página `/meus-palpites` com tabela compacta estilo Elifoot: JOGO | PALPITE | RESULTADO | PONTOS; total de pontos no rodapé
- Recálculo manual via `POST /api/scores/calculate` (admin-only, `X-Admin-Secret`) para casos de correção de placar pós-encerramento
- **Migration SQL:** `db/migrations/20260613_create_scores.sql` — tabela `scores`, função `calculate_scores_for_game`, trigger `on_game_finished`, RLS (SELECT próprio usuário)
- **Lib criada:** `lib/scoring.ts` — `calculateScore(game, prediction)` espelha a lógica Postgres em TypeScript; `BREAKDOWN_LABELS` em português
- **Tipos criados:** `lib/types/score.ts` — interfaces `Score` e `ScoreBreakdown`
- **Hook criado:** `lib/hooks/useScoreRealtime.ts` — subscription Realtime para tabela `scores` com filtragem por `userId`
- **Componente criado:** `components/bolao/ScoreDisplay.tsx` — breakdown visual com borda `color-primary`, pontos em `color-accent`, checks em `color-win`
- **Endpoint criado:** `POST /api/scores/calculate` (Ruby) — recálculo via RPC Supabase; 401/400/404/422/500 tratados
- **Componentes modificados:** `GameCard.tsx` (+ props `score`, `userId`; integra `ScoreDisplay`), `GameList.tsx` (+ props `scoresByGameId`, `userId`), `app/(dashboard)/jogos/page.tsx` (busca scores server-side)

## [live-scores] — Placares em Tempo Real — 2026-06-13

- Placares e status de jogos atualizados em tempo real via Supabase Realtime (WAL replication), sem reload de página
- Cada `GameCard` subscreve ao canal `game-${gameId}` individualmente; cleanup ao desmontar (sem memory leak)
- Badge "██ AO VIVO ██" pisca (CSS `blink`) em jogos com `status === 'live'`; placar em `color-accent` para jogos `live` e `finished`
- Latência alvo de < 2s desde UPDATE no banco até atualização na tela do usuário
- **Hook criado:** `lib/hooks/useGameRealtime.ts` — `useGameRealtime(gameId, initialGame)` com subscription Realtime e cleanup automático
- **Componente modificado:** `components/games/GameCard.tsx` — integra o hook; interface de props sem alteração
- **Endpoint criado:** `PATCH /api/admin/games/[id]` (Ruby) — atualiza `home_score`, `away_score`, `status`; autenticação via `X-Admin-Secret` header (env var `ADMIN_SECRET`); 401/404/422/500 tratados
- **Banco:** nenhuma migration SQL; configuração manual necessária: `ALTER TABLE games REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE games`

## [predictions] — Palpites — 2026-06-13

- Sistema de palpites na rota `/jogos`: cada GameCard exibe formulário inline para jogos pendentes
- Formulário com dois inputs numéricos estilo LED (borda `color-accent`) para placar casa × visitante
- Deadline automático de 5 minutos antes do início: inputs bloqueados, mensagem "✗ PRAZO ENCERRADO"
- Countdown visual "⏱ FECHA EM Xh Ymin" quando faltam < 2h; muda para `color-error` quando < 30min
- Palpite enviado exibido com "✓ SEU PALPITE" em borda `color-primary`, placar `color-accent`; imutável após envio
- Jogos ao vivo e encerrados: exibe palpite (se enviado) ou "SEM PALPITE" em `color-muted`
- Feedback visual imediato: loading durante envio, mensagem de sucesso/erro após resposta da API
- **Endpoints criados:** `POST /api/predictions` (registra com validação deadline + JWT), `GET /api/predictions?game_id=UUID`
- **Componentes criados:** `PredictionForm.tsx` (Client), `PredictionDisplay.tsx`
- **Componentes modificados:** `GameCard.tsx` (Client Component + prop prediction), `GameList.tsx` (prop predictionsByGameId), `app/(dashboard)/jogos/page.tsx` (busca predictions server-side)
- **Tipos:** `lib/types/prediction.ts` — interface `Prediction`
- **Migration SQL:** `db/migrations/20260613_create_predictions.sql` — tabela `predictions`, UNIQUE(user_id, game_id), RLS (SELECT + INSERT apenas próprio usuário, sem UPDATE/DELETE)

## [game-navigation] — Navegação de Jogos — 2026-06-13

- Visualização de jogos da Copa 2026 por dia na rota `/jogos` (substituiu placeholder)
- Navegação entre dias com botões `◀` e `▶` via URL `?date=YYYY-MM-DD`
- Data padrão ao acessar `/jogos`: dia atual no horário de Brasília (UTC-3)
- Destaque visual para o dia atual ("HOJE") em `color-accent`
- Contagem de jogos por dia e palpites registrados no cabeçalho de navegação
- Jogos ao vivo com badge `██ AO VIVO ██` piscante (`blink`) e borda em `color-live`
- Placar exibido em `color-accent` (quando disponível); status "PENDENTE", "AO VIVO", "ENCERRADO"
- Estado vazio: "NENHUM JOGO NESTE DIA" quando não há jogos na data
- **Endpoints criados:** `GET /api/games?date=YYYY-MM-DD` (autenticado, 401/400/500 tratados)
- **Componentes criados:** `GameCard.tsx`, `GameList.tsx`, `DayNavigator.tsx`
- **Tipos:** `lib/types/game.ts` — interface `Game`, type `GameStatus`
- **Migration SQL:** `db/migrations/20260613_create_games.sql` — tabela `games`, RLS, índices, `UNIQUE(home_team_code, away_team_code, match_date)`
- **Migration adicional:** `db/migrations/20260613_games_unique_match.sql` — adiciona UNIQUE constraint em bancos já existentes
- **Seed script:** `db/seeds/seed_games.rb` — 15 jogos placeholder/fictícios da Copa 2026 em 6 dias (11–16 jun), explicitamente não oficiais; fail-closed em erros de verificação de duplicata; segunda linha de defesa via `on_conflict + resolution=ignore-duplicates`
- **Utilitário de data:** `lib/date.ts` — `dayBoundsInUTC()` calcula limites do dia BRT em UTC com suporte a DST (UTC-3/UTC-2) via `Intl.DateTimeFormat`; `isValidDateString()` com rejeição de datas impossíveis; `todayInBrasilia()`

---

## [auth] — Autenticação — 2026-06-13

- Sistema de autenticação completo via Supabase Auth (e-mail e senha)
- Cadastro de novos participantes com criação automática de perfil na tabela `profiles` via trigger `on_auth_user_created`
- Login com mapeamento de erros em português ("E-mail ou senha incorretos", "E-mail já cadastrado. Faça login.")
- Proteção de rotas via Next.js middleware: não autenticado → `/login`; autenticado em rota pública → `/jogos`
- Persistência de sessão via cookies HttpOnly gerenciados pelo `@supabase/ssr`
- Botão de logout funcional no header do dashboard
- Paleta DESIGN.md aplicada (`color-bg`, `color-surface`, `color-border`, `color-primary`, `color-accent`, `color-error`, `color-muted`, `color-text`)
- Fonte JetBrains Mono em toda a interface via `next/font/google`
- Interface 100% em português, dark mode only, mobile-first (max-width 400px)
- **Componentes criados:** `Button.tsx`, `Input.tsx`, `LogoutButton.tsx`
- **Arquivos de infraestrutura:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`
- **Páginas:** `app/(auth)/login/page.tsx`, `app/(auth)/cadastro/page.tsx`, `app/(dashboard)/jogos/page.tsx` (placeholder)
- **Layouts:** `app/layout.tsx` (root), `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`
- **Migration SQL** (execução manual no Supabase SQL Editor): tabela `profiles`, RLS policies, trigger `on_auth_user_created`
