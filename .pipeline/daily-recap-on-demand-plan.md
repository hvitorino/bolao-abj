# Plano de Implementação: Resumo Diário sob Demanda

**Slug:** daily-recap-on-demand
**Branch:** feature/daily-recap-on-demand
**Data:** 2026-06-19
**Spec:** .pipeline/daily-recap-on-demand-spec.md

## Tarefas

- [ ] 1. Refatorar `DailyRecapModal` para aceitar props `forceOpen` e `onClose`, com dois effects separados (automático e sob demanda)
- [ ] 2. Criar componente `RecapButton` em `components/bolao/RecapButton.tsx` com lógica de visibilidade via `useDailyRecap` e abertura via `forceOpen`
- [ ] 3. Modificar `NavLinks` para aceitar prop `groupId` e renderizar `RecapButton` após os links de rota
- [ ] 4. Modificar `DashboardLayout` para passar `groupId={activeGroup?.id ?? ''}` ao `NavLinks`
