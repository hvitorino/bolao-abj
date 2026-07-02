# Changelog: centralizar-cache-v2-stage2

**Data:** 2026-07-02
**Branch:** feature/centralizar-cache-v2-stage2
**Status:** implementado

---

## O que foi implementado

### `lib/hooks/useRankingRealtime.ts` (modificado)

Substituição cirúrgica do bloco Realtime próprio pelo event-bus do PointsCache.

**Removido:**
- Chamada a `supabase.channel('ranking-scores-${groupId}')` com `.on('postgres_changes', ...)` e `.subscribe()`
- Chamada a `supabase.removeChannel(channel)` no cleanup

**Adicionado:**
- Import de `acquirePointsCache`, `releasePointsCache`, `subscribeToPointsInvalidations` de `@/lib/cache/points-cache`
- `acquirePointsCache(groupId)` no mount do efeito — garante o canal `points-${groupId}` ativo e incrementa refcount
- `subscribeToPointsInvalidations(groupId, 'useRankingRealtime', callback)` — registra listener de invalidação coarse; o callback mantém debounce de 1s antes de chamar `fetchRanking()`
- No cleanup: `unsub()` (remove listener) + `releasePointsCache(groupId)` (decrementa refcount)

**Preservado sem alteração:**
- Interface de retorno `{ ranking, loading, error, lastUpdatedAt }`
- `fetchRanking()` (usa `createClient` para obter sessão e fazer fetch autenticado)
- Fetch inicial via `window.setTimeout(0)` no mount
- Array de dependências `[fetchRanking, groupId]`
- JSDoc atualizado para refletir nova arquitetura

---

## Efeito na contagem de canais Realtime

| Antes | Depois |
|---|---|
| `ranking-scores-${groupId}` (canal próprio) | canal removido |
| — | `points-${groupId}` (PointsCache, compartilhado) |

O canal `points-${groupId}` é o mesmo canal do PointsCache que já existia no Stage 1.
`useRankingRealtime` passa a ser consumidor do event-bus desse canal, não mais dono
de canal próprio. Redução de 1 canal `scores` redundante.

---

## Fluxo após a mudança

```
scores (Supabase Realtime) → canal points-${groupId} (PointsCache)
  → cache.listeners (subscribeToPointsInvalidations)
    → callback useRankingRealtime (debounce 1s)
      → fetchRanking() → GET /api/ranking?group_id=
        → setRanking(data) / setLastUpdatedAt(new Date())
```

---

## Verificação

- `npm run lint`: sem erros novos (erros pré-existentes em outros arquivos preservados)
- `npm run build`: build limpo sem erros novos
- Lógica de debounce (1s) preservada
- Cleanup completo: `unsub()` + `releasePointsCache()` evitam memory leaks
