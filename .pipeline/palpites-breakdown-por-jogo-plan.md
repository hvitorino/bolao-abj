# Plano de Implementação: Breakdown Vertical por Jogo nos Palpites

**Slug:** palpites-breakdown-por-jogo
**Branch:** feature/palpites-breakdown-por-jogo
**Data:** 2026-06-27
**Spec:** .pipeline/palpites-breakdown-por-jogo-spec.md

## Tarefas

- [ ] 1. Remover código legado: funções `buildRuleGroups`, `RuleGroupLine`, `LiveGameLine`, interfaces `RuleGame` e `RuleGroup` de `components/bolao/PalpitesRankingRow.tsx`
- [ ] 2. Implementar componente local `GameBreakdownBlock` com linha-cabeçalho (times + placar real + palpite + total) e sub-linhas de regra indentadas
- [ ] 3. Substituir o render do accordion por iteração sobre `participant.games` com `<GameBreakdownBlock>` e ajustar padding do accordion para `'0.25rem 0.5rem'`
- [ ] 4. Aplicar guard de privacidade para palpite de terceiro em jogo pendente e sinalização de pontos ao vivo com sufixo `*` e cor `color-live`
- [ ] 5. Validar com `npm run lint` e `npm run build` sem erros
