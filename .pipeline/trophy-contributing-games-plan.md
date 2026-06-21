# Plano de Implementação: Confrontos Contribuintes por Troféu

**Slug:** trophy-contributing-games
**Branch:** feature/trophy-contributing-games
**Data:** 2026-06-21
**Spec:** .pipeline/trophy-contributing-games-spec.md

## Tarefas

- [ ] 1. Adicionar interface `ContributingGame` e atualizar `TrophyResult` em `app/api/profile/trophies/route.ts`
- [ ] 2. Adicionar função auxiliar `extractContributingGame` no route handler
- [ ] 3. Atualizar queries paralelas para incluir `games(home_team_code, away_team_code, home_score, away_score)` — abrioRes, cravadaRes, goleadaRes, profetaRes, videnteRes (sem limit), artilheiroRes, streakHistory
- [ ] 4. Atualizar query de `estreia` para incluir join com `games`
- [ ] 5. Atualizar query de `zebreiro` (userWins) para incluir join com `games`
- [ ] 6. Implementar `findStreakContributingGames(threshold)` baseado no `streakHistory`
- [ ] 7. Implementar lógica de contributing_games para `perfeito_na_rodada` e `fiel` (query adicional por match_day)
- [ ] 8. Atualizar `makeTrophy` para receber e propagar `contributingGames`
- [ ] 9. Montar contributing_games para cada troféu e passar para `makeTrophy`
- [ ] 10. Atualizar interface `Trophy` e adicionar `ContributingGame` em `components/bolao/perfil/TrophiesPanel.tsx`
- [ ] 11. Renderizar lista de jogos contribuintes no card de cada troféu no `TrophiesPanel`
- [ ] 12. Verificar lint e build (`npm run lint && npm run build`)
