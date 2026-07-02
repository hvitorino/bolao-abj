# Spec: useRankingRealtime no Event-Bus do PointsCache

**Slug:** centralizar-cache-v2-stage2
**Data:** 2026-07-02
**Status:** spec

---

## Objetivo

Migrar `lib/hooks/useRankingRealtime.ts` para consumir o PointsCache em vez de
abrir canal Realtime próprio na tabela `scores`. O canal `ranking-scores-${groupId}`
é removido; em seu lugar, o hook usa `acquirePointsCache` + `subscribeToPointsInvalidations`
(com debounce de 1s) para disparar o refetch de `/api/ranking`. Esta é a primeira
migração de consumidor para o PointsCache — elimina 1 dos canais `scores` redundantes.

---

## Histórias de Usuário

- Como desenvolvedor, quero que `useRankingRealtime` não abra canal `scores` próprio,
  para que o número de canais Realtime por usuário diminua em 1.
- Como usuário, quero que o ranking continue atualizando em tempo real após jogos
  finalizados, sem nenhuma regressão visível.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma. Este stage é puramente client-side e não altera schema, migrations, RLS
ou endpoints.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. O endpoint `GET /api/ranking?group_id=` continua
sendo consumido pelo hook via `fetch` autenticado — o que muda é apenas o gatilho
para esse refetch.

---

## Frontend — Componentes React

### useRankingRealtime (modificado)

**Arquivo:** `lib/hooks/useRankingRealtime.ts`
**Tipo de alteração:** substituição do bloco Realtime por integração com PointsCache.

**Estado atual (a remover):**

O hook abre um canal Supabase próprio no `useEffect`:
```ts
const supabase = createClient()
const channel = supabase
  .channel(`ranking-scores-${groupId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `group_id=eq.${groupId}` }, () => {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => void fetchRanking(), 1000)
  })
  .subscribe()

// cleanup:
supabase.removeChannel(channel)
```

**Estado alvo (a implementar):**

Substituir pelo event-bus do PointsCache:
```ts
// mount
acquirePointsCache(groupId)
const unsub = subscribeToPointsInvalidations(groupId, 'useRankingRealtime', () => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => void fetchRanking(), 1000)
})

// cleanup
unsub()
releasePointsCache(groupId)
```

**Imports a adicionar:**
```ts
import {
  acquirePointsCache,
  releasePointsCache,
  subscribeToPointsInvalidations,
} from '@/lib/cache/points-cache'
```

**Imports a remover:** nenhum. `createClient` permanece pois `fetchRanking` ainda
o usa para obter a sessão e fazer o fetch autenticado.

**Interface de retorno:** inalterada — `{ ranking, loading, error, lastUpdatedAt }`.

**Props/parâmetros:** inalterados — `groupId: string`.

**Estados:** inalterados — loading, error, populated.

**Supabase Realtime:** o hook deixa de ser consumidor direto do Realtime. O canal
`points-${groupId}` (aberto pelo PointsCache via `acquirePointsCache`) já assina
a tabela `scores` com filtro `group_id=eq.${groupId}`; quando chega um evento, o
PointsCache chama todos os `listeners` registrados — incluindo o callback registrado
via `subscribeToPointsInvalidations` deste hook.

---

## Regras de Negócio

1. **Debounce de 1s:** o callback de invalidação deve usar debounce de 1s, idêntico
   ao comportamento atual — evita avalanche de requests quando múltiplos scores são
   calculados simultaneamente (trigger Postgres por jogo).

2. **`acquirePointsCache` no mount, `releasePointsCache` no cleanup:** o hook não
   chama `ensurePoints` (não sabe a data); o `acquirePointsCache` garante que o
   canal Realtime seja aberto e o refcount seja gerenciado corretamente. O PointsCache
   (Stage 1) já implementa `ensurePointsRealtime` dentro de `acquirePointsCache`,
   portanto o canal `points-${groupId}` fica ativo enquanto este hook estiver montado.

3. **Cleanup completo:** o `useEffect` deve limpar, na ordem:
   - `window.clearTimeout(initialFetchTimer)`
   - `window.clearTimeout(debounceTimer)`
   - `unsub()` — remove o listener de invalidação do PointsCache
   - `releasePointsCache(groupId)` — decrementa refcount; fecha canal se chegar a zero

4. **Array de dependências do `useEffect`:** `[fetchRanking, groupId]` — inalterado.
   Quando `groupId` muda, o efeito re-executa: `releasePointsCache` do grupo anterior
   + `acquirePointsCache` do novo grupo.

5. **Fetch inicial:** `fetchRanking()` via `window.setTimeout(0)` continua no mount
   (comportamento atual preservado).

6. **Sem `ensurePoints`:** este hook não carrega dados de data específica no cache —
   só precisa do mecanismo de invalidação. Consumidores que precisam de dados
   cacheados (Stages 3–8) chamarão `ensurePoints` separadamente.

---

## Proteção de Rotas

Não aplicável — hook interno, sem rotas.

---

## Integração Supabase Realtime

O hook não abre canal próprio após esta mudança. O canal utilizado é o
`points-${groupId}` gerenciado pelo PointsCache. Fluxo de evento:

```
scores (Supabase) → canal points-${groupId} (PointsCache)
  → cache.listeners (todos os inscritos via subscribeToPointsInvalidations)
    → callback de useRankingRealtime (debounce 1s)
      → fetchRanking() → GET /api/ranking?group_id=
        → setRanking(data) / setLastUpdatedAt(new Date())
```

---

## Critérios de Aceite

- [ ] `useRankingRealtime.ts` não contém mais `supabase.channel(...)` nem
      `supabase.from('scores')` — o único uso de `createClient` é dentro de `fetchRanking`
- [ ] Hook importa `acquirePointsCache`, `releasePointsCache`, `subscribeToPointsInvalidations`
      de `@/lib/cache/points-cache`
- [ ] `acquirePointsCache(groupId)` é chamado no início do efeito (após `setTimeout` inicial)
- [ ] `subscribeToPointsInvalidations(groupId, 'useRankingRealtime', cb)` registra o callback
      com debounce de 1s que chama `fetchRanking()`
- [ ] Cleanup remove `unsub()` e chama `releasePointsCache(groupId)`
- [ ] `debounceTimer` é limpo tanto no callback (antes de resetar) quanto no cleanup do efeito
- [ ] Interface de retorno `{ ranking, loading, error, lastUpdatedAt }` preservada sem alteração
- [ ] O canal `ranking-scores-${groupId}` não aparece mais no console de rede/Supabase
- [ ] Log `[PointsCache]` confirma que o canal `points-${groupId}` está ativo enquanto
      `useRankingRealtime` está montado
- [ ] `npm run build` e `npm run lint` passam sem erros novos
- [ ] Zero regressão: ranking continua atualizando em tempo real após jogo finalizado
      (via invalidação do PointsCache → debounce → refetch de /api/ranking)
