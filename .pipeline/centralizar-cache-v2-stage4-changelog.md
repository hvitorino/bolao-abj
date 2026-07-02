# Changelog: usePalpitesAoVivo lê dos caches

**Slug:** centralizar-cache-v2-stage4
**Branch:** feature/centralizar-cache-v2-stage4
**Data:** 2026-07-02
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend — Hook modificado

- `lib/hooks/usePalpitesAoVivo.ts` — reescrita completa do sistema de dados:

  **Arquitetura:**
  - **Fluxo A (`initialize`)** — assíncrono, IO: chamado apenas no mount e `visibilitychange`.
    Executa `ensureDate`, `ensurePredictions`, `ensurePoints` em paralelo, busca nomes via
    `fetchParticipants()` (único ponto que chama `/api/ranking`) e dispara
    `computeAndSetState(true)`.
  - **Fluxo B (`computeAndSetState`)** — síncrono, zero IO: chamado pelos listeners dos caches
    via debounce. Lê `getCachedGames`, `getCachedPredictions`, `getCachedPoints` e
    `rankingEntriesRef.current` e recomputa `todayGames` + `rankingWithDetails` puramente
    em memória.

  **Mudanças principais:**
  - Removidas as queries diretas a `games`, `predictions` e `scores` (4 chamadas Supabase
    por tick, ~151 linhas deletadas)
  - Adicionados `acquirePointsCache`/`releasePointsCache` para gerenciar ciclo de vida do
    canal `points-${groupId}`
  - `subscribeToPredictionUpdates` (granular) substitui `subscribeToPredictionInvalidations`
    (coarse) — evitando refetch desnecessário ao receber evento de palpite
  - `fetch('/api/ranking')` isolado em `fetchParticipants()`, chamado apenas no mount e
    `visibilitychange` — não disparado por tick de jogo ao vivo
  - Guard `prevScoresKey` preservado — fingerprint computado de `getCachedGames(selectedDate)`
  - Interface pública (`UsePalpitesAoVivoResult`, tipos exportados) mantida sem breaking changes

### Caches utilizados (nenhum modificado)

- `lib/cache/score-cache.ts` — `ensureDate`, `getCachedGames`, `subscribeToGameUpdates`,
  `acquireGlobalChannel`, `releaseGlobalChannel`
- `lib/cache/prediction-cache.ts` — `ensurePredictions`, `getCachedPredictions`,
  `subscribeToPredictionUpdates`, `acquirePredictionCache`, `releasePredictionCache`
- `lib/cache/points-cache.ts` — `ensurePoints`, `getCachedPoints`, `subscribeToPointsUpdates`,
  `acquirePointsCache`, `releasePointsCache`

---

## Decisões técnicas

1. **`rankingEntriesRef` em vez de state:** os nomes dos participantes raramente mudam durante
   uma sessão. Armazená-los num `useRef` evita re-renders quando os caches atualizam placares
   mas os nomes permanecem os mesmos.
2. **`fetchParticipants` sequencial (não no `Promise.all`):** o token de autenticação é
   necessário para `/api/ranking` e depende de `supabase.auth.getSession()`. Isolar em
   função separada mantém o código mais legível e permite early-return se não houver sessão.
3. **Debounce de 1000ms para games vs 500ms para predictions/points:** placar ao vivo atualiza
   com frequência (vários eventos por segundo durante um jogo). Debounce maior evita
   sobrecarga de cálculo client-side (`calculateLiveScore` para cada participante × cada jogo).
   Palpites e pontuações são eventos pontuais — debounce menor garante responsividade.
4. **`lastPolledAt` mantido como `useState` sem setter:** preserva a interface pública sem
   breaking change, mesmo que o valor nunca seja atualizado (o polling agora é gerido pelos
   caches, não pelo hook).

---

## Pontos de atenção para revisão

- `createClient` ainda é importado — mas **apenas** para `supabase.auth.getSession()` em
  `fetchParticipants()`. Nenhuma query `.from()` é feita pelo hook.
- O `visibilitychange` chama `initialize()` (que inclui `fetchParticipants`). Isso é
  intencional — ao voltar do sleep/lock screen, a sessão pode ter expirado e os nomes
  precisam ser revalidados.
- O `computeAndSetState` pode ser chamado antes de `initialize` completar se um evento
  Realtime chegar durante a carga inicial. Isso é seguro: `getCached*` retorna estruturas
  vazias (`new Map()`) e `rankingEntriesRef.current` é `[]` — o estado fica vazio até
  `initialize` completar e chamar `computeAndSetState(true)`.

---

## Critérios de aceite — verificação

- [x] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('games')`
- [x] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('predictions')`
- [x] `usePalpitesAoVivo.ts`: nenhuma chamada `.from('scores')`
- [x] `usePalpitesAoVivo.ts`: `subscribeToPredictionInvalidations` não é importado nem chamado
- [x] `usePalpitesAoVivo.ts`: `acquirePointsCache` e `releasePointsCache` chamados no mount/unmount
- [x] `usePalpitesAoVivo.ts`: `ensureDate`, `ensurePredictions`, `ensurePoints` em `initialize()`
- [x] `usePalpitesAoVivo.ts`: `subscribeToPointsUpdates` registrado com debounce 500ms
- [x] `usePalpitesAoVivo.ts`: `/api/ranking` apenas dentro de `fetchParticipants()`
- [x] `usePalpitesAoVivo.ts`: `computeAndSetState` não contém `await`, `fetch` ou `.from(`
- [x] `usePalpitesAoVivo.ts`: `visibilitychange` chama `initialize()`
- [x] `usePalpitesAoVivo.ts`: `prevScoresKey` preservado
- [x] Interface pública mantida sem alteração de tipos
- [x] `npx tsc --noEmit` passa sem erros

---

## Commits realizados

```
64dcba9 feat(centralizar-cache-v2-stage4): usePalpitesAoVivo agora lê dos caches centralizados
```
