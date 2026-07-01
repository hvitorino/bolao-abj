# Plano de Implementação: Ranking por Scout

**Slug:** ranking-por-scout
**Branch:** feature/ranking-por-scout
**Data:** 2026-06-30
**Spec:** .pipeline/ranking-por-scout-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase estendendo `get_ranking_scouts` com 4 novas colunas (`winner_score_count`, `diff_count`, `loser_score_count`, `goleada_count`)
- [ ] 2. Atualizar `lib/types/ranking.ts` — adicionar interface `ScoutCounts` e campo `scout_counts` em `RankingEntry`
- [ ] 3. Atualizar `app/api/ranking/route.ts` — incluir `scout_counts` no JSON de resposta
- [ ] 4. Atualizar `components/bolao/RankingRow.tsx` — suporte à prop `scoutKey` para exibir contagem no lugar de pontos
- [ ] 5. Atualizar `components/bolao/RankingTable.tsx` — adicionar chips de scout, lógica de reordenação client-side
