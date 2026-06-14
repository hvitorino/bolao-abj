# Changelog — Bolão do Cartola ABJ

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

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
