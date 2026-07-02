# Spec: Criar lib/cache/points-cache.ts (PointsCache)

**Slug:** centralizar-cache-v2-stage1
**Data:** 2026-07-02
**Status:** spec

---

## Objetivo

Implementar o terceiro singleton de cache — `PointsCache` — responsável exclusivo pela tabela `scores`, expondo a mesma API pública que `PredictionCache` mas com estrutura interna `Map<gameId, Map<userId, CachedPoints>>` por grupo (sem flat-key por data). Este arquivo é dead code até ser conectado nos stages seguintes; é seguro entregar sozinho sem impacto no runtime.

---

## Histórias de Usuário

- Como desenvolvedor, quero um singleton `PointsCache` que centraliza leitura e Realtime da tabela `scores`, para que consumidores futuros não abram canais próprios.
- Como desenvolvedor, quero que o `PointsCache` evite o bug de flat-key do `PredictionCache`, para que upserts de eventos Realtime nunca sejam descartados silenciosamente.

---

## Modelo de Dados

### Tabelas consultadas (sem modificação)

Nenhuma migration é necessária. O `PointsCache` apenas lê a tabela `scores` que já existe:

```sql
scores (
  id uuid PK,
  user_id uuid FK profiles,
  game_id uuid FK games,
  group_id uuid FK groups,   -- campo não-nulo, presente desde 20260615120400_group_scoped_rls.sql
  prediction_id uuid FK predictions,
  points int NOT NULL DEFAULT 0,
  breakdown jsonb,           -- ScoreBreakdown
  calculated_at timestamptz
)
```

Pré-requisitos já presentes (Stage 0 — nenhuma ação necessária):
- `scores` com `REPLICA IDENTITY FULL` na publication `supabase_realtime`
- RLS SELECT `USING(true)` para `authenticated` e `anon` em `scores`
- `group_id` não-nulo chegando no payload Realtime

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. Este stage é exclusivamente `lib/cache/points-cache.ts` (TypeScript client-side).

---

## Frontend — Componentes React

Nenhum componente novo. Este stage entrega apenas a biblioteca `lib/cache/points-cache.ts`.

### lib/cache/points-cache.ts

**Arquivo:** `lib/cache/points-cache.ts`
**Diretiva de topo:** `'use client'`
**Imports necessários:**
- `createClient` de `@/lib/supabase/client`
- `ScoreBreakdown` de `@/lib/types/score`

---

## Regras de Negócio e Implementação

### 1. Interface exportada

```ts
export interface CachedPoints {
  user_id: string
  game_id: string
  group_id: string
  points: number
  breakdown: ScoreBreakdown
}
```

### 2. Estrutura interna do singleton

O estado por grupo usa `Map<gameId, Map<userId, CachedPoints>>` — **não** flat-key por data. Diferença crítica em relação ao `PredictionCache`:

- `PredictionCache` usa `Map<date, Map<"gameId:userId", CachedPrediction>>` internamente, convertendo para nested apenas em `getCachedPredictions()`. Isso cria o bug: `upsertPredictionInCache` verifica `dateMap.has(key)` antes de gravar; se a data já está carregada mas a chave não existe (palpite NOVO), o upsert é descartado do cache persistente.
- `PointsCache` usa `Map<gameId, Map<userId, CachedPoints>>` nativamente, com upsert incondicional. Não há reconversão flat→nested em nenhum caminho de leitura.

Estrutura `GroupCache` interna:

```ts
interface GroupCache {
  points: Map<string, Map<string, CachedPoints>>   // gameId → userId → CachedPoints
  channel: ReturnType<ReturnType<typeof createClient>['channel']> | null
  pollingInterval: ReturnType<typeof setInterval> | null
  connectionStatus: 'connecting' | 'connected' | 'error'
  listeners: Map<string, () => void>               // invalidation listeners
  detailListeners: Map<string, (points: CachedPoints, eventType: string) => void>
  loadedDates: Set<string>                         // datas já carregadas (evita refetch)
  refCount: number
}

const cachesByGroup = new Map<string, GroupCache>()
let listenerCounter = 0
const POLL_INTERVAL_MS = 60_000
```

Função `getOrCreateGroupCache(groupId)` idêntica ao padrão do `PredictionCache`.

### 3. API pública — funções exportadas

#### `ensurePoints(groupId: string, date: string): Promise<Map<string, Map<string, CachedPoints>>>`

Early-return se `loadedDates.has(date)`.

