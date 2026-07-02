# Changelog: Cache Centralizado de Placar e Palpites

**Slug:** score-prediction-cache
**Branch:** feature/score-prediction-cache
**Data:** 2026-07-01
**Status:** aguardando revisão

---

## O que foi implementado

### Infraestrutura de Cache (novos arquivos)

- `lib/cache/score-cache.ts` — singleton module-level com Realtime global (1 canal `live-scores-global` para tabela `games`) + Polling 30s gerenciado por status do jogo + Timers para ativação de jogos `pending` (5min antes do início). Elimina os N canais individuais do `useGameRealtime`.
- `lib/cache/prediction-cache.ts` — singleton module-level escopado por `group_id` com Realtime (1 canal `predictions-{groupId}`) + Polling 60s fallback + `visibilitychange` listener. Cache flat por data com chave `gameId:userId`, convertido para formato nested (gameId → userId → pred) na exposição pública.
- `lib/ranking-derived.ts` — função pura `computeLiveRanking(games, predictions, scores, members)` que unifica a lógica espalhada em `usePalpitesAoVivo`, `RankingTable.applyLivePoints`, `useLivePointsByUser` e `useLiveTodayRanking`. Inclui `computeLivePointsByUser` para o ranking geral.

### Hooks (novos arquivos)

- `lib/hooks/useLiveScores.ts` — hook consumindo ScoreCache. Retorna `{ games: LiveGameScore[], loading, error }`. Cache entre datas, 1 canal Realtime global, Polling 30s por jogo.
- `lib/hooks/usePredictionsRealtime.ts` — hook consumindo PredictionCache. Retorna `{ predictionsByGame, myPredictions, loading, hasData, error }`. Palpites reativos via Realtime + Polling 60s.

### Banco de Dados

- `supabase/migrations/20260701000000_enable_realtime_predictions.sql` — `ALTER TABLE predictions REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE predictions`. Mesmo padrão de `games` e `scores` (migration `20260614193000_fix_realtime_final.sql`).

### Componentes Migrados

- `components/games/GameCard.tsx` — props opcionais `liveGame?: Game` e `liveParticipants?: ParticipantEntry[]`. Quando fornecidos, pulam `useGameRealtime` e `useParticipantsRealtime` respectivamente. Backward compatible — quando não fornecidos, usa comportamento antigo.
- `components/games/JogosRealtime.tsx` (novo) — Client Component que conecta `useLiveScores` + `usePredictionsRealtime` ao `GameCard`. Gerencia loading/empty states, round header, e merge de participants SSR com PredictionCache.
- `app/(dashboard)/jogos/page.tsx` — substitui `<GameList>` por `<JogosRealtime>`. Agora os dados de jogos na aba `/jogos` são reativos via ScoreCache (1 canal global) + PredictionCache (1 canal por grupo), sem `useGameRealtime`/`useScoreRealtime`/`useParticipantsRealtime` individuais.

### Componentes NÃO migrados (ainda coexistem)

Os seguintes hooks e componentes continuam funcionando com a implementação antiga:
- `usePalpitesAoVivo` (polling 10s) — usado em `/palpites`, `AcompanharCarrossel`, `AcompanharRanking`
- `useLivePointsByUser` — usado em `RankingTable`
- `useLiveTodayRanking` — usado em `LiveTodayBottomSheet`, `SidePanelContainer`
- `useParticipantsRealtime` — ainda usado por `GameCard` quando sem `liveParticipants` prop (backward compat), e por `PublicGameClient`

### Decisões técnicas

1. **Backward compatibility no GameCard:** as props `liveGame` e `liveParticipants` são opcionais. Quando ausentes, GameCard mantém o comportamento antigo (`useGameRealtime` + `useParticipantsRealtime`). Isso permite migração gradual — apenas a página `/jogos` usa o novo fluxo por enquanto.

2. **PredictionCache flat → nested:** o cache armazena internamente `Map<"gameId:userId", pred>` (flat), mas expõe `Map<gameId, Map<userId, pred>>` (nested) via `getCachedPredictions()`. A conversão ocorre a cada leitura para manter a API do hook `usePredictionsRealtime` compatível com o formato esperado pelos componentes.

3. **ScoreCache com Realtime global:** em vez de N canais (um por GameCard), usa 1 canal `live-scores-global` para tabela `games` com evento `UPDATE`. O listener distribui updates para os componentes via callback registrado.

4. **Hooks obsoletos NÃO removidos:** `useGameRealtime`, `useScoreRealtime`, `usePalpitesAoVivo`, `useLivePointsByUser`, `useLiveTodayRanking` e `useParticipantsRealtime` são mantidos para que os componentes ainda não migrados continuem funcionando. A remoção será feita após todas as superfícies migrarem.

### Pontos de atenção para revisão

- A migration SQL precisa ser aplicada manualmente no Supabase para que o Realtime de `predictions` funcione
- Os componentes `/palpites`, `RankingTable` e `LiveTodayBottomSheet` ainda usam hooks antigos — migração futura
- `GameCard` em `PublicGameClient` e `GameAnaliseDrawer` ainda usa `useGameRealtime` (sem `liveGame` prop)
- O cache é limpo ao trocar de grupo (`clearScoreCache()` + `clearPredictionCache()`)

---

## Commits realizados

```
073607f feat(score-prediction-cache): cria PredictionCache, usePredictionsRealtime, migration SQL e computeLiveRanking
fc724db feat(score-prediction-cache): cria ScoreCache singleton e useLiveScores hook
e1f02b0 feat(score-prediction-cache): migra GameCard e jogos/page para ScoreCache + PredictionCache
064a7b6 chore(score-prediction-cache): adiciona plano de implementação
2e66a40 chore(score-prediction-cache): adiciona spec
baaa721 chore(pipeline): adiciona score-prediction-cache ao roadmap
```
