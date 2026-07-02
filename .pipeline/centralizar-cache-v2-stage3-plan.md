# Plano de Implementação: useLivePointsByUser + useLiveTodayRanking leem dos caches

**Slug:** centralizar-cache-v2-stage3
**Branch:** feature/centralizar-cache-v2-stage3
**Data:** 2026-07-02
**Spec:** .pipeline/centralizar-cache-v2-stage3-spec.md

## Tarefas

- [ ] 1. Adicionar `getLiveGames(): Game[]` ao `lib/cache/score-cache.ts` — iteração síncrona sobre `gamesByDate`, retornando jogos com `status === 'live'`
- [ ] 2. Reescrever `lib/hooks/useLivePointsByUser.ts` — eliminar queries diretas a `games` e `predictions`; usar `getLiveGames()` + `getCachedPredictions()`; lifecycle acquire/release dos três caches; dois listeners com debounce 1000ms
- [ ] 3. Reescrever `lib/hooks/useLiveTodayRanking.ts` — eliminar queries diretas a `games`, `scores` e `predictions`; manter one-shot de `group_members`; usar `ensureDate` + `ensurePoints` + `ensurePredictions`; `computeAndSetEntries` síncrona; três listeners com debounce 1000ms; `membersRef` para closure estável
- [ ] 4. Verificar `npm run build` sem erros TypeScript
