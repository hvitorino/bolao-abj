# Spec: usePalpitesAoVivo lê dos caches

**Slug:** centralizar-cache-v2-stage4
**Data:** 2026-07-02
**Status:** spec

---

## Objetivo

Eliminar as queries diretas às tabelas `games`, `predictions` e `scores` em
`lib/hooks/usePalpitesAoVivo.ts`, substituindo-as pelos três caches centralizados
`ScoreCache`, `PredictionCache` e `PointsCache`. A chamada a `/api/ranking` deve ser
feita apenas uma vez no mount (e no `visibilitychange`), nunca disparada por tick de
evento Realtime ou atualização de placar ao vivo. O hook deve gerenciar o lifecycle
completo dos três caches (acquire/release) e reagir a mudanças via subscriptions, não
via polling próprio.

---

## Histórias de Usuário

- Como sistema, quero que `usePalpitesAoVivo` leia jogos, palpites e pontuações dos
  caches centralizados, para não abrir queries redundantes a `games`, `predictions` e
  `scores` a cada atualização de placar.
- Como sistema, quero que `/api/ranking` seja chamado apenas uma vez no mount e na
  volta do plano de fundo, para não gerar carga de servidor desnecessária por tick de
  jogo ao vivo.
- Como sistema, quero que o recálculo do estado do hook (todayGames, rankingWithDetails)
  seja uma operação síncrona sem IO, para que eventos Realtime sejam refletidos
  imediatamente sem latência de rede.

---

## Modelo de Dados

Nenhuma migration ou alteração de schema. Os três caches já existem e as RLS estão
configuradas (verificado nos stages anteriores).

---

## Backend

Nenhuma alteração de endpoint Ruby/Sinatra.

---

## Frontend — Hook a Modificar

### `lib/hooks/usePalpitesAoVivo.ts`

---

### Situação atual (o que o hook faz hoje)

A função `fetchAll()` é invocada em toda trigger (mount, evento Realtime, visibilitychange)
e executa sequencialmente quatro operações de IO em cada chamada:

1. `supabase.from('games').select(...).eq('match_day', selectedDate)` — busca todos os
   jogos da data selecionada.
2. `supabase.from('predictions').select(...).eq('group_id', groupId).in('game_id', gameIds)` —
   busca todos os palpites do grupo para os jogos do dia.
3. `supabase.from('scores').select(...).eq('group_id', groupId).in('game_id', finishedGameIds)` —
   busca pontuações oficiais de jogos finalizados.
4. `fetch('/api/ranking?group_id=${groupId}')` — busca lista de participantes com nomes.

Os listeners de reatividade já existem (`subscribeToGameUpdates`, `subscribeToPredictionInvalidations`),
mas ao receber qualquer evento chamam `fetchAll()` inteiro — incluindo as quatro queries acima.

O `PointsCache` não é utilizado: nenhum `acquirePointsCache` / `releasePointsCache` é
chamado, e `scores` é consultado diretamente.

O guard `prevScoresKey` (fingerprint de placar dos jogos) já existe e deve ser preservado.

---

### Objetivo (o que deve fazer depois)

Separar as responsabilidades em dois fluxos distintos:

**Fluxo A — inicialização assíncrona** (`initialize`): executa somente no mount e no
`visibilitychange`. Chama `ensure*` nos três caches para a data selecionada e chama
`fetchParticipants()` para obter nomes dos participantes. Ao final, chama
`computeAndSetState(true)` para forçar re-render.

**Fluxo B — recálculo síncrono** (`computeAndSetState`): executa em resposta a eventos
dos caches (Realtime, polling do cache). Lê os três caches via `getCached*` (sem IO)
e recomputa `todayGames` + `rankingWithDetails` a partir dos dados em memória. Não faz
nenhuma chamada a Supabase nem a `/api/ranking`.

---

### Refs de estado interno

Além das `useState` existentes, adicionar:

```ts
// Nomes dos participantes — populado por fetchParticipants(), consumido por computeAndSetState()
const rankingEntriesRef = useRef<RankingEntry[]>([])
```

Manter os refs já existentes:
```ts
const isFirstFetch = useRef(true)
const prevScoresKey = useRef<string>('')
const hasData = useRef(false)
```

---

### `fetchParticipants()` — async, IO, chamado apenas no mount + visibilitychange

```ts
const fetchParticipants = async (): Promise<void> => {
  const supabase = createClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return
  const res = await fetch(`/api/ranking?group_id=${groupId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.ok) {
    rankingEntriesRef.current = (await res.json()) as RankingEntry[]
  }
}
```

---

### `initialize()` — async, executa no mount e no visibilitychange

```ts
const initialize = async (): Promise<void> => {
  try {
    await Promise.all([
      ensureDate(selectedDate),                   // ScoreCache
      ensurePredictions(groupId, selectedDate),    // PredictionCache
      ensurePoints(groupId, selectedDate),         // PointsCache
    ])
    await fetchParticipants()
    computeAndSetState(true)
    hasData.current = true
    setError(null)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[usePalpitesAoVivo] erro:', message)
    if (!hasData.current) setError(message)
  } finally {
    if (isFirstFetch.current) {
      isFirstFetch.current = false
      setLoading(false)
    }
  }
}
```

---

### `computeAndSetState(forceUpdate = false)` — síncrona, sem IO

Lê dos três caches e recomputa o estado do hook. É chamada pelos listeners dos caches
via debounce. Não faz nenhuma query a Supabase nem fetch a `/api/ranking`.

```ts
function computeAndSetState(forceUpdate = false): void {
  const games = getCachedGames(selectedDate)                           // ScoreCache
  const allPredictions = getCachedPredictions(groupId)                 // PredictionCache — Map<gameId, Map<userId, CachedPrediction>>
  const allPoints = getCachedPoints(groupId)                           // PointsCache — Map<gameId, Map<userId, CachedPoints>>
  const rankingEntries = rankingEntriesRef.current

  const liveGameIds = games.filter(g => g.status === 'live').map(g => g.id)
  const finishedGameIds = games.filter(g => g.status === 'finished').map(g => g.id)

  // --- todayGames: jogos do dia com palpite do usuário atual ---
  const newTodayGames: LiveGameWithPrediction[] = games.map(g => {
    const myPred = allPredictions.get(g.id)?.get(currentUserId) ?? null
    return {
      id: g.id,
      home_team: g.home_team,
      away_team: g.away_team,
      home_team_code: g.home_team_code,
      away_team_code: g.away_team_code,
      home_score: g.home_score,
      away_score: g.away_score,
      status: g.status,
      match_date: g.match_date,
      round: g.round,
      phase: g.phase,
      myPrediction: myPred
        ? { home_score: myPred.home_score, away_score: myPred.away_score }
        : null,
    }
  })

  // --- Pontos do dia por usuário ---

  // Jogos finalizados: pontuação oficial do PointsCache
  const todayPointsByUser: Record<string, number> = {}
  for (const gameId of finishedGameIds) {
    const gamePoints = allPoints.get(gameId)
    if (!gamePoints) continue
    for (const [userId, cached] of gamePoints) {
      todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + cached.points
    }
  }

  // Jogos ao vivo: pontuação parcial calculada client-side
  const hasLiveByUser: Record<string, boolean> = {}
  for (const gameId of liveGameIds) {
    const game = games.find(g => g.id === gameId)
    if (!game) continue
    const userPreds = allPredictions.get(gameId)
    if (!userPreds) continue
    for (const [userId, pred] of userPreds) {
      const result = calculateLiveScore(
        { home_score: game.home_score, away_score: game.away_score },
        { home_score: pred.home_score, away_score: pred.away_score }
      )
      if (result && result.points > 0) {
        todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + result.points
        hasLiveByUser[userId] = true
      }
    }
  }

  // --- Ranking com detalhes por participante ---
  const adjustedRanking = sortRanking(
    rankingEntries.map(entry => ({
      entry,
      total_points: todayPointsByUser[entry.user_id] ?? 0,
      hasLivePoints: hasLiveByUser[entry.user_id] ?? false,
    }))
  )

  const newRankingWithDetails: RankingParticipantDetail[] = adjustedRanking.map(
    ({ entry, total_points, hasLivePoints, rank_position }) => {
      const userGames: GameScoreEntry[] = games.map(g => {
        const pred = allPredictions.get(g.id)?.get(entry.user_id) ?? null
        const score = allPoints.get(g.id)?.get(entry.user_id) ?? null

        let livePoints: number | null = null
        let liveBreakdown: ScoreBreakdown | null = null
        if (g.status === 'live' && pred) {
          const result = calculateLiveScore(
            { home_score: g.home_score, away_score: g.away_score },
            { home_score: pred.home_score, away_score: pred.away_score }
          )
          livePoints = result?.points ?? null
          liveBreakdown = result?.breakdown ?? null
        }

        return {
          gameId: g.id,
          home_team: g.home_team,
          away_team: g.away_team,
          home_team_code: g.home_team_code,
          away_team_code: g.away_team_code,
          home_score: g.home_score,
          away_score: g.away_score,
          status: g.status,
          match_date: g.match_date,
          userPrediction: pred
            ? { home_score: pred.home_score, away_score: pred.away_score }
            : null,
          officialPoints: score?.points ?? null,
          officialBreakdown: score?.breakdown ?? null,
          livePoints,
          liveBreakdown,
        }
      })

      return {
        userId: entry.user_id,
        name: entry.participant_name,
        rank_position,
        total_points,
        hasLivePoints,
        games: userGames,
      }
    }
  )

  // --- Guard FLIP: só atualiza estado se placar/status mudou, ou se forçado ---
  const scoresKey = games
    .map(g => `${g.id}:${g.status}:${g.home_score}:${g.away_score}`)
    .join('|')
  const scoresChanged = scoresKey !== prevScoresKey.current
  prevScoresKey.current = scoresKey

  if (scoresChanged || forceUpdate) {
    setTodayGames(newTodayGames)
    setRankingWithDetails(newRankingWithDetails)
  }
}
```

> **Importante:** `computeAndSetState` não gerencia `hasData`, `setError` nem `setLoading`.
> Essas responsabilidades pertencem a `initialize()`. Os listeners dos caches chamam apenas
> `computeAndSetState()`.

---

### Lifecycle — useEffect

```ts
useEffect(() => {
  // 1. Adquirir os três caches
  acquireGlobalChannel()           // ScoreCache — canal live-scores-global
  acquirePredictionCache(groupId)  // PredictionCache — canal predictions-${groupId}
  acquirePointsCache(groupId)      // PointsCache — canal points-${groupId}

  // 2. Inicialização assíncrona (ensure* + fetchParticipants + compute)
  void initialize()

  // 3. Listeners reativos — recálculo síncrono sem IO
  let debounceGame: number | undefined
  const unsubGame = subscribeToGameUpdates('usePalpitesAoVivo', () => {
    window.clearTimeout(debounceGame)
    debounceGame = window.setTimeout(() => { computeAndSetState() }, 1000)
  })

  let debouncePred: number | undefined
  const unsubPred = subscribeToPredictionUpdates(groupId, 'usePalpitesAoVivo', () => {
    window.clearTimeout(debouncePred)
    debouncePred = window.setTimeout(() => { computeAndSetState() }, 500)
  })

  let debouncePoints: number | undefined
  const unsubPoints = subscribeToPointsUpdates(groupId, 'usePalpitesAoVivo', () => {
    window.clearTimeout(debouncePoints)
    debouncePoints = window.setTimeout(() => { computeAndSetState() }, 500)
  })

  // 4. visibilitychange → reinicialização completa (ensure* + fetchParticipants + compute)
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      void initialize()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  // 5. Cleanup
  return () => {
    window.clearTimeout(debounceGame)
    window.clearTimeout(debouncePred)
    window.clearTimeout(debouncePoints)
    unsubGame()
    unsubPred()
    unsubPoints()
    releaseGlobalChannel()
    releasePredictionCache(groupId)
    releasePointsCache(groupId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}, [groupId, currentUserId, selectedDate])
```

---

### Listeners e debounce

| Evento | Fonte | Debounce | Ação |
|---|---|---|---|
| Game atualizado | `subscribeToGameUpdates` (ScoreCache) | 1000ms | `computeAndSetState()` |
| Palpite alterado | `subscribeToPredictionUpdates` (PredictionCache) | 500ms | `computeAndSetState()` |
| Pontuação calculada | `subscribeToPointsUpdates` (PointsCache) | 500ms | `computeAndSetState()` |
| Tela volta ao foco | `visibilitychange` | nenhum | `initialize()` |

Todos os listeners de evento chamam apenas `computeAndSetState()` — nenhum faz IO.
O `visibilitychange` chama `initialize()` que inclui `fetchParticipants()` e `ensure*`.

**Substituição de listener existente:** o listener `subscribeToPredictionInvalidations`
(que hoje dispara `fetchAll()` inteiro) deve ser substituído por
`subscribeToPredictionUpdates` (granular). O `subscribeToPredictionInvalidations` não
deve ser registrado neste hook.

---

### Imports a remover

```ts
// Remover:
import { createClient } from '@/lib/supabase/client'
// Remover importação de subscribeToPredictionInvalidations:
import { subscribeToPredictionInvalidations, ... } from '@/lib/cache/prediction-cache'
```

O `createClient` não deve mais aparecer no arquivo — toda leitura de dados passa pelos
caches ou pelo `fetchParticipants()` (que chama `createClient` internamente, via helper
de sessão apenas para obter o token).

> **Exceção:** se `fetchParticipants` precisar de `createClient` para obter a sessão,
> o import pode ser mantido exclusivamente para esse uso. Entretanto, a alternativa
> preferida é extrair o token via `supabase.auth.getSession()` usando o singleton já
> disponível em `lib/supabase/client.ts`. Neste caso `createClient` permanece mas
> nenhuma query de tabela (`.from(...)`) é feita diretamente pelo hook.

### Imports a adicionar

```ts
import { useRef } from 'react'  // já pode existir; adicionar se não estiver

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
  subscribeToPredictionUpdates,   // substitui subscribeToPredictionInvalidations
} from '@/lib/cache/prediction-cache'

import {
  acquirePointsCache,
  releasePointsCache,
  ensurePoints,
  getCachedPoints,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'
```

---

### Interface pública — sem breaking change

A assinatura de `usePalpitesAoVivo` e os tipos exportados permanecem idênticos:

```ts
export function usePalpitesAoVivo(
  groupId: string,
  currentUserId: string,
  selectedDate: string
): UsePalpitesAoVivoResult

export interface UsePalpitesAoVivoResult {
  todayGames: LiveGameWithPrediction[]
  rankingWithDetails: RankingParticipantDetail[]
  loading: boolean
  error: string | null
  lastPolledAt: Date | null
  refresh: () => Promise<void>
}
```

A função `refresh` (exposta para uso manual) deve chamar `initialize()` com `forceUpdate`
implícito (já que `initialize()` chama `computeAndSetState(true)`).

Os tipos `LiveGameWithPrediction`, `GameScoreEntry`, `RankingParticipantDetail` permanecem
inalterados.

---

## Regras de Negócio

### Pontuação de jogos finalizados

A pontuação oficial de jogos `finished` vem exclusivamente de `getCachedPoints(groupId)`.
O hook não consulta a tabela `scores` diretamente. `PointsCache.ensurePoints` filtra
internamente apenas jogos com `status === 'finished'`.

### Pontuação de jogos ao vivo

Calculada client-side via `calculateLiveScore` (importado de `@/lib/scoring`) usando
dados de `getCachedGames(selectedDate)` (placar ao vivo) e `getCachedPredictions(groupId)`
(palpite do usuário). Lógica idêntica à atual.

### Guard FLIP (`prevScoresKey`)

Preservado sem alteração. O fingerprint é computado a partir de `getCachedGames(selectedDate)`,
que o `ScoreCache` mantém atualizado via Realtime. O guard evita re-renders desnecessários
quando nenhum placar ou status mudou.

### `/api/ranking` — somente para nomes de participantes

A resposta de `/api/ranking` é armazenada em `rankingEntriesRef.current` e usada para
obter `participant_name` e `user_id` dos participantes. Os `total_points` da API (ranking
do torneio inteiro) são descartados — o hook calcula os pontos do dia a partir dos caches.

### `refresh` público

A função `refresh: () => Promise<void>` exposta pelo hook chama `initialize()`, que por
sua vez chama `computeAndSetState(true)` (forçando re-render independente do guard FLIP).
O contrato é: `refresh` reinicializa todos os dados, inclusive os nomes dos participantes.

### Erros transientes

Mantido o comportamento atual: erros só atualizam `error` state se `hasData.current` for
falso. Erros após o primeiro carregamento bem-sucedido são silenciosos (logados no console).

---

## Proteção de Rotas

Nenhuma rota nova. O hook é consumido por componentes já protegidos. O token de
autenticação para `/api/ranking` é obtido via `supabase.auth.getSession()` dentro
de `fetchParticipants()`.

---

## Integração Supabase Realtime

Nenhum canal novo é criado por este hook. Os três `acquire*` garantem que os canais
dos caches estão abertos:

| Canal | Dono | Listener no hook |
|---|---|---|
| `live-scores-global` | ScoreCache | `subscribeToGameUpdates` |
| `predictions-${groupId}` | PredictionCache | `subscribeToPredictionUpdates` |
| `points-${groupId}` | PointsCache | `subscribeToPointsUpdates` |

O hook nunca chama `supabase.channel(...)` diretamente.

---

## Critérios de Aceite

- [ ] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('games')` no arquivo (grep: `\.from\('games'\)`)
- [ ] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('predictions')` no arquivo
- [ ] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('scores')` no arquivo
- [ ] `usePalpitesAoVivo.ts`: `subscribeToPredictionInvalidations` não é importado nem chamado
- [ ] `usePalpitesAoVivo.ts`: `acquirePointsCache` e `releasePointsCache` são chamados no mount/unmount
- [ ] `usePalpitesAoVivo.ts`: `ensureDate`, `ensurePredictions`, `ensurePoints` são chamados em `initialize()`
- [ ] `usePalpitesAoVivo.ts`: `subscribeToPointsUpdates` é registrado como listener com debounce de 500ms
- [ ] `usePalpitesAoVivo.ts`: `fetch('/api/ranking')` aparece apenas dentro de `fetchParticipants()`, não em nenhum listener de evento
- [ ] `usePalpitesAoVivo.ts`: `computeAndSetState` não contém `await` nem `fetch` nem chamadas a `.from(`
- [ ] `usePalpitesAoVivo.ts`: `visibilitychange` chama `initialize()`, não `fetchAll()`
- [ ] `usePalpitesAoVivo.ts`: `prevScoresKey` preservado — fingerprint computado de `getCachedGames(selectedDate)`
- [ ] Interface pública (`UsePalpitesAoVivoResult`, `LiveGameWithPrediction`, `GameScoreEntry`, `RankingParticipantDetail`) mantida sem alteração de tipos
- [ ] `npm run build` passa sem erros TypeScript ao final
- [ ] Na aba Network do DevTools: um tick de placar ao vivo não dispara query a `games`, `predictions` ou `scores`, e não dispara `/api/ranking`
