# Spec: useLivePointsByUser + useLiveTodayRanking leem dos caches

**Slug:** centralizar-cache-v2-stage3
**Data:** 2026-07-02
**Status:** spec

---

## Objetivo

Eliminar as queries diretas às tabelas `games`, `predictions` e `scores` nos hooks
`useLivePointsByUser` e `useLiveTodayRanking`, substituindo-as pelos caches centralizados
`ScoreCache`, `PredictionCache` e `PointsCache`. Após esta entrega, nenhum desses dois
hooks consultará Supabase diretamente — todo acesso a dados passa pelo event-bus dos
três caches singleton.

---

## Histórias de Usuário

- Como sistema, quero que `useLivePointsByUser` leia jogos ao vivo e palpites dos caches,
  para não abrir conexões redundantes às tabelas `games` e `predictions`.
- Como sistema, quero que `useLiveTodayRanking` compute o ranking diário a partir dos
  três caches, para não disparar N queries independentes a `games`, `predictions` e
  `scores` a cada atualização de placar.
- Como sistema, quero que ambos os hooks reajam a eventos dos caches sem criar canais
  Realtime próprios, para manter o total de canais abertos em no máximo 3.

---

## Modelo de Dados

Nenhuma migration ou alteração de schema. Os caches já existem e as RLS de leitura
estão configuradas (verificado nos stages anteriores).

---

## Backend

Nenhuma alteração de endpoint Ruby/Sinatra.

---

## Frontend — Hooks a Modificar

### `lib/hooks/useLivePointsByUser.ts`

**Situação atual:** faz `supabase.from('games').select(...)` para buscar jogos live,
depois `supabase.from('predictions').select(...)` para buscar palpites desses jogos.
Já usa `acquireGlobalChannel` / `releaseGlobalChannel` e `subscribeToGameUpdates` do
`ScoreCache` para reatividade.

**Objetivo:** eliminar as duas queries diretas. Ler jogos live do `ScoreCache` e
palpites do `PredictionCache`.

#### Contrato de dados necessário do ScoreCache

O `ScoreCache` armazena jogos em `gamesByDate: Map<string, Game[]>`. Não há função
pública que retorne todos os jogos live de todas as datas em uma só chamada. A solução
é **adicionar uma função `getLiveGames(): Game[]`** ao `score-cache.ts` que itera
`gamesByDate` e retorna os jogos com `status === 'live'`. Esta função deve ser adicionada
neste stage ao `score-cache.ts` (simples iteração, sem IO).

```ts
// Adicionar ao score-cache.ts:
export function getLiveGames(): Game[] {
  const result: Game[] = []
  for (const games of gamesByDate.values()) {
    for (const g of games) {
      if (g.status === 'live') result.push(g)
    }
  }
  return result
}
```

#### Contrato de dados necessário do PredictionCache

`getCachedPredictions(groupId)` retorna `Map<gameId, Map<userId, CachedPrediction>>`.
Já existe e é suficiente.

Para que `PredictionCache` tenha os palpites dos jogos live no momento do cálculo,
o hook deve chamar `ensurePredictions(groupId, date)` para cada data dos jogos live.
Mas o hook não conhece as datas antecipadamente — o cálculo acontece depois de ler os
jogos live do `ScoreCache`. O fluxo correto é:

1. Ler `getLiveGames()` do `ScoreCache` (síncrono).
2. Coletar as datas únicas dos jogos live (`game.match_day` ou derivar de `match_date`).
3. Para cada data única, chamar `await ensurePredictions(groupId, date)` — com early-return
   se já carregada.
4. Ler `getCachedPredictions(groupId)` — retorna mapa nested com todos palpites carregados.
5. Filtrar apenas os `gameId` que estão na lista de jogos live.
6. Calcular `calculateLiveScore` e somar por `userId` — lógica idêntica à atual.

