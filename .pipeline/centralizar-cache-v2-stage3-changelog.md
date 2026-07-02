# Changelog: centralizar-cache-v2-stage3

**Slug:** centralizar-cache-v2-stage3
**Branch:** feature/centralizar-cache-v2-stage3
**Data:** 2026-07-02
**Status:** aguardando revisão

---

## O que foi implementado

### Cache (lib/cache/)

- `lib/cache/score-cache.ts` — adicionada função pública `getLiveGames(): Game[]`, inserida antes de `clearScoreCache`. Itera `gamesByDate.values()` e retorna todos os jogos com `status === 'live'`. Leitura síncrona, sem IO.

### Frontend (lib/hooks/)

- `lib/hooks/useLivePointsByUser.ts` — reescrito completamente. Elimina queries diretas a `games` e `predictions`; importa `getLiveGames` + `getCachedPredictions`; gerencia lifecycle de três caches (`acquireGlobalChannel` / `acquirePredictionCache` / `acquirePointsCache`); função interna síncrona `computeLivePoints()`; dois listeners com debounce 1000ms (`subscribeToGameUpdates` + `subscribeToPointsUpdates`); inicialização assíncrona chama `ensurePredictions` por data dos jogos live antes do primeiro render.

- `lib/hooks/useLiveTodayRanking.ts` — reescrito completamente. Elimina queries diretas a `games`, `scores` e `predictions`; mantém one-shot de `group_members` via `createClient` (único IO direto restante, conforme spec); usa `ensureDate` (ScoreCache) + `ensurePoints` (PointsCache) + `ensurePredictions` (PredictionCache) no init; função interna síncrona `computeAndSetEntries()`; três listeners com debounce 1000ms (`subscribeToGameUpdates` + `subscribeToPointsUpdates` + `subscribeToPredictionUpdates`); `membersRef` para closure estável nos callbacks sem re-registrar listeners.

---

## Decisões técnicas

- **`Game` não tem `match_day`:** O tipo `Game` em `lib/types/game.ts` expõe apenas `match_date` (ISO 8601). A data é derivada com `.slice(0, 10)` para chamar `ensurePredictions(groupId, date)`. Conforme indicado na spec como fallback.

- **`subscribeToPredictionUpdates` recebe callback `(pred, eventType)`:** A spec descreve o listener como `() => void`, mas `subscribeToPredictionUpdates` tem assinatura `(pred: CachedPrediction, eventType: string) => void`. O callback em `useLiveTodayRanking` ignora os argumentos e chama `computeAndSetEntries` via debounce — TypeScript aceita callback com mais parâmetros do que o tipo exige.

- **Fetch paralelo no init de `useLiveTodayRanking`:** `Promise.all([fetchMembers, ensureDate])` — evita waterfall entre membros e jogos. O `ensurePoints` e `ensurePredictions` rodam depois (dependem dos dados dos jogos para filtrar live/finished).

- **`cancelled` guard em `useLivePointsByUser`:** A inicialização assíncrona pode completar após o unmount; o guard `cancelled` previne `setState` em componente desmontado.

---

## Pontos de atenção para o Revisor

1. **Critério de aceite "createClient não é importado" em `useLiveTodayRanking`:** O hook ainda importa `createClient` para a query one-shot de `group_members` — conforme a spec ("Query que PERMANECE"). O critério de aceite da spec diz "createClient não é importado", mas a própria spec mantém essa query. Verificar se o critério deve ser lido como "não usado para games/predictions/scores" (e não para members).

2. **Assinatura de `subscribeToPointsUpdates`:** A spec diz "adicionar `subscribeToPointsUpdates(groupId, 'useLivePointsByUser', callback)`" com callback `() => void`, mas a função real aceita `(points: CachedPoints, eventType: string) => void`. O callback ignora os argumentos — comportamento correto, mas vale verificar compatibilidade de tipos TypeScript.

3. **`useLiveTodayRanking` sem `useCallback` no `fetchData`:** A função `fetchData` é definida dentro do `useEffect` sem `useCallback`, o que é correto (não há dependência circular), mas diferente do padrão do `useLivePointsByUser`. Ambos são válidos.

---

## Commits realizados

```
b5264b6 chore(centralizar-cache-v2-stage3): adiciona plano de implementação
a9f89cf feat(centralizar-cache-v2-stage3): adiciona getLiveGames() ao score-cache
707ecdd feat(centralizar-cache-v2-stage3): reescreve useLivePointsByUser para ler dos caches
ca5a44c feat(centralizar-cache-v2-stage3): reescreve useLiveTodayRanking para ler dos caches
```
