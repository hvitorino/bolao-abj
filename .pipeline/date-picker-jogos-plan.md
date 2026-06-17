# Plano de Implementação: Seletor de Datas com Jogos

**Slug:** date-picker-jogos
**Branch:** feature/date-picker-jogos
**Data:** 2026-06-17
**Spec:** .pipeline/date-picker-jogos-spec.md

## Tarefas

- [ ] 1. Adicionar função `matchDateToLocalDate` em `lib/date.ts`
- [ ] 2. Atualizar `JogosPage` para buscar `availableDates` e passar para `DayNavigator`
- [ ] 3. Atualizar `DayNavigator` com interface estendida, estado de picker e lógica de abertura/fechamento
- [ ] 4. Implementar dropdown com lista de datas, destaque de data atual e navegação por clique
- [ ] 5. Implementar navegação por teclado (ArrowUp/Down, Enter, Esc, Tab) e acessibilidade (ARIA)
- [ ] 6. Implementar scroll automático do item focado e reset de focusedIndex ao fechar
- [ ] 7. Implementar fechar ao clicar fora (mousedown listener no document)
