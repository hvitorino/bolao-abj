# Plano de Implementação: Modal de Resumo Diário

**Slug:** daily-recap-modal
**Branch:** feature/daily-recap-modal
**Data:** 2026-06-19
**Spec:** .pipeline/daily-recap-modal-spec.md

## Tarefas

- [ ] 1. Criar hook `useDailyRecap` em `lib/hooks/useDailyRecap.ts` com lógica de BRT, queries Supabase (jogos finalizados ontem, scores e predictions do grupo), cálculo de rankingDay e badges
- [ ] 2. Criar componente `DailyRecapModal` em `components/bolao/DailyRecapModal.tsx` com controle de localStorage, lógica de abertura/fechamento, layout completo (jogos, ranking do dia, destaques) e design DESIGN.md
- [ ] 3. Integrar `DailyRecapModal` no `app/(dashboard)/layout.tsx` passando `activeGroup.id` e `user.id` como props
- [ ] 4. Verificar lint e build
