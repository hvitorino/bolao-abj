# Plano de Implementação: Jogos do Dia no Bottom Sheet "Tá Rolando"

**Slug:** live-today-games
**Branch:** feature/live-today-games
**Data:** 2026-06-19
**Spec:** .pipeline/live-today-games-spec.md

## Tarefas

- [ ] 1. Ampliar `useLiveTodayRanking`: adicionar interface `LiveTodayGame`, expandir SELECT da query de jogos, adicionar estado `games`, popular o estado após `setHasGamesToday(true)`, garantir `setGames([])` no branch sem jogos, e atualizar assinatura de retorno do hook
- [ ] 2. Adicionar sub-componente `LiveTodayGameCard` inline em `LiveTodayBottomSheet.tsx`, importar `LiveTodayGame` e `getTeamFlag`, adicionar prop `games` à interface/desestruturação do componente, inserir keyframes `blink` via `<style>`, e renderizar seção "JOGOS DE HOJE" acima do corpo existente
- [ ] 3. Atualizar `RecapController.tsx` para desestruturar `games` do hook e passar como prop `games={liveTodayGames}` ao `LiveTodayBottomSheet`
- [ ] 4. Verificar lint e build sem erros novos
