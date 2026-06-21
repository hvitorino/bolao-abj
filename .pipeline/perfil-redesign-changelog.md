# Changelog: Redesign da Aba de Perfil

**Slug:** `perfil-redesign`
**Branch:** feature/perfil-redesign
**Data:** 2026-06-21
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `supabase/migrations/20260622000001_create_position_snapshots.sql` — tabela `position_snapshots` com chave única `(group_id, user_id, match_day)`, índice por grupo/usuário/data DESC, RLS habilitada com política de leitura para membros do grupo.
- `supabase/migrations/20260622000002_create_snapshot_functions.sql` — função `record_position_snapshots(p_group_id, p_match_day)` idempotente via `ON CONFLICT DO NOTHING`; trigger `trg_snapshot_on_day_close` que dispara após `UPDATE OF status ON games`, grava snapshot apenas quando todos os jogos do `match_day` estão `finished`.
- `supabase/migrations/20260622000003_create_group_avg_points.sql` — função `get_group_avg_points(p_group_id)` retornando média de pontos por palpite de todos os membros do grupo.
- `supabase/migrations/20260622000004_create_profile_history.sql` — função `get_profile_history(p_group_id, p_user_id, p_limit, p_offset)` retornando feed cronológico paginado de jogos encerrados com `is_miss = true` para jogos sem palpite.

### Backend (Next.js Route Handlers)

- `app/api/profile/campaign/route.ts` — `GET /api/profile/campaign`: autenticação Bearer JWT, verifica membership, busca `get_ranking` + snapshot mais recente de `position_snapshots`, calcula `position_delta` e `position_delta_label`, retorna dados para seção SUA CAMPANHA.
- `app/api/profile/performance/route.ts` — `GET /api/profile/performance`: chama `get_profile_stats`, `get_streak_for_group` e `get_group_avg_points` em paralelo via `Promise.all`, calcula taxas e `avg_delta`.
- `app/api/profile/trophies/route.ts` — `GET /api/profile/trophies`: calcula os 15 troféus via queries ao Supabase. Troféus com RPCs inexistentes (`check_perfect_day`, `check_faithful_day`, `check_zebreiro`) foram implementados como queries manuais inline. Resposta ordenada por status (unlocked → locked → secret).
- `app/api/profile/history/route.ts` — `GET /api/profile/history`: chama `get_profile_history` paginado + count total de jogos, enriquece cada item com `trophy_unlocked_id` (badge inline) usando mapeamento `game_id → [trophyIds]` com seleção por raridade.

### Frontend (Next.js/React)

- `components/bolao/perfil/CampaignPanel.tsx` — painel "SUA CAMPANHA" com posição em destaque (2.5rem), pontos, distância para líder/próximo acima, label de movimento colorido (verde = subiu, vermelho = desceu, muted = igual). Variante líder exibe `LÍDER 🟡 · +N sobre o 2º`.
- `components/bolao/perfil/PerformancePanel.tsx` — painel "DESEMPENHO" com barras ASCII (`███░░░`) para acerto de vencedor e placar exato, comparação de média com grupo (`▲/▼/=`), sequência em pílulas `●●●●○` (máx 10).
- `components/bolao/perfil/TrophiesPanel.tsx` — painel "TROFÉUS" com contagem `X / 15` no header; grid 2 colunas para desbloqueados, lista para locked com barra de progresso, secretos com `🔒 ???`; accordion inline (sem modal) via `useState<string | null>(expandedId)`.
- `components/bolao/perfil/HistoryPanel.tsx` — painel "HISTÓRICO" com agrupamento por dia (`▼ DD MMM`), linha por jogo (resultado · palpite · pontos · badge de troféu), marcação `-- FUROU --` para jogos sem palpite, botão "VER MAIS" com paginação offset.
- `components/bolao/perfil/PerfilDashboard.tsx` — orquestrador `'use client'`: fetch paralelo das 4 seções no `useEffect`, estado independente por seção (`SectionState<T>`), `handleLoadMore` com concatenação de itens (sem substituição), passa `trophies` ao `HistoryPanel`.
- `app/(dashboard)/perfil/page.tsx` — atualizado para importar e usar `PerfilDashboard` em vez de `ProfileStats`.

---

## Decisões técnicas