> **Atenção:** `Game` tem campo `match_day: string` (formato `YYYY-MM-DD`) que deve
> ser usado para `ensurePredictions`. Verificar se o campo está presente no tipo retornado
> por `getCachedGames` — se não estiver, derivar de `match_date` com `slice(0, 10)`.

#### Lifecycle (acquire / release)

O hook deve gerenciar três caches:

```
mount:
  acquireGlobalChannel()       // ScoreCache — canal live-scores-global
  acquirePredictionCache(groupId)  // PredictionCache — canal predictions-${groupId}
  acquirePointsCache(groupId)  // PointsCache — canal points-${groupId}

unmount:
  releaseGlobalChannel()
  releasePredictionCache(groupId)
  releasePointsCache(groupId)
```

#### Reatividade

- Manter `subscribeToGameUpdates('useLivePointsByUser', callback)` para recalcular quando
  placar de jogo muda (jogo transitando para live, placar atualizado).
- Adicionar `subscribeToPointsUpdates(groupId, 'useLivePointsByUser', callback)` para
  recalcular quando uma pontuação é salva em `scores` — caso de jogo finalizando.
- Manter debounce de 1000ms nos dois callbacks.
- Não criar canal próprio — os três `acquire` acima são suficientes.

#### Função recalculada (sem IO)

Extrair a lógica de cálculo para uma função interna síncrona `computeLivePoints()`:

```ts
function computeLivePoints(groupId: string): LivePointsByUser {
  const liveGames = getLiveGames()  // ScoreCache
  if (liveGames.length === 0) return {}

  const allPredictions = getCachedPredictions(groupId)  // PredictionCache
  const totals: LivePointsByUser = {}

  for (const game of liveGames) {
    const userPreds = allPredictions.get(game.id)
    if (!userPreds) continue
    for (const [userId, pred] of userPreds) {
      const result = calculateLiveScore(game, { home_score: pred.home_score, away_score: pred.away_score })
      if (result === null) continue
      totals[userId] = (totals[userId] ?? 0) + result.points
    }
  }

  return totals
}
```

#### Inicialização assíncrona

No mount, o hook precisa garantir que os palpites dos jogos live estejam no cache antes
de computar. O fluxo de inicialização é:

```
1. acquireGlobalChannel() + acquirePredictionCache(groupId) + acquirePointsCache(groupId)
2. const liveGames = getLiveGames()
3. const dates = [...new Set(liveGames.map(g => g.match_day ?? g.match_date.slice(0, 10)))]
4. await Promise.all(dates.map(d => ensurePredictions(groupId, d)))
5. setLivePoints(computeLivePoints(groupId))
6. setLoading(false)
```

Se não houver jogos live em cache (array vazio), setLivePoints({}) imediatamente sem await.

#### Assinatura pública

Mantida igual: `useLivePointsByUser(groupId: string): { livePoints: LivePointsByUser; loading: boolean }`

#### Imports a remover

Remover `createClient` de `@/lib/supabase/client` (não haverá mais IO direto).

#### Imports a adicionar

```ts
import {
  acquireGlobalChannel,
  releaseGlobalChannel,
  subscribeToGameUpdates,
  getLiveGames,          // nova função a criar
  getCachedGames,        // já existente, pode ser útil no futuro
} from '@/lib/cache/score-cache'
import {
  acquirePredictionCache,
  releasePredictionCache,
  ensurePredictions,
  getCachedPredictions,
} from '@/lib/cache/prediction-cache'
import {
  acquirePointsCache,
  releasePointsCache,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'
```

---

### `lib/hooks/useLiveTodayRanking.ts`

**Situação atual:** faz três queries diretas:
1. `supabase.from('games').select(...).eq('match_day', today)` — jogos de hoje
2. `supabase.from('scores').select(...).in('game_id', finishedIds).eq('group_id', groupId)` — pontuações de jogos finalizados
3. `supabase.from('predictions').select(...).in('game_id', liveGameIds).eq('group_id', groupId)` — palpites de jogos ao vivo

