# Plano de Implementação: Cards Visuais de Jogos no Recap

**Slug:** recap-game-cards
**Branch:** feature/recap-game-cards
**Data:** 2026-06-19
**Spec:** .pipeline/recap-game-cards-spec.md

## Tarefas

- [ ] 1. Adicionar import de `getTeamFlag` em `RecapBottomSheet.tsx`
- [ ] 2. Remover estilos `gameRow` e `gameScore` do objeto `S` (dead code)
- [ ] 3. Definir sub-componente `RecapGameCard` com layout grid `1fr auto 1fr` antes do componente principal
- [ ] 4. Substituir bloco de renderização de jogos (linhas 311-323) pelo uso de `<RecapGameCard>`
- [ ] 5. Verificar `npm run lint` e `npm run build` sem erros novos
