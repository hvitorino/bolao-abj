# Plano de Implementação: Cache Centralizado de Placar e Palpites

**Slug:** score-prediction-cache
**Branch:** feature/score-prediction-cache
**Data:** 2026-07-01
**Spec:** .pipeline/score-prediction-cache-spec.md

## Tarefas

- [ ] 1. Criar `lib/cache/score-cache.ts` — singleton module-level com Realtime global (1 canal `games`)
- [ ] 2. Criar `lib/hooks/useLiveScores.ts` — hook consumindo ScoreCache
- [ ] 3. Criar migration SQL: habilitar `predictions` para Supabase Realtime
- [ ] 4. Criar `lib/cache/prediction-cache.ts` — singleton com Realtime (1 canal por grupo) + Polling 60s
- [ ] 5. Criar `lib/hooks/usePredictionsRealtime.ts` — hook consumindo PredictionCache
- [ ] 6. Criar `lib/ranking-derived.ts` — função pura `computeLiveRanking`
- [ ] 7. Migrar `GameCard` — substituir `useGameRealtime` + `useScoreRealtime` por `useLiveScores`
- [ ] 8. Migrar `usePalpitesAoVivo` → `useLiveScores` + `usePredictionsRealtime` + `computeLiveRanking` (remover polling 10s)
- [ ] 9. Migrar `RankingTable` — substituir `useLivePointsByUser` por `computeLiveRanking`
- [ ] 10. Migrar `LiveTodayBottomSheet` — substituir `useLiveTodayRanking` por `computeLiveRanking`
- [ ] 11. Refatorar `useParticipantsRealtime` para consumir `PredictionCache`
- [ ] 12. Remover hooks obsoletos (`useGameRealtime`, `useScoreRealtime`, `usePalpitesAoVivo`, `useLivePointsByUser`, `useLiveTodayRanking`)
