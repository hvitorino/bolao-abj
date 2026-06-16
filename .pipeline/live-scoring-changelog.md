# Changelog: Pontuação em Tempo Real Durante Jogos ao Vivo

**Slug:** live-scoring
**Branch:** feature/live-scoring
**Data:** 2026-06-15
**Status:** em revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhuma alteração. O endpoint `GET /api/ranking` continua retornando apenas a soma oficial de `scores` via `get_ranking()`. A combinação com pontuação parcial de jogos `live` é feita inteiramente no frontend, conforme decisão da spec (evitar duplicar a lógica de pontuação em Ruby/Postgres para um valor que nunca é persistido).

### Frontend (Next.js/React)

- `lib/scoring.ts` — Adicionada `calculateLiveScore(game, prediction)`, que reaproveita `calculateScore()` sem reimplementar nenhuma regra. Diferença única: tolera `home_score`/`away_score` nulos (jogo ainda sem placar definido), retornando `null` nesse caso.

- `components/bolao/GameParticipantsList.tsx` — Nova prop `liveGame?: { home_score, away_score }`. Quando `gameStatus === 'live'` (`showLivePoints`), calcula pontos parciais via `calculateLiveScore` por participante, exibe header `PTS*` (em vez de `PTS`), cor `color-live` para pontos > 0, `-` para quem não tem palpite, e a legenda `* PROVISÓRIO — RECALCULADO AO VIVO` ao lado do título da seção.

- `components/games/GameCard.tsx` — Passa `liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}` ao `GameParticipantsList`, reaproveitando o placar já mantido via `useGameRealtime` (nenhuma subscription nova nesse componente).

- `lib/hooks/useLivePointsByUser.ts` (novo) — Busca jogos `status = 'live'` + predictions desses jogos, calcula pontuação parcial agregada por `user_id` via `calculateLiveScore`, e expõe `{ livePoints, loading }`. Assina o canal Realtime `live-points-games` (tabela `games`, evento `UPDATE`, sem filtro de coluna) com debounce de 1000ms, mesmo padrão de `useRankingRealtime`. Em erro de rede/consulta, loga no console e mantém o último valor calculado com sucesso (degrade gracioso).

- `components/bolao/RankingTable.tsx` — Passa a consumir `useLivePointsByUser()` junto com `useRankingRealtime()`. Nova função `applyLivePoints()` soma `total_points + livePoints[user_id]`, reordena (critério de empate: nome A-Z, igual ao backend) e renumera `rank_position` no cliente. `aproveitamento` permanece inalterado (calculado só sobre dados oficiais). O estado de loading combinado espera tanto o ranking oficial quanto o cálculo de pontos live. Quando há pelo menos um usuário com `livePoints > 0`, exibe a nota `INCLUI PONTOS PROVISÓRIOS` ao lado do badge `● AO VIVO` já existente.

- `components/bolao/RankingRow.tsx` — Sem alteração. Já recebe `entry.total_points` (agora pré-ajustado pelo `RankingTable`) sem precisar de nova prop.

### Banco de Dados

Nenhuma alteração. Nenhuma tabela nova, nenhum endpoint Ruby novo, nenhuma escrita em `scores` originada por esta feature.

---

## Decisões técnicas

1. **Cálculo 100% client-side, sem persistência:** Seguindo a spec, a pontuação parcial nunca é escrita em `scores` — é recalculada em memória a cada fetch/realtime update e descartada. Isso evita qualquer risco de o valor provisório "vazar" para a pontuação oficial ou exigir lógica de invalidação no Postgres.

2. **Reaproveitamento estrito de `calculateScore()`:** `calculateLiveScore()` não duplica nenhuma regra — apenas adapta o tipo de entrada (placar nullable) e delega. Isso garante por construção que a paridade `live → finished` (critério de aceite) se mantém: para o mesmo placar e palpite, o resultado é idêntico ao do trigger Postgres `calculate_scores_for_game`, que também espelha essas mesmas regras.

3. **Filtro de Realtime sem coluna específica em `useLivePointsByUser`:** A subscription escuta qualquer `UPDATE` em `games` (não filtra por `id` ou `status`) porque tanto uma mudança de placar de um jogo já `live` quanto uma transição `pending → live` ou `live → finished` precisam disparar recálculo. Filtrar por coluna exigiria múltiplas subscriptions ou um filtro mais complexo sem ganho real, já que o debounce de 1000ms absorve o custo de fetches extras.

4. **`rank_position` recalculado inteiramente no cliente:** Como a soma com pontos live pode alterar a ordem (e até o líder), o `RankingTable` não pode confiar no `rank_position` vindo do endpoint. O critério de desempate (nome A-Z) replica exatamente o usado pelo backend (`get_ranking()`), conforme descrito na spec.

---

## Pontos de atenção para o Revisor

1. **Paridade `live` → `finished`:** Validar manualmente com pelo menos 2 cenários do CLAUDE.md (ex: placar exato e goleada) que a pontuação parcial mostrada durante o jogo `live` é numericamente idêntica à pontuação oficial exibida após o jogo mudar para `finished` com o mesmo placar final.

2. **Degradação por falha de rede:** Forçar um erro em `useLivePointsByUser` (ex: desconectar rede momentaneamente) e confirmar que o ranking continua exibindo a pontuação oficial sem banner de erro adicional — apenas log no console.

3. **`aproveitamento` não deve mudar:** Confirmar que a coluna `APROVEIT.` no ranking continua idêntica ao valor retornado pelo endpoint oficial, mesmo quando há pontos live somados ao total.

4. **Cleanup do canal Realtime:** Confirmar que `live-points-games` é removido corretamente no unmount de qualquer página que monte `RankingTable` (ex: navegar para fora de `/ranking` repetidamente sem acumular canais abertos — verificar no painel Realtime do Supabase ou via `console.log` de debug temporário).

5. **`npm run lint` e `npm run build` executados com sucesso** após a integração final em `RankingTable.tsx` (build gera todas as rotas, incluindo `/ranking`, sem erros de tipo).

---

## Commits realizados

```
b7e1668 feat(live-scoring): soma pontuação parcial de jogos live ao ranking
e0c5912 feat(live-scoring): adiciona hook useLivePointsByUser para agregar pontuação parcial por usuário
871dca3 feat(live-scoring): exibe pontuação parcial em GameParticipantsList durante jogos ao vivo
b4b0ec5 feat(live-scoring): adiciona calculateLiveScore para pontuação parcial de jogos ao vivo
8c2a6c5 chore(live-scoring): adiciona plano de implementação
```