Lógica:
1. Buscar `games` onde `match_day = date` — para obter os `gameIds` com status `finished`. Scores só existem para jogos finalizados, portanto filtrar `status = 'finished'` na query de jogos.
2. Se nenhum `gameId` (nenhum jogo finalizado na data), marcar `loadedDates.add(date)` e retornar o `cache.points` atual.
3. Buscar `scores` com `group_id=eq.${groupId}` + `game_id=in.(${gameIds.join(',')})`. Selecionar: `user_id, game_id, group_id, points, breakdown`.
4. Para cada linha retornada, fazer upsert incondicional no map nested:
   ```ts
   if (!cache.points.has(row.game_id)) {
     cache.points.set(row.game_id, new Map())
   }
   cache.points.get(row.game_id)!.set(row.user_id, row)
   ```
5. `loadedDates.add(date)`
6. Chamar `ensurePointsRealtime(groupId)` e `startPointsPolling(groupId)`.
7. Retornar `cache.points`.

#### `ensurePointsForGame(groupId: string, gameId: string): Promise<void>`

Caminho de carga para um único jogo (usado por páginas públicas no Stage 6). Buscar `scores` com `group_id=eq.${groupId}` + `game_id=eq.${gameId}`. Fazer upsert incondicional no map nested. Chamar `ensurePointsRealtime(groupId)`.

#### `getCachedPoints(groupId: string): Map<string, Map<string, CachedPoints>>`

Retorna `cachesByGroup.get(groupId)?.points ?? new Map()`.

Leitura síncrona; não executa fetch. Retornar o próprio `Map<gameId, Map<userId, CachedPoints>>` — não precisa de reconversão.

#### `getPointsFor(groupId: string, gameId: string, userId: string): CachedPoints | null`

```ts
return cachesByGroup.get(groupId)?.points.get(gameId)?.get(userId) ?? null
```

#### `subscribeToPointsUpdates(groupId: string, source: string, listener: (points: CachedPoints, eventType: string) => void): () => void`

Registra listener em `cache.detailListeners` com id `${source}#${++listenerCounter}`. Retorna função de unsub que remove o id.

#### `subscribeToPointsInvalidations(groupId: string, source: string, listener: () => void): () => void`

Registra listener em `cache.listeners` com id `${source}#${++listenerCounter}`. Retorna função de unsub que remove o id.

#### `acquirePointsCache(groupId: string): void`

```ts
const cache = getOrCreateGroupCache(groupId)
cache.refCount++
// OBRIGATÓRIO: garante canal Realtime mesmo sem ensurePoints ter sido chamado.
// Subscribers que não carregam data específica (ex: useRankingRealtime no Stage 2)
// dependem disso para receber eventos — mesmo motivo do comentário em acquirePredictionCache.
ensurePointsRealtime(groupId)
```

#### `releasePointsCache(groupId: string): void`

```ts
const cache = cachesByGroup.get(groupId)
if (!cache) return
cache.refCount--
if (cache.refCount <= 0) {
  cache.refCount = 0
  stopPointsPolling(groupId)
  if (cache.channel) {
    const supabase = createClient()
    supabase.removeChannel(cache.channel)
    cache.channel = null
  }
  cache.listeners.clear()
  cache.detailListeners.clear()
}
```

#### `clearPointsCache(groupId: string): void`

Teardown completo: para polling, remove canal, deleta entrada de `cachesByGroup`. Usado na troca de grupo.

### 4. Realtime — `ensurePointsRealtime(groupId: string): void` (interna)

- Canal: `points-${groupId}`
- Tabela: `scores`
- Evento: `'*'` (INSERT, UPDATE, DELETE)
- Filtro: `group_id=eq.${groupId}`
- Early-return se `cache.channel` já existe.

Ao receber evento:
```
eventType = payload.eventType ?? 'UPDATE'
row = payload.new ?? payload.old  (como CachedPoints | null)
```

Se `eventType === 'DELETE'`:
- `payload.old` contém a linha. Remover `cache.points.get(gameId)?.delete(userId)`.
- Notificar `detailListeners` com `eventType = 'DELETE'`.
- Notificar `listeners` (invalidação coarse).

Se `eventType !== 'DELETE'` e `row` é válido (`row.game_id && row.user_id`):
- Upsert incondicional:
  ```ts
  if (!cache.points.has(row.game_id)) {
    cache.points.set(row.game_id, new Map())
  }
  cache.points.get(row.game_id)!.set(row.user_id, row)
  ```
- Notificar `detailListeners` com `(row, eventType)`.
- Notificar `listeners`.

Log de conexão ao `.subscribe()`:
```ts
.subscribe((status) => {
  const newStatus = status === 'SUBSCRIBED' ? 'connected'
    : (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') ? 'error'
    : 'connecting'
  cache.connectionStatus = newStatus
  const icon = status === 'SUBSCRIBED' ? '✓' : (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') ? '✗' : '…'
  const color = status === 'SUBSCRIBED' ? 'color:#00d26a' : 'color:#ff453a'
  console.log(`%c[PointsCache] %c${icon} ${status} %c| canal points-${groupId.slice(0,8)} %c| ${ts}`,
    'color:#FFDF00;font-weight:bold', color, 'color:#f0f4f8', 'color:#5a7a6a')
})
```

