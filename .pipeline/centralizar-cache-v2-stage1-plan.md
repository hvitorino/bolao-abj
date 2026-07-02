# Plano de Implementação: PointsCache (centralizar-cache-v2-stage1)

**Slug:** centralizar-cache-v2-stage1
**Branch:** feature/centralizar-cache-v2-stage1
**Data:** 2026-07-02
**Spec:** .pipeline/centralizar-cache-v2-stage1-spec.md

## Tarefas

- [ ] 1. Criar `lib/cache/points-cache.ts` com interface `CachedPoints`, estrutura interna `GroupCache` com `Map<gameId, Map<userId, CachedPoints>>` e singleton `cachesByGroup`
- [ ] 2. Implementar funções de leitura: `ensurePoints`, `ensurePointsForGame`, `getCachedPoints`, `getPointsFor`
- [ ] 3. Implementar funções de subscrição: `subscribeToPointsUpdates`, `subscribeToPointsInvalidations`
- [ ] 4. Implementar funções de ciclo de vida: `acquirePointsCache`, `releasePointsCache`, `clearPointsCache`
- [ ] 5. Implementar Realtime: `ensurePointsRealtime` com canal `points-${groupId}`, tabela `scores`, evento `*`, filtro por `group_id`, upsert incondicional, DELETE handler
- [ ] 6. Implementar polling: `startPointsPolling`, `stopPointsPolling`, `invalidatePointsCache` com visibilitychange fallback
- [ ] 7. Verificar `npm run build` passa sem erros e arquivo não é importado em nenhum lugar