- **RPCs inexistentes no banco**: a spec menciona funções `check_perfect_day`, `check_faithful_day` e `check_zebreiro` que não existem no banco real. Em vez de criar migrations adicionais não especificadas, implementei a lógica diretamente em JavaScript no Route Handler de troféus, iterando sobre dias encerrados. Isso mantém a feature funcional sem alterar o escopo de migrations da spec.
- **`games.match_date` vs `games.match_day`**: o banco usa `match_date` (timestamptz) e `match_day` (date) em campos distintos. As queries de troféus usam `match_date` para obter a data de desbloqueio (via join com `scores`), enquanto o histórico usa `match_day` para agrupamento. Isso é coerente com o schema real.
- **Supabase JS retorna `games` como objeto, não array, em `.maybeSingle()`**: a função `extractMatchDate` no route de troféus trata ambos os formatos (`Array.isArray` ou objeto direto) para robustez.
- **Progresso de `profeta` duplica campo `cravada`**: a spec define que tanto `cravada` quanto `profeta` usam o count de placares exatos (`progress`). O `profeta` tem goal de 5 exatos totais; o `cravada` é desbloqueado no 1º e também exibe o progresso até 5 para consistência visual. Esta duplicação é intencional conforme spec.
- **`ProfileStats.tsx` e `/api/profile/stats`**: mantidos sem alteração (deprecados, não deletados) conforme especificado.
- **Troféus secretos vs locked**: a diferença é comportamental na UI — secretos exibem `🔒 ???` e nunca revelam o critério enquanto bloqueados; locked exibem nome + critério + progresso. A lógica está em `SECRET_TROPHIES` (Set) e na função `makeTrophy`.

---

## Pontos de atenção para o Revisor

1. **Queries de troféus são N+1 no caso do zebreiro**: para cada jogo onde o usuário acertou o vencedor, fazemos 2 queries adicionais (total palpites + total acertos). Em grupos grandes com muitos acertos isso pode ser lento. Alternativa: uma CTE SQL no banco, mas isso exigiria uma migration extra fora da spec.
2. **Troféus `perfeito_na_rodada` e `fiel`**: iteramos sobre todos os `match_days` de jogos encerrados, fazendo 2-3 queries por dia. Para a Copa com ~104 jogos em ~45 dias, isso são ~135 queries na pior hipótese. Aceitável para perfil pessoal (não é hot path), mas deve ser monitorado.
3. **`trophy_unlocked_id` no histórico**: a lógica de badge usa o `game_id` para mapear troféus. Para troféus baseados em thresholds cumulativos (artilheiro, vidente), o jogo é o exato que cruzou o threshold. Para troféus de sequência, o jogo é onde a sequência atingiu o threshold pela **primeira vez** (não a melhor sequência). Isso é consistente com a spec.
4. **Estado `rank_position: null`**: quando o usuário ainda não tem palpites, o `CampaignPanel` exibe `—` na posição. Verificar se o design aprovado trata este edge case de forma satisfatória.
5. **Migrations `20260622000001` a `20260622000004`**: precisam ser aplicadas no Supabase antes do deploy. O trigger `trg_snapshot_on_day_close` depende de `get_ranking` já existir no banco (criado em migrations anteriores).
6. **Lint pré-existente**: os 2 erros de lint (`GroupChatWidget.tsx` e `DateChipsNav.tsx`) são pré-existentes. Os novos arquivos passam no lint sem erros ou warnings.

---

## Correções Fix 1

### Problema 1 — `campaign/route.ts`: líder nunca via "+N SOBRE O 2º"
O bloco de cálculo de `nextAbovePoints` só executava quando `!isLeader`, retornando `null` para o líder. A linha 140 suprimia ainda mais com `isLeader ? null : nextAbovePoints`. Corrigido para: quando `isLeader = true`, busca o participante na posição 2 e usa seus pontos em `nextAbovePoints`. O `null` condicional da linha 140 foi removido — o campo retorna `null` somente quando não existe 2º colocado (grupo com 1 participante). O componente `CampaignPanel.tsx` não precisou de alteração.

### Problema 2 — `trophies/route.ts`: `progress > max` no troféu PROFETA
`makeTrophy('profeta', profetaAt, cravadaCount, 5)` usava `cravadaCount` bruto. Se o usuário tiver mais de 5 placares exatos, `progress` excedia `max`, exibindo `7/5 █████` visualmente inválido. Corrigido para `Math.min(cravadaCount, 5)`, espelhando o padrão já usado nos troféus de sequência (`embalado`, `em_chamas`, `imparavel`).

---

## Commits realizados

```
3b64266 fix(perfil-redesign): corrige variante líder sem 2º lugar e progress de profeta acima do max
5b379b8 fix(perfil-redesign): corrige tipos TypeScript e remove safeRpc não utilizado no handler de troféus
a8c305a feat(perfil-redesign): atualiza /perfil para usar PerfilDashboard em vez de ProfileStats
9fde67b feat(perfil-redesign): cria componentes CampaignPanel, PerformancePanel, TrophiesPanel, HistoryPanel e PerfilDashboard
7062049 feat(perfil-redesign): implementa Route Handlers — campaign, performance, trophies, history
3a4cd80 feat(perfil-redesign): cria migrations — position_snapshots, snapshot functions, avg_points, profile_history
a7b561d chore(perfil-redesign): adiciona plano de implementação
```