### 5. Polling — `startPointsPolling` / `stopPointsPolling` / `invalidatePointsCache` (internas)

Idêntico ao padrão de `PredictionCache`:
- `startPointsPolling`: early-return se `cache.pollingInterval` já existe. Cria `setInterval(() => invalidatePointsCache(groupId), POLL_INTERVAL_MS)`. Adiciona listener `visibilitychange` que chama `invalidatePointsCache` e reseta o intervalo ao voltar do sleep. Guarda handler em `cache._visibilityHandler` para cleanup.
- `stopPointsPolling`: `clearInterval` + `removeEventListener`.
- `invalidatePointsCache`: `cache.points.clear()` + `cache.loadedDates.clear()` + notificar todos os `listeners`. Log com prefixo `[PointsCache]`.

### 6. Logs obrigatórios com prefixo [PointsCache]

Usar o mesmo esquema de cores do `PredictionCache` e `ScoreCache`:
- Prefixo: `%c[PointsCache]` com `color:#FFDF00;font-weight:bold`
- Ao conectar canal: `%c● CONECTANDO %c| canal points-${groupId.slice(0,8)}`
- Ao receber evento Realtime: `%c◄ RECEBIDO %c${eventType} %c| game ${gameId.slice(0,8)} %c| user ${userId.slice(0,8)} %c| ${points} pts`
- Ao invalidar (polling/visibilitychange): `%c► INVALIDANDO %c| ${listenerNames.join(', ')}`

---

## Proteção de Rotas

Não aplicável — este stage entrega apenas um módulo TypeScript, sem rotas ou componentes.

---

## Integração Supabase Realtime

| Atributo | Valor |
|---|---|
| Tabela | `scores` |
| Canal | `points-${groupId}` |
| Evento | `*` (INSERT, UPDATE, DELETE) |
| Filtro | `group_id=eq.${groupId}` |
| Dispara | `detailListeners` (granular) + `listeners` (coarse) |

O canal é criado por `ensurePointsRealtime`, chamado tanto por `ensurePoints`/`ensurePointsForGame` quanto por `acquirePointsCache`. O guard `if (cache.channel) return` garante idempotência.

---

## Critérios de Aceite

- [ ] Arquivo `lib/cache/points-cache.ts` criado com diretiva `'use client'`
- [ ] Interface `CachedPoints` exportada com campos `user_id`, `game_id`, `group_id`, `points`, `breakdown: ScoreBreakdown`
- [ ] `ScoreBreakdown` importado de `@/lib/types/score` (não reimplementado)
- [ ] Estrutura interna: `Map<groupId, GroupCache>` onde `GroupCache.points` é `Map<gameId, Map<userId, CachedPoints>>` — sem flat-key
- [ ] `ensurePoints(groupId, date)` com early-return por `loadedDates`, query de jogos + scores, upsert incondicional no map nested
- [ ] `ensurePointsForGame(groupId, gameId)` implementado (carga de jogo único)
- [ ] `getCachedPoints(groupId)` retorna o map nested diretamente, sem reconversão
- [ ] `getPointsFor(groupId, gameId, userId)` retorna `CachedPoints | null`
- [ ] `subscribeToPointsUpdates(groupId, source, cb)` com unsub via retorno
- [ ] `subscribeToPointsInvalidations(groupId, source, cb)` com unsub via retorno
- [ ] `acquirePointsCache(groupId)` incrementa `refCount` E chama `ensurePointsRealtime(groupId)` incondicionalmente
- [ ] `releasePointsCache(groupId)` decrementa `refCount`, clamp em 0, fecha canal e para polling quando chega a zero
- [ ] `clearPointsCache(groupId)` faz teardown completo e deleta do `cachesByGroup`
- [ ] `ensurePointsRealtime`: canal `points-${groupId}`, tabela `scores`, evento `*`, filtro `group_id=eq.${groupId}`
- [ ] Upsert no handler Realtime é incondicional — cria entrada no map se não existir
- [ ] DELETE no handler Realtime remove do map nested
- [ ] Logs com prefixo `[PointsCache]` em amarelo bold nos pontos-chave (CONECTANDO, RECEBIDO, INVALIDANDO)
- [ ] `startPointsPolling` com intervalo 60s + `visibilitychange` como fallback
- [ ] Arquivo não é importado em nenhum outro arquivo (dead code seguro até o Stage 2)
- [ ] `npm run build` passa sem erros após a criação do arquivo
