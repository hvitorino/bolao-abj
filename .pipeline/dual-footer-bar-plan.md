# Plano de Implementação: Barra Dupla no Rodapé (Rolou ontem / Tá rolando)

**Slug:** dual-footer-bar
**Branch:** feature/dual-footer-bar
**Data:** 2026-06-19
**Spec:** .pipeline/dual-footer-bar-spec.md

## Tarefas

- [ ] 1. Criar hook `useLiveTodayRanking` em `lib/hooks/useLiveTodayRanking.ts` com lógica de dados BRT de hoje, busca de jogos/scores/predictions, cálculo de pontos parciais via `calculateLiveScore`, e subscriptions Realtime para `games` e `scores`
- [ ] 2. Criar componente `DualFooterBar` em `components/bolao/DualFooterBar.tsx` com dois botões lado a lado (flex), visibilidade individual por prop, estilos idênticos ao `RecapFooterButton` atual, ponto animado em `color-accent` (ROLOU ONTEM) e `color-live` (TÁ ROLANDO)
- [ ] 3. Criar componente `LiveTodayBottomSheet` em `components/bolao/LiveTodayBottomSheet.tsx` com animações `slideUp/slideDown`, tabela de ranking do dia, estados de loading/vazio, legenda de pontos parciais e safe-area iOS
- [ ] 4. Modificar `RecapController` para importar e renderizar `DualFooterBar` e `LiveTodayBottomSheet`, instanciar `useLiveTodayRanking`, gerenciar estado `liveTodayOpen`, e atualizar o `useEffect` de `--recap-footer-h`
- [ ] 5. Deletar `components/bolao/RecapFooterButton.tsx` após confirmar que nenhum outro arquivo além de `RecapController.tsx` o importa
