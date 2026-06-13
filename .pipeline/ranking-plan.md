# Plano de Implementação: Ranking em Tempo Real

**Slug:** ranking
**Branch:** feature/ranking
**Data:** 2026-06-13
**Spec:** .pipeline/ranking-spec.md

## Tarefas

- [ ] 1. Criar migration SQL: view `ranking_view` + função RPC `get_ranking()` em `db/migrations/20260613_create_ranking_view.sql`
- [ ] 2. Criar tipo TypeScript `RankingEntry` em `lib/types/ranking.ts`
- [ ] 3. Criar endpoint Ruby GET `/api/ranking` em `api/ranking.rb`
- [ ] 4. Criar hook `useRankingRealtime` em `lib/hooks/useRankingRealtime.ts`
- [ ] 5. Criar componente `RankingRow.tsx` em `components/bolao/RankingRow.tsx`
- [ ] 6. Criar componente `RankingTable.tsx` em `components/bolao/RankingTable.tsx`
- [ ] 7. Criar página `/ranking` em `app/(dashboard)/ranking/page.tsx`
- [ ] 8. Criar componente `NavLinks.tsx` e atualizar `app/(dashboard)/layout.tsx` com links de navegação
