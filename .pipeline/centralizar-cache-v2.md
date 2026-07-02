# Centralizar atualização de palpites e placares

## Context

Cada componente do Bolão ABJ que precisa de palpites (`predictions`) ou placares
(`games` + `scores`) montou seu próprio mecanismo de atualização: hoje há **9 canais
Realtime** e vários `setInterval` independentes, muitos assinando as mesmas tabelas.
Isso sobrecarrega o Supabase com assinaturas e queries redundantes e abre espaço para
inconsistência entre usuários logados (uma tela recebe um evento que outra não recebe).

Já existe uma tentativa parcial de centralização — dois singletons de módulo:
`lib/cache/score-cache.ts` (tabela `games`) e `lib/cache/prediction-cache.ts`
(`predictions`). Porém só a página `/jogos` (via `JogosRealtime`) realmente consome
ambos; todo o resto ainda busca por conta própria. Além disso, **a tabela `scores`
não tem cache algum** — três canais separados a assinam.

**Objetivo:** um centralizador por domínio de dado — `games`, `predictions`, `scores` —
cada um com **exatamente 1 canal Realtime + 1 ticker/fallback**, e **todos** os
consumidores (incluindo páginas públicas) lendo desses caches. Nenhum hook/componente
abre canal próprio nem consulta tabela crua diretamente.

**Escopo aprovado:** completo (stages 1–8, inclui páginas públicas).
**Execução aprovada:** via pipeline de agentes (PM → Analista → Programador → Revisor),
gerando specs/changelog em `.pipeline/`.

## Arquitetura-alvo (contrato uniforme)

Três caches singleton, cada um dono de UMA tabela, com 1 canal + 1 ticker:

| Cache | Escopo | Canal | Ticker/fallback |
|---|---|---|---|
| `ScoreCache` (`games`) — existe | global, por data | `live-scores-global` | polling 30s por jogo + timers pré-jogo |
| `PredictionCache` (`predictions`) — existe | por grupo, por data | `predictions-${groupId}` | polling 60s + `visibilitychange` |
| **`PointsCache` (`scores`) — NOVO** | por grupo | `points-${groupId}` | polling 60s + `visibilitychange` |

> Nomenclatura: o cache novo se chama **`PointsCache`** (não `ScoresCache`) para não
> colidir com o `ScoreCache` existente. É preciso: a tabela `scores` guarda `points` +
> `breakdown` — a pontuação por palpite. `ScoreCache` continua sendo o dono da tabela
> `games` (placar ao vivo dos jogos).

**Regras do contrato:**
1. Só um cache pode chamar `supabase.channel(...)` ou `supabase.from(<sua tabela>)`.
2. Cada cache expõe: `ensure*(escopo, date)` (carrega+seed), `getCached*` (leitura
   síncrona), `subscribe*Updates` (granular), `subscribe*Invalidations` (coarse),
   `acquire/release` (refcount + ciclo de vida do canal), `clear` (troca de grupo).
3. Hooks derivados só: `acquire` → `ensure` → `getCached*` → `subscribe` → recomputar
   (debounced) → `release`. Nunca abrem canal nem consultam tabela crua.
4. Agregados de servidor (`GET /api/ranking`, RPCs `get_ranking`/scouts/streak — que
   NÃO podem ser reconstruídos de caches por-data) permanecem no servidor; seu refresh
   é disparado por `subscribe*Invalidations`, com debounce, nunca por canal próprio.

## Novo arquivo: `lib/cache/points-cache.ts` (`PointsCache`)

Espelhar `prediction-cache.ts` 1:1 (getOrCreate, ensureRealtime, startPolling,
invalidate, upsert/remove, subscribe*, acquire/release/clear), com **uma simplificação
deliberada**: armazenar como **um único `Map<gameId, Map<userId, CachedPoints>>` por
grupo** (não um flat-map por data). Isso evita o bug latente do PredictionCache
(§Riscos) e elimina a reconversão flat→nested a cada leitura.

```ts
export interface CachedPoints {
  user_id: string
  game_id: string
  group_id: string
  points: number
  breakdown: ScoreBreakdown
}
```

API pública (nomes paralelos ao PredictionCache):
- `ensurePoints(groupId, date)` — resolve `games` do `match_day` (mesma query que
  `ensurePredictions` já faz), busca `scores` `group_id=eq` + `game_id in (finished)`,
  faz merge no map; chama `ensurePointsRealtime` + `startPointsPolling`. Early-return
  se `loadedDates.has(date)`.
