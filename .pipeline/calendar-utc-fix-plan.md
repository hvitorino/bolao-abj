# Plano de Implementação: Corrigir Agrupamento de Jogos no Calendário para Usar UTC

**Slug:** calendar-utc-fix
**Branch:** feature/calendar-utc-fix
**Data:** 2026-06-20
**Spec:** .pipeline/calendar-utc-fix-spec.md

## Tarefas

- [ ] 1. Adicionar função `matchDateToUTCDate` em `lib/date.ts` (extrai data UTC do ISO 8601 sem conversão de fuso)
- [ ] 2. Substituir `matchDateToLocalDate` por `matchDateToUTCDate` na geração de `availableDates` em `app/(dashboard)/jogos/page.tsx` e atualizar o import