Também já usa `acquireGlobalChannel` / `releaseGlobalChannel` e `subscribeToGameUpdates`.

**Query que PERMANECE:** `supabase.from('group_members').select('user_id, profiles(name)').eq('group_id', groupId)` — nomes não entram em cache. Esta query é feita **uma única vez no mount** (não por tick nem por evento Realtime). Manter o padrão atual: busca no início + `cancelled` guard.

**Objetivo:** eliminar as três queries diretas, substituindo por caches.

#### Fluxo de inicialização assíncrona

```
1. acquireGlobalChannel() + acquirePredictionCache(groupId) + acquirePointsCache(groupId)
2. [paralelo]
   a. const members = await fetchMembers(groupId)    // one-shot, mantido
   b. await ensureDate(today)                         // ScoreCache — carrega jogos de hoje
3. const todayGames = getCachedGames(today)           // ScoreCache — leitura síncrona
4. if (todayGames.length === 0) → setHasGamesToday(false); setLoading(false); return
5. setGames(todayGames)
6. setHasGamesToday(true)
7. const finishedIds = todayGames.filter(g => g.status === 'finished').map(g => g.id)
8. const liveGamesArr = todayGames.filter(g => g.status === 'live')
9. await ensurePoints(groupId, today)                 // PointsCache — scores de jogos finished
10. if (liveGamesArr.length > 0):
    await ensurePredictions(groupId, today)           // PredictionCache — palpites de jogos live
11. computeAndSetEntries(members, todayGames, groupId)
12. setLoading(false)
```

#### Função de cálculo síncrona `computeAndSetEntries`

Extrair o cálculo de ranking para uma função interna síncrona (sem IO) chamada sempre
que um evento de cache chegar:

```ts
function computeAndSetEntries(
  members: Array<{ userId: string; name: string }>,
  todayGames: LiveTodayGame[],
  groupId: string,
  setEntries: (e: LiveTodayEntry[]) => void,
  setGames: (g: LiveTodayGame[]) => void,
): void {
  // Atualiza games a partir do cache (placar pode ter mudado)
  const freshGames = getCachedGames(today)  // via closure
  const displayGames = freshGames.length > 0 ? freshGames : todayGames
  setGames(displayGames as LiveTodayGame[])

  const finishedIds = displayGames.filter(g => g.status === 'finished').map(g => g.id)
  const liveGamesArr = displayGames.filter(g => g.status === 'live')
  const liveGamesById = Object.fromEntries(liveGamesArr.map(g => [g.id, g]))

  // Pontuação oficial: ler do PointsCache
  const officialPoints: Record<string, number> = {}
  if (finishedIds.length > 0) {
    const pointsMap = getCachedPoints(groupId)  // PointsCache
    for (const gameId of finishedIds) {
      const gamePoints = pointsMap.get(gameId)
      if (!gamePoints) continue
      for (const [userId, cached] of gamePoints) {
        officialPoints[userId] = (officialPoints[userId] ?? 0) + cached.points
      }
    }
  }

  // Pontuação ao vivo: ler do PredictionCache
  const livePoints: Record<string, number> = {}
  const usersWithLiveGame = new Set<string>()
  if (liveGamesArr.length > 0) {
    const allPredictions = getCachedPredictions(groupId)  // PredictionCache
    for (const game of liveGamesArr) {
      const userPreds = allPredictions.get(game.id)
      if (!userPreds) continue
      for (const [userId, pred] of userPreds) {
        const gameData = liveGamesById[game.id]
        if (!gameData) continue
        usersWithLiveGame.add(userId)
        const result = calculateLiveScore(gameData, { home_score: pred.home_score, away_score: pred.away_score })
        if (result === null) continue
        livePoints[userId] = (livePoints[userId] ?? 0) + result.points
      }
    }
  }

  // Montar + ordenar + rankear — lógica idêntica à atual
  const unsorted = members.map(m => ({
    userId: m.userId, name: m.name,
    points: (officialPoints[m.userId] ?? 0) + (livePoints[m.userId] ?? 0),
    hasLiveGame: usersWithLiveGame.has(m.userId),
    rankPosition: 0,
  }))
  unsorted.sort((a, b) => b.points !== a.points ? b.points - a.points : a.name.localeCompare(b.name, 'pt-BR'))
  let prevRank = 0, prevPoints: number | null = null
  const ranked = unsorted.map((entry, i) => {
    const rankPosition = prevPoints !== null && entry.points === prevPoints ? prevRank : i + 1
    prevRank = rankPosition; prevPoints = entry.points
    return { ...entry, rankPosition }
  })
  setEntries(ranked)
}
```