- `ensurePointsForGame(groupId, gameId)` — carga de um jogo só (caminho público single-game).
- `getCachedPoints(groupId): Map<gameId, Map<userId, CachedPoints>>` — leitura síncrona.
- `getPointsFor(groupId, gameId, userId): CachedPoints | null` — seed p/ GameCard/lista.
- `subscribeToPointsUpdates(groupId, source, (points, eventType) => void)` — granular.
- `subscribeToPointsInvalidations(groupId, source, () => void)` — coarse (refresh de `/api/ranking`).
- `acquirePointsCache(groupId)` / `releasePointsCache(groupId)` — refcount. `acquire`
  DEVE chamar `ensurePointsRealtime` mesmo sem `ensurePoints` (senão subscribers que
  não abrem data — ex. `useRankingRealtime` — nunca recebem eventos; mesmo motivo do
  comentário em `acquirePredictionCache`).
- `clearPointsCache(groupId)` — teardown na troca de grupo.

Realtime: canal `points-${groupId}`, `event:'*'`, `filter: group_id=eq.${groupId}`
(assina a tabela `scores`); DELETE remove, senão upsert; dispara `detailListeners` e
depois `listeners`.

## Sequência por stages (independentemente entregáveis)

**Stage 0 — Verificação DB (sem código).** Confirmar pré-requisitos já presentes em
migrations: `scores REPLICA IDENTITY FULL` + na publication `supabase_realtime`
(`20260614193000_fix_realtime_final.sql`), RLS SELECT `USING(true)` p/ authenticated e
anon (`..._final.sql` + `20260624000010_public_read_games_scores.sql`), `scores.group_id`
não-nulo (`20260615120400_group_scoped_rls.sql`). Verificar que `group_id` chega no
payload Realtime. **Nenhuma migration nova é necessária.**

**Stage 1 — Criar `lib/cache/points-cache.ts`.** Arquivo novo, dead code até ser
ligado; entrega segura sozinho. Modelar em `prediction-cache.ts` com o map único nested.

**Stage 2 — `useRankingRealtime` no event-bus do PointsCache.** Em
`lib/hooks/useRankingRealtime.ts`: remover o bloco `supabase.channel('ranking-scores-...')`;
`acquirePointsCache(groupId)` + `subscribeToPointsInvalidations(...)` (debounce 1s) →
refetch de `/api/ranking`; `releasePointsCache` no unmount. Remove o 1º canal `scores` redundante.

**Stage 3 — `useLivePointsByUser` + `useLiveTodayRanking` leem dos caches.** Substituir
queries cruas de `games`/`predictions`/`scores` por `ensure*`/`getCached*` +
`calculateLiveScore` (já usado). Manter a query one-shot de nomes de participantes
(`group_members.profiles(name)`) — nomes não vão para cache. Recalcular nas subscriptions.

**Stage 4 — `usePalpitesAoVivo` lê dos caches.** Em `lib/hooks/usePalpitesAoVivo.ts`:
trocar as queries de `games`/`predictions`/`scores` (linhas ~151-188) por
`ensure*`/`getCached*`; **manter o fetch de `/api/ranking` só para nomes, 1x no mount +
`visibilitychange`, não por tick**; adicionar `acquirePointsCache`/`ensurePoints` +
`subscribeToPointsUpdates`; preservar o guard `prevScoresKey` (FLIP) computado dos games
cacheados.

**Stage 5 — Migrar `GameCard` e apagar o trio legado.** Reescrever
`components/games/GameCard.tsx` para alimentar `GameCardView` a partir dos três caches
(games via ScoreCache+`ensureDate(game.match_day)`; pontos via PointsCache+`getPointsFor`;
participantes via PredictionCache + merge idêntico a `JogosRealtime.getParticipantsForGame`
linhas 95-116). Consumidores `app/(dashboard)/jogos/[gameId]/analise/page.tsx` e
`components/bolao/GameAnaliseDrawer.tsx` ficam inalterados. Após verificar ambos,
**apagar** `useGameRealtime.ts`, `useScoreRealtime.ts`, `useParticipantsRealtime.ts`
(remove canais `game-${gameId}` e `score-${gameId}-${userId}` + poll 30s duplicado).
⚠️ `GameCard` NÃO deve chamar `clearScoreCache()` (limparia dados de outra view montada).

**Stage 6 — `PublicParticipantsList` no PointsCache.** Em
`components/bolao/PublicParticipantsList.tsx`: trocar o canal
`public-scores-${gameId}-${groupId}` por `acquirePointsCache` + `ensurePointsForGame` +
`subscribeToPointsUpdates` (seed `getPointsFor`). Remove o 3º canal `scores`. Verificar sob
anon (RLS anon SELECT existe).

