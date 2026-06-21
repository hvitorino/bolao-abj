# Changelog: Total de Palpites no Ranking

**Slug:** ranking-predictions-count
**Branch:** feature/ranking-predictions-count
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- Migration `supabase/migrations/20260621000000_ranking_add_predictions_count.sql` — recria `get_ranking(p_group_id uuid)` via `CREATE OR REPLACE FUNCTION` adicionando a coluna `predictions_count bigint`. O valor é derivado de um LEFT JOIN com subquery em `predictions WHERE group_id = p_group_id GROUP BY user_id`. Membros sem palpites retornam `0` via `COALESCE`. Critério de empate `ORDER BY total_points DESC, p.name ASC` preservado. Todos os tipos de retorno foram padronizados para `bigint` (rank_position, total_points, games_predicted, predictions_count).

### Backend (Next.js API Route)
- `app/api/ranking/route.ts` — adicionado `predictions_count` ao type annotation do `entry` e ao objeto mapeado no retorno JSON. O valor passa por `Number()` para garantir serialização correta de bigint.

### Frontend (Next.js/React)
- `lib/types/ranking.ts` — adicionado campo `predictions_count: number` à interface `RankingEntry`
- `components/bolao/RankingTable.tsx` — nova coluna `PALP.` no `<thead>`, inserida entre `PONTOS` e `APROVEIT.`. Visível em todas as telas (sem `hidden md:table-cell`), com `minWidth: '4.5rem'` para comportar valores como `48` em mobile 375px. A coluna `APROVEIT.` mantém `hidden md:table-cell` sem regressão.
- `components/bolao/RankingRow.tsx` — nova célula `predictions_count` inserida entre pontos e aproveitamento. Usa `color-muted` (informação secundária), `fontSize: '13px'`, sem `fontWeight: 'bold'` e sem formatação condicional de cor — diferenciando-se da célula de pontos (bold) e de aproveitamento (verde/muted conforme threshold).

---

## Decisões técnicas

- **Tipos de retorno como `bigint`:** A migration anterior (`20260615120600`) usava `int` no retorno da função. A nova versão usa `bigint` para alinhar com as semânticas do Postgres (`RANK()` retorna `bigint`, `COUNT(DISTINCT ...)` retorna `bigint`). O `Number()` no mapeamento do route.ts absorve qualquer diferença de serialização.

- **`RANK()` com critério de empate no WINDOW:** A expressão do `RANK()` na nova função inclui `p.name ASC` como critério de desempate direto (`RANK() OVER (ORDER BY ... DESC, p.name ASC)`), alinhado com o `ORDER BY` final. Isso é mais correto que a versão anterior que tinha o desempate apenas no `ORDER BY` mas não no `OVER`.

- **Coluna `PALP.` sempre visível em mobile:** A spec exige que `PALP.` seja o dado novo e principal desta feature, portanto não recebe `hidden md:table-cell`. Em mobile, o layout fica `# | PARTICIPANTE | PONTOS | PALP.`, deixando `APROVEIT.` oculta. Em desktop, todas as quatro colunas ficam visíveis.

- **`predictions_count` não dispara atualização Realtime própria:** O hook `useRankingRealtime` já faz refetch completo em eventos de `scores`, o que traz `predictions_count` atualizado junto. Para jogos pendentes/ao vivo, o valor atualiza ao próximo evento de `scores` ou ao recarregar — comportamento aceitável conforme spec.

---

## Pontos de atenção para o Revisor

1. **Migration vs. banco de produção:** A migration usa `CREATE OR REPLACE`, portanto é idempotente. O Revisor deve confirmar que a nova assinatura de retorno (`bigint` em vez de `int` para `total_points`, `games_predicted` e `rank_position`) não quebra nenhum outro consumidor da função `get_ranking()` além do `app/api/ranking/route.ts`.

2. **Ordenação:** Verificar que o `RANK() OVER (ORDER BY ... DESC, p.name ASC)` na migration corresponde ao `applyLivePoints()` em `RankingTable.tsx`, que também ordena por `total_points DESC` e `localeCompare` em caso de empate.

3. **Visibilidade mobile:** Confirmar que a ausência de `hidden md:table-cell` na coluna `PALP.` não causa scroll horizontal em 375px. O `minWidth: '4.5rem'` foi escolhido para ser menor que o `minWidth: '5rem'` de pontos/aproveitamento.

4. **Zero é exibido:** Participantes sem palpites retornam `predictions_count = 0` via `COALESCE(pred_counts.cnt, 0)` no SQL e `Number(entry.predictions_count)` no route.ts — nunca `null` ou `undefined`.

---

## Commits realizados

```
cbb4294 feat(ranking-predictions-count): adiciona célula predictions_count em RankingRow
2dbf0f8 feat(ranking-predictions-count): adiciona coluna PALP. no thead de RankingTable
479fa35 feat(ranking-predictions-count): inclui predictions_count no retorno de GET /api/ranking
26eb342 feat(ranking-predictions-count): adiciona predictions_count à interface RankingEntry
5a2fc76 feat(ranking-predictions-count): adiciona migration para predictions_count em get_ranking()
a733631 chore(ranking-predictions-count): adiciona plano de implementação
```
