# Plano de Implementação: Placares em Tempo Real (Realtime)

**Slug:** live-scores-realtime
**Branch:** feature/live-scores-realtime
**Data:** 2026-06-14
**Spec:** .pipeline/live-scores-realtime-spec.md

## Tarefas

- [ ] 1. Criar migration SQL `db/migrations/20260614_enable_realtime_publications.sql` com REPLICA IDENTITY FULL para `games` e `scores` e adição idempotente à publicação supabase_realtime
- [ ] 2. Modificar `lib/hooks/useGameRealtime.ts` para retornar `{ game, lastUpdatedAt, connectionStatus }` com callback de status do canal Supabase
- [ ] 3. Modificar `components/games/GameCard.tsx` para desestruturar o novo retorno do hook, adicionar tick de 10s via setInterval apenas quando isLive, e exibir "atualizado há Xs/Xmin" no footer quando ao vivo
- [ ] 4. Modificar `lib/hooks/useRankingRealtime.ts` para adicionar `lastUpdatedAt: Date | null` ao retorno, atualizado após cada fetch bem-sucedido
- [ ] 5. Modificar `components/bolao/RankingTable.tsx` para desestruturar `lastUpdatedAt` e exibir timestamp `HH:MM:SS` ao lado do badge `● AO VIVO` no header
