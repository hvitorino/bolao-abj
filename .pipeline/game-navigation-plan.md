# Plano de Implementação: Navegação de Jogos

**Slug:** game-navigation
**Branch:** feature/game-navigation
**Data:** 2026-06-13
**Spec:** .pipeline/game-navigation-spec.md

## Tarefas

- [ ] 1. Criar tipos TypeScript em `lib/types/game.ts` (`Game`, `GameStatus`)
- [ ] 2. Criar migration SQL em `db/migrations/20260613_create_games.sql` (tabela `games` + RLS)
- [ ] 3. Criar seed script Ruby em `db/seeds/seed_games.rb` com 15+ jogos reais da Copa 2026
- [ ] 4. Criar API route `app/api/games/route.ts` (GET /api/games?date=YYYY-MM-DD)
- [ ] 5. Criar componente `components/games/GameCard.tsx`
- [ ] 6. Criar componente `components/games/GameList.tsx`
- [ ] 7. Criar componente `components/games/DayNavigator.tsx` (Client Component)
- [ ] 8. Substituir placeholder `app/(dashboard)/jogos/page.tsx` com implementação real
- [ ] 9. Escrever changelog `game-navigation-changelog.md`
