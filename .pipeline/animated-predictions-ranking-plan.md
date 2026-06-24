# Plano de Implementação: Animação de Posição dos Palpites na Página Pública de Jogo

**Slug:** animated-predictions-ranking
**Branch:** feature/animated-predictions-ranking
**Data:** 2026-06-24
**Spec:** .pipeline/animated-predictions-ranking-spec.md

## Tarefas

- [ ] 1. Implementar função `sortParticipants` para ordenação reativa conforme status do jogo (`pending`, `live`, `finished`)
- [ ] 2. Adicionar `useMemo` para calcular `sortedParticipants` a partir de `participants`, `gameStatus`, `liveHomeScore` e `liveAwayScore`
- [ ] 3. Substituir a estrutura `<table>` por `<div role="table">` com divs semânticas e roles ARIA corretos
- [ ] 4. Implementar refs de DOM via `useRef<Map<string, HTMLDivElement>>` para rastrear posições de cada row por `userId`
- [ ] 5. Implementar técnica FLIP manual com `useLayoutEffect`: snapshot de posições antes do update, calcular delta, aplicar transform inverso, forçar reflow, restaurar transition para animar
- [ ] 6. Adicionar guard `isFirstRender` com `useRef` para suprimir animação no primeiro render
- [ ] 7. Capturar snapshot de posições (FIRST) antes de cada `setParticipants` no handler Realtime de `scores`
- [ ] 8. Garantir que mudanças de `liveHomeScore`/`liveAwayScore` (props) também disparam o FLIP via `useLayoutEffect` sobre `sortedParticipants`
- [ ] 9. Preservar aparência visual: cores, tipografia, paddings, bordas e rodapé inalterados
- [ ] 10. Verificar `npm run lint` e `npm run build` sem erros
