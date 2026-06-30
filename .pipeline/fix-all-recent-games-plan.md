# Plano de Implementação: Exibir Todos os Jogos Anteriores na Análise

**Slug:** fix-all-recent-games
**Branch:** feature/fix-all-recent-games
**Data:** 2026-06-30
**Spec:** .pipeline/fix-all-recent-games-spec.md

## Tarefas

- [ ] 1. Remover `.slice(0, 3)` em `lib/analytics/team-stats.ts`
- [ ] 2. Alterar título para "► JOGOS" em `components/bolao/RecentGamesSection.tsx`
- [ ] 3. Atualizar comentários em `app/(dashboard)/jogos/[gameId]/analise/page.tsx`
