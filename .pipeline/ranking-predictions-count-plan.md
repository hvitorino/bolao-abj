# Plano de Implementação: Total de Palpites no Ranking

**Slug:** ranking-predictions-count
**Branch:** feature/ranking-predictions-count
**Data:** 2026-06-21
**Spec:** .pipeline/ranking-predictions-count-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase `20260621000000_ranking_add_predictions_count.sql` — recriar `get_ranking(p_group_id)` via `CREATE OR REPLACE` adicionando `predictions_count bigint` via LEFT JOIN na tabela `predictions`
- [ ] 2. Atualizar `lib/types/ranking.ts` — adicionar campo `predictions_count: number` à interface `RankingEntry`
- [ ] 3. Atualizar `app/api/ranking/route.ts` — incluir `predictions_count` no mapeamento de retorno do endpoint `GET /api/ranking`
- [ ] 4. Atualizar `components/bolao/RankingTable.tsx` — adicionar coluna `PALP.` no `<thead>` (visível em mobile, antes de `APROVEIT.` que permanece `hidden md:table-cell`)
- [ ] 5. Atualizar `components/bolao/RankingRow.tsx` — adicionar célula `predictions_count` após pontos, antes de aproveitamento, com `color-muted` e sem bold