#### Reatividade após inicialização

Registrar três listeners (todos com debounce de 1000ms):

```
subscribeToGameUpdates('useLiveTodayRanking', callback)   — placar atualizado
subscribeToPointsUpdates(groupId, 'useLiveTodayRanking', callback) — score calculado
subscribeToPredictionUpdates(groupId, 'useLiveTodayRanking', callback) — palpite alterado
```

Todos chamam `computeAndSetEntries(...)` via debounce — sem IO. A atualização dos
games no cache já foi feita pelo `ScoreCache` antes de disparar o `subscribeToGameUpdates`.

#### Lifecycle

```
mount:
  acquireGlobalChannel()
  acquirePredictionCache(groupId)
  acquirePointsCache(groupId)

unmount (cleanup do useEffect):
  cancelled = true
  clearTimeout(debounceGameTimer)
  clearTimeout(debouncePointsTimer)
  clearTimeout(debouncePredTimer)
  unsubGame()
  unsubPoints()
  unsubPred()
  releaseGlobalChannel()
  releasePredictionCache(groupId)
  releasePointsCache(groupId)
```

#### Referência a `members` nos callbacks

Os listeners de evento são registrados após o fetch inicial dos membros. Usar `useRef`
ou capturar `members` em closure dentro do `useEffect` para que os callbacks tenham
acesso ao valor mais recente sem re-registrar os listeners.

Estrutura sugerida: todo o bloco de fetch inicial + registro de listeners fica em um
único `useEffect([groupId, today])`, que já é o padrão atual. Os `members` são capturados
pela closure do `fetchData` e armazenados em uma `ref` (`membersRef`) para uso nos callbacks.

```ts
const membersRef = useRef<Array<{ userId: string; name: string }>>([])
// Após fetchMembers dentro do useEffect:
membersRef.current = members
// Nos callbacks dos subscribers:
computeAndSetEntries(membersRef.current, getCachedGames(today), groupId, setEntries, setGames)
```

#### Imports a remover

Remover `createClient` de `@/lib/supabase/client`.

#### Imports a adicionar

```ts
import { useRef } from 'react'
import {
  acquireGlobalChannel,
  releaseGlobalChannel,
  subscribeToGameUpdates,
  ensureDate,
  getCachedGames,
} from '@/lib/cache/score-cache'
import {
  acquirePredictionCache,
  releasePredictionCache,
  ensurePredictions,
  getCachedPredictions,
  subscribeToPredictionUpdates,
} from '@/lib/cache/prediction-cache'
import {
  acquirePointsCache,
  releasePointsCache,
  ensurePoints,
  getCachedPoints,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'
```

#### Assinatura pública

Mantida igual:
```ts
useLiveTodayRanking(groupId: string): {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]
  loading: boolean
  hasGamesToday: boolean
}
```

---

## Modificação necessária em `lib/cache/score-cache.ts`

Adicionar a função `getLiveGames()` ao final do bloco de API pública, antes de
`clearScoreCache`:

```ts
/**
 * Retorna todos os jogos com status 'live' de todas as datas carregadas no cache.
 * Leitura síncrona — sem IO.
 */
export function getLiveGames(): Game[] {
  const result: Game[] = []
  for (const games of gamesByDate.values()) {
    for (const g of games) {
      if (g.status === 'live') result.push(g)
    }
  }
  return result
}
```

---

## Regras de Negócio

### Cálculo de pontuação ao vivo (`calculateLiveScore`)

Mantido idêntico ao atual: importado de `@/lib/scoring`. O hook calcula pontuação
parcial para jogos `live` e soma pontuação oficial do `PointsCache` para jogos
`finished`. Nenhuma lógica de pontuação muda.

### Pontuação de jogos `finished`

`PointsCache` só carrega scores de jogos com `status === 'finished'` (filtro interno
de `ensurePoints`). Para `useLiveTodayRanking`, os scores oficiais de jogos finalizados
hoje vêm de `getCachedPoints(groupId)` filtrados pelos `finishedIds`.

### Jogos `pending` hoje

Jogos `pending` não têm palpites revelados (RLS) e não têm scores. Não entram no
cálculo — são apenas exibidos na lista de `games` para contexto visual. Manter
comportamento atual.

### Ausência de jogos ao vivo

Se `getLiveGames()` retornar array vazio em `useLivePointsByUser`, setar `livePoints = {}`
sem aguardar `ensurePredictions`. Sem IO desnecessário.

### Debounce de reatividade

Todos os callbacks de listeners usam debounce de 1000ms (igual ao padrão já adotado nos
stages anteriores). Múltiplos eventos rápidos (ex: 3 scores calculados em sequência) devem
resultar em apenas 1 recálculo.

---

## Proteção de Rotas

Nenhuma rota nova. Ambos os hooks são consumidos por componentes já protegidos.

---

## Integração Supabase Realtime

Nenhum canal novo é criado neste stage. Os hooks passam a ser consumidores dos canais
já gerenciados pelos caches:

| Canal | Dono | Evento recebido via |
|---|---|---|
| `live-scores-global` | ScoreCache | `subscribeToGameUpdates` |
| `predictions-${groupId}` | PredictionCache | `subscribeToPredictionUpdates` |
| `points-${groupId}` | PointsCache | `subscribeToPointsUpdates` |

Os `acquire` garantem que os canais estão abertos; os `release` decrementam refcount.
Nenhum hook chama `supabase.channel(...)` diretamente.

---

## Critérios de Aceite

- [ ] `useLivePointsByUser.ts`: nenhuma chamada a `supabase.from('games')`, `supabase.from('predictions')` ou `supabase.from('scores')` no arquivo
- [ ] `useLivePointsByUser.ts`: `createClient` não é importado
- [ ] `useLivePointsByUser.ts`: `acquireGlobalChannel` + `acquirePredictionCache` + `acquirePointsCache` chamados no mount; `release*` chamados no unmount
- [ ] `useLivePointsByUser.ts`: cálculo usa `getLiveGames()` (ScoreCache) + `getCachedPredictions()` (PredictionCache) sem IO
- [ ] `useLiveTodayRanking.ts`: nenhuma chamada a `supabase.from('games')`, `supabase.from('predictions')` ou `supabase.from('scores')` no arquivo
- [ ] `useLiveTodayRanking.ts`: `createClient` não é importado
- [ ] `useLiveTodayRanking.ts`: query `group_members.profiles(name)` mantida one-shot no mount
- [ ] `useLiveTodayRanking.ts`: três listeners registrados com debounce de 1000ms; recálculo síncrono via `computeAndSetEntries`
- [ ] `useLiveTodayRanking.ts`: `acquireGlobalChannel` + `acquirePredictionCache` + `acquirePointsCache` no mount; `release*` no unmount
- [ ] `score-cache.ts`: função `getLiveGames(): Game[]` adicionada e exportada
- [ ] `npm run build` passa sem erros TypeScript ao final
- [ ] Interface de retorno dos dois hooks mantida idêntica (sem breaking change para consumidores)
