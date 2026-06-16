# Plano de Implementação: Pontuação em Tempo Real Durante Jogos ao Vivo

**Slug:** live-scoring
**Branch:** feature/live-scoring
**Data:** 2026-06-15
**Spec:** .pipeline/live-scoring-spec.md

## Tarefas

- [x] 1. Adicionar `calculateLiveScore()` ao final de `lib/scoring.ts`, reaproveitando `calculateScore()` sem duplicar lógica, retornando `null` quando o placar ainda não está definido.
- [x] 2. Modificar `components/bolao/GameParticipantsList.tsx`: adicionar prop `liveGame`, introduzir `showLivePoints = gameStatus === 'live'`, calcular pontos parciais via `calculateLiveScore`, header `PTS*` em `live` vs `PTS` em `finished`, cor `color-live` para pontos > 0 em `live`, e legenda `* PROVISÓRIO — RECALCULADO AO VIVO` abaixo da tabela.
- [x] 3. Modificar `components/games/GameCard.tsx` para passar a prop `liveGame={{ home_score, away_score }}` (já disponível via `useGameRealtime`) ao `GameParticipantsList`.
- [x] 4. Criar `lib/hooks/useLivePointsByUser.ts`: hook que busca jogos `status='live'` + predictions desses jogos, calcula pontuação parcial agregada por `user_id` via `calculateLiveScore`, com subscription Realtime na tabela `games` (evento `UPDATE`, sem filtro de id), debounce de 1000ms, e cleanup correto no unmount.
- [x] 5. Modificar `components/bolao/RankingTable.tsx` para consumir `useLivePointsByUser()` junto com `useRankingRealtime()`, somar `total_points + livePoints[user_id]` por entrada, reordenar e renumerar `rank_position` no cliente (critério de empate: nome A-Z), manter `aproveitamento` inalterado (calculado só sobre dados oficiais), degradar graciosamente em caso de erro no cálculo de pontos live (logar no console, não bloquear ranking oficial), e exibir nota `INCLUI PONTOS PROVISÓRIOS` no cabeçalho quando aplicável.
- [x] 6. Ajustar `components/bolao/RankingRow.tsx` se necessário para aceitar `total_points` já ajustado (sem nova prop de "isLive" por linha, conforme spec — apenas garantir que recebe o valor já somado). Não foi necessária nenhuma alteração.
- [x] 7. Revisão manual de paridade `live` → `finished` (critério de aceite) e verificação de lint/build. `npm run lint` e `npm run build` executados com sucesso.
