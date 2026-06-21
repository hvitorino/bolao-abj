# Plano de Implementação: Ranking por Rodada

**Slug:** ranking-por-rodada
**Branch:** feature/ranking-por-rodada
**Data:** 2026-06-21
**Spec:** .pipeline/ranking-por-rodada-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase `20260621200000_ranking_by_round.sql` com as funções `get_ranking_by_round` e `get_available_rounds`
- [ ] 2. Implementar endpoint `GET /api/ranking/rounds/route.ts` que chama a RPC `get_available_rounds`
- [ ] 3. Estender `GET /api/ranking/route.ts` para aceitar o query param `round` e chamar `get_ranking_by_round` quando fornecido
- [ ] 4. Criar hook `lib/hooks/useRoundRanking.ts` que gerencia estado de fases disponíveis, fase selecionada e fetches correspondentes
- [ ] 5. Criar componente `components/bolao/RoundChips.tsx` com os chips de filtro por fase (GERAL + fases disponíveis)
- [ ] 6. Modificar `components/bolao/RankingTable.tsx` para integrar `useRoundRanking`, exibir `RoundChips` acima da tabela e aplicar comportamento diferenciado no modo por rodada (ocultar PALP., scouts, live points)