**Stage 7 — `useDailyRecap` lê dos caches.** Em `lib/hooks/useDailyRecap.ts`: `ensure*`/
`getCached*` para `yesterday`, mantendo fetch de nomes separado e o fluxo de localStorage.
Não abre/fecha canal; só remove queries duplicadas.

**Stage 8 — Convergir páginas públicas de agregado.** Em
`app/publico/[groupId]/[date]/public-date-client.tsx` (e avaliar
`app/publico/cartola/cartola-client.tsx`): consumir os três caches (client anon honra as
RLS anon + Realtime) e **remover o `setInterval` de 10s**. Maior risco (caminho de render
anon distinto, sem `currentUserId`, seed SSR service-role); entregar por último.

## Riscos

- **Bug latente do flat-key no PredictionCache (NÃO replicar):** `upsertPredictionInCache`
  só grava se a chave já existir num map por-data (`if (dateMap.has(key))`), então um
  palpite NOVO via Realtime numa data já carregada some do cache flat (o listener granular
  ainda atualiza o state local do `usePredictionsRealtime`, mas um `getCachedPredictions()`
  posterior erra). Por isso o PointsCache usa **map único nested**. Considerar back-port
  dessa correção ao PredictionCache depois (fora do escopo primário).
- **Corridas de refcount (StrictMode / remounts):** `release` idempotente, clampar em 0,
  remover só os próprios listeners no unsub, e considerar adiar `removeChannel` por um
  microtask para sobreviver a "0 transitório". Lembrar que `useLiveScores` chama
  `clearScoreCache()` a cada efeito de `groupId` — ao ligar `GameCard` no ScoreCache, ele
  NÃO pode chamar `clearScoreCache`.
- **`/api/ranking` é do torneio inteiro** — permanece no servidor; só o gatilho muda
  (invalidação do PointsCache, debounced).
- **Páginas públicas:** dependem das RLS anon `USING(true)` em `games`/`scores`/
  `predictions` (já presentes) para o client anon receber Realtime.

## Arquivos-chave

- `lib/cache/points-cache.ts` (novo `PointsCache`; modelar em `lib/cache/prediction-cache.ts`)
- `lib/cache/score-cache.ts` (opcional: helper `getAllLiveGames` p/ `useLivePointsByUser`)
- `lib/hooks/useRankingRealtime.ts`, `usePalpitesAoVivo.ts`, `useLivePointsByUser.ts`,
  `useLiveTodayRanking.ts`, `useDailyRecap.ts`
- `components/games/GameCard.tsx`; deletar `useGameRealtime.ts`, `useScoreRealtime.ts`,
  `useParticipantsRealtime.ts`
- `components/bolao/PublicParticipantsList.tsx`,
  `app/publico/[groupId]/[date]/public-date-client.tsx`

## Verificação (por stage e final)

- **Contagem de canais:** com DevTools/log do Supabase, confirmar que um usuário logado
  numa tela mantém no máximo 3 canais de dados (`live-scores-global`, `predictions-*`,
  `points-*`) — hoje chega a somar canais `game-*`, `score-*`, `ranking-scores-*`.
  Os logs coloridos existentes (`[ScoreCache]`, `[PredictionCache]`, e novo `[PointsCache]`)
  ajudam a auditar RECEBIDO/PROPAGANDO por canal.
- **Consistência entre usuários:** em dois navegadores no mesmo grupo, um faz palpite /
  um jogo finaliza → a outra sessão reflete em `/jogos`, `/palpites`, `/ranking` e no
  `GameCard` (análise) sem refresh manual, via 1 evento por tabela.
- **Fallback:** desligar Realtime (ou throttle) e confirmar que o ticker (30s/60s) e o
  `visibilitychange` reidratam os dados.
- **Zero regressão de query redundante:** na aba Network, um tick de placar não deve mais
  disparar N queries `scores`/`predictions` por componente nem `/api/ranking` a cada tick
  do `usePalpitesAoVivo`.
- **Público (Stage 8):** confirmar remoção do `setInterval` de 10s e que a página pública
  atualiza via Realtime anon.
- Rodar `npm run build` / lint ao fim de cada stage antes do merge do Revisor.

## Nota de execução

Como aprovado, disparar o pipeline de agentes para esta feature (slug sugerido:
`data-centralization`). O Analista detalha a spec por stage; o Programador implementa
stage a stage em branch `feature/data-centralization`, com verificação antes de cada
merge; o Revisor aprova cada entrega. Sem `git push` para `origin` sem pedido explícito.
