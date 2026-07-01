# Changelog: Ranking por Scout

**Slug:** ranking-por-scout
**Branch:** feature/ranking-por-scout
**Data:** 2026-06-30
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- Migration `supabase/migrations/20260630100000_add_scout_counts_to_ranking_scouts.sql` — estende `get_ranking_scouts(p_group_id uuid)` com 4 novas colunas: `winner_score_count`, `diff_count`, `loser_score_count`, `goleada_count`. Usa `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` (idempotente). As novas colunas seguem o mesmo padrão das existentes: `LEFT JOIN scores` com filtro `breakdown->>'campo' > 0` + `games.status IN ('live','finished')`.

### Backend (Next.js API Route)
- `app/api/ranking/route.ts` — adiciona campos `winner_score_count`, `diff_count`, `loser_score_count`, `goleada_count` à interface `ScoutRow`. Mapeia `scoutCountsByUser` com as 6 contagens (`exact`, `winner`, `winner_score`, `diff`, `loser_score`, `goleada`). Inclui `scout_counts` no JSON de resposta (modo Geral) ou `null` (modo por rodada).

### Frontend (Next.js/React)
- `lib/types/ranking.ts` — nova interface `ScoutCounts` com 6 campos numéricos. `RankingEntry` ganha campo `scout_counts: ScoutCounts | null`.
- `components/bolao/RankingTable.tsx` — novo estado `activeScout` (`string | null`). Constante exportada `SCOUT_FILTERS` mapeia os 6 scouts para labels e keys. Função `applyScoutFilter()` reordena o ranking client-side pela contagem do scout selecionado (com desempate por total_points e nome). Chips de seleção renderizados acima da tabela: "GERAL" (padrão) + 6 scouts, com scroll horizontal, chip ativo em `color-accent`. Cabeçalho PONTOS muda para o label do scout quando ativo. Coluna PALP. oculta no modo scout. `scoutKey` passado para `RankingRow`.
- `components/bolao/RankingRow.tsx` — nova prop `scoutKey?: keyof ScoutCounts`. Quando fornecida, a célula PONTOS exibe `entry.scout_counts?.[scoutKey] ?? 0` em vez de `total_points`.

---

## Decisões técnicas

- **Reordenação client-side:** as contagens de todos os scouts já vêm na resposta do endpoint. Trocar de scout é instantâneo — sem loading, sem chamada extra à API.
- **Migration usa DROP + CREATE:** necessário porque o tipo de retorno (TABLE) muda. `CREATE OR REPLACE` não suporta alteração de assinatura de retorno em funções com TABLE.
- **Coluna PALP. oculta no modo scout:** a contagem de palpites totais é menos relevante quando o ranking está ordenado por um scout específico. O espaço é melhor aproveitado para a contagem do scout na coluna PONTOS.
- **`isLeader` no modo scout:** compara com a contagem do scout em vez de `total_points` — o líder é quem tem a maior contagem naquele scout.

---

## Pontos de atenção para revisão

1. **Chips em mobile:** a faixa de chips tem `overflowX: auto` com `scrollbarWidth: none` — verificar que o scroll horizontal funciona em iOS/Android.
2. **`scout_counts: null` no modo por rodada:** quando `round` query param está presente, `scout_counts` é `null`. Os chips de scout ainda são renderizados (usam `ranking.length > 0` para decidir se mostram a tabela), mas `scout_counts` será `null` para todos — resultando em todos com contagem 0. Idealmente os chips deveriam ser escondidos no modo por rodada, mas isso requer passar a prop `round` para `RankingTable`. Considerado fora do escopo desta feature.
3. **Desempate por total_points:** se dois participantes têm a mesma contagem de scout e os mesmos pontos totais, o desempate é alfabético.
4. **Build e lint:** `npm run lint` e `npm run build` passaram sem erros novos.

---

## Commits realizados

```
16eac4c feat(ranking-por-scout): adiciona chips de scout e reordenação client-side no RankingTable
6a25a8c feat(ranking-por-scout): adiciona ScoutCounts ao tipo e scout_counts à resposta da API
ca7ec8d feat(ranking-por-scout): estende get_ranking_scouts com 4 novas colunas de contagem
0a59f90 chore(ranking-por-scout): adiciona plano de implementação
```
