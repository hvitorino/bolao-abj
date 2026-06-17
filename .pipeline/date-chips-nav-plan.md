# Plano de Implementação: Navegação por Chips de Data

**Slug:** date-chips-nav
**Branch:** feature/date-chips-nav
**Data:** 2026-06-17
**Spec:** .pipeline/date-chips-nav-spec.md

## Tarefas

- [ ] 1. Criar componente `DateChipsNav` em `components/games/DateChipsNav.tsx` com faixa de chips, scroll horizontal sem barra, scroll automático para chip ativo e linha de contadores
- [ ] 2. Atualizar `app/(dashboard)/jogos/page.tsx` — trocar import e uso de `DayNavigator` por `DateChipsNav`
- [ ] 3. Remover arquivo `components/games/DayNavigator.tsx`
