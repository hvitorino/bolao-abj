# Changelog: Exibir Todos os Jogos Anteriores na Análise

**Slug:** fix-all-recent-games
**Branch:** feature/fix-all-recent-games
**Data:** 2026-06-30
**Status:** aguardando revisão

---

## O que foi implementado

### Backend
Nenhuma alteração. A query Supabase já retorna todos os jogos — a limitação era apenas no frontend.

### Frontend (Next.js/React)
- `lib/analytics/team-stats.ts` — Removido `.slice(0, 3)` da função `getRecentGames`, fazendo com que todos os jogos anteriores sejam retornados (não apenas os 3 mais recentes).
- `components/bolao/RecentGamesSection.tsx` — Título da seção alterado de `► ÚLTIMOS 3 JOGOS NA COPA 2026` para `► JOGOS`.
- `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — Comentários atualizados para refletir a nova semântica ("jogos anteriores" em vez de "últimos 3 jogos").

### Banco de Dados
Nenhuma alteração.

---

## Decisões técnicas

A ordenação por data (mais recente primeiro) foi mantida — apenas o limite numérico foi removido. A interface já usa `TeamColumn` com `GameRow` em loop, então a lista cresce naturalmente conforme mais jogos existem.

---

## Pontos de atenção para revisão

- Verificar que `RecentGamesSection` também é usado no `GameAnaliseDrawer.tsx` e que ambos os contextos continuam funcionando
- Em times com muitos jogos (ex: final da copa), a lista pode ficar longa — a seção já tem scroll natural por ser parte do fluxo da página

---

## Commits realizados

```
e1890db feat(fix-all-recent-games): atualiza comentários na página de análise
afb0a9e feat(fix-all-recent-games): altera título da seção para 'JOGOS'
5c4dd4a feat(fix-all-recent-games): remove limite de 3 jogos em getRecentGames
03a3f48 chore(fix-all-recent-games): adiciona plano de implementação
```
