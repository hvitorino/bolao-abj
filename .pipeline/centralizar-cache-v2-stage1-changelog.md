# Changelog: PointsCache (centralizar-cache-v2-stage1)

**Slug:** centralizar-cache-v2-stage1
**Branch:** feature/centralizar-cache-v2-stage1
**Data:** 2026-07-02
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/TypeScript)

- `lib/cache/points-cache.ts` — Singleton de cache para a tabela `scores`, com estrutura interna `Map<gameId, Map<userId, CachedPoints>>` (sem flat-key). Expõe a mesma API pública que `PredictionCache` mas com correção do bug de upsert descartado silenciosamente.

---

## Decisões técnicas

### Estrutura nested nativa vs flat-key

O `PredictionCache` usa internamente `Map<date, Map<"gameId:userId", CachedPrediction>>`, convertendo para nested apenas em `getCachedPredictions()`. Isso cria um bug: `upsertPredictionInCache` verifica `dateMap.has(key)` antes de gravar — se a data está carregada mas a chave não existe (palpite NOVO), o upsert é descartado.

O `PointsCache` usa `Map<gameId, Map<userId, CachedPoints>>` nativamente. O upsert no handler Realtime e em `ensurePoints` é sempre incondicional: cria a entrada no map externo se não existir, depois faz `set(userId, row)`. Não há reconversão em nenhum caminho de leitura.

### Early-return por `loadedDates.has(date)` em vez de `cache.points.get(date)`

O `PredictionCache` faz early-return verificando `cache.predictions.get(date)` — o que significa que uma data com zero palpites nunca tem early-return (porque não insere entrada vazia). O `PointsCache` usa um `Set<string>` dedicado (`loadedDates`) para guardar datas já consultadas, independentemente de ter scores ou não. Assim, datas sem jogos finalizados também são marcadas como carregadas.

### Filtro de status `finished` em `ensurePoints`

Scores só existem para jogos finalizados. Em vez de buscar todos os `gameIds` da data e depois buscar scores (que seria empty para jogos pending/live), `ensurePoints` já filtra `status = 'finished'` na query de jogos — evitando round-trip desnecessário ao Supabase quando não há jogos finalizados.

### `acquirePointsCache` chama `ensurePointsRealtime` incondicionalmente

Segue o mesmo padrão do `acquirePredictionCache`. Subscribers como `useRankingRealtime` (Stage 2) dependem do canal estar aberto mesmo sem ter chamado `ensurePoints` — sem isso, eventos Realtime seriam perdidos.

---

## Pontos de atenção para o Revisor

1. **Upsert incondicional no Realtime handler** — verificar que não há guard `if (cache.points.has(key))` antes do `set`, pois isso reproduziria o bug do PredictionCache.
2. **DELETE handler** — usa `payload.old` como fonte da linha; confirmar que `REPLICA IDENTITY FULL` está configurado em `scores` (pré-requisito Stage 0 citado na spec).
3. **`getCachedPoints` retorna o Map diretamente** — sem cópia ou reconversão; consumidores devem tratar como referência viva.
4. **`clearPointsCache` vs `releasePointsCache`** — `clear` apaga a entrada do mapa global; `release` apenas fecha o canal quando refCount chega a zero. São intencionalmente diferentes.
5. **Arquivo não importado** — confirmado via grep; dead code seguro até Stage 2.
6. **`npm run build` passou** — sem erros TypeScript.

---

## Commits realizados

```
1483145 feat(centralizar-cache-v2-stage1): implementa PointsCache com estrutura nested Map<gameId, Map<userId, CachedPoints>>
452f376 chore(centralizar-cache-v2-stage1): adiciona plano de implementação
```
