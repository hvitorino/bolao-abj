# Plano de Implementação: Chaveamento Expansível no Card de Palpites

**Slug:** inline-bracket-expand
**Branch:** feature/inline-bracket-expand
**Data:** 2026-06-30
**Spec:** .pipeline/inline-bracket-expand-spec.md

## Tarefas

- [ ] 1. Adicionar `phase` ao hook `usePalpitesAoVivo` (interface + select)
- [ ] 2. Adicionar props `groupId` e `currentUserId` ao `PalpitesLiveCard`
- [ ] 3. Implementar ícone ⤢/⤡ e lógica de detecção de mata-mata no cabeçalho
- [ ] 4. Implementar fetch lazy do bracket (slots + games + predictions)
- [ ] 5. Renderizar `BracketTree` inline quando expandido
- [ ] 6. Integrar `GameAnaliseDrawer` para cliques no bracket
- [ ] 7. Passar `groupId`/`currentUserId` de `PalpitesLiveSection` para `PalpitesLiveCard`
