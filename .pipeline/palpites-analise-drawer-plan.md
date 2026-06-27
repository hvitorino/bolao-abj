# Plano de Implementação: Drawer de Análise na Aba Palpites

**Slug:** palpites-analise-drawer
**Branch:** feature/palpites-analise-drawer
**Data:** 2026-06-27
**Spec:** .pipeline/palpites-analise-drawer-spec.md

## Tarefas

- [ ] 1. Criar `lib/analytics/team-stats.ts` com `GameRow`, `calculateTeamStats` e `getRecentGames` extraídos de `analise/page.tsx`
- [ ] 2. Atualizar `app/(dashboard)/jogos/[gameId]/analise/page.tsx` para importar de `@/lib/analytics/team-stats` e remover definições locais duplicadas
- [ ] 3. Criar `app/api/analise-data/route.ts` (Next.js Route Handler autenticado: verifica auth + membership, executa queries paralelas, retorna JSON)
- [ ] 4. Criar `components/bolao/GameAnaliseDrawer.tsx` (drawer com slide-up, backdrop, skeleton, ESC, scroll lock)
- [ ] 5. Modificar `components/bolao/PalpitesLiveCard.tsx`: adicionar prop `onGameClick`, converter `GameItem` de `<div>` para `<button>` com hover state
- [ ] 6. Modificar `app/(dashboard)/palpites/palpites-live-section.tsx`: adicionar estado `selectedGameId`, conectar `onGameClick` e renderizar `GameAnaliseDrawer`
