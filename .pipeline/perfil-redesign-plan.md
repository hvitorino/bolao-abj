# Plano de Implementação: Redesign da Aba de Perfil

**Slug:** `perfil-redesign`
**Branch:** feature/perfil-redesign
**Data:** 2026-06-21
**Spec:** .pipeline/perfil-redesign-spec.md

## Tarefas

- [ ] 1. Criar migration `20260622000001_create_position_snapshots.sql` — tabela `position_snapshots` com RLS e índice
- [ ] 2. Criar migration `20260622000002_create_snapshot_functions.sql` — função `record_position_snapshots` e trigger `trg_snapshot_on_day_close`
- [ ] 3. Criar migration `20260622000003_create_group_avg_points.sql` — função `get_group_avg_points`
- [ ] 4. Criar migration `20260622000004_create_profile_history.sql` — função `get_profile_history`
- [ ] 5. Implementar Route Handler `GET /api/profile/campaign/route.ts`
- [ ] 6. Implementar Route Handler `GET /api/profile/performance/route.ts`
- [ ] 7. Implementar Route Handler `GET /api/profile/trophies/route.ts`
- [ ] 8. Implementar Route Handler `GET /api/profile/history/route.ts`
- [ ] 9. Criar componente `components/bolao/perfil/CampaignPanel.tsx`
- [ ] 10. Criar componente `components/bolao/perfil/PerformancePanel.tsx`
- [ ] 11. Criar componente `components/bolao/perfil/TrophiesPanel.tsx`
- [ ] 12. Criar componente `components/bolao/perfil/HistoryPanel.tsx`
- [ ] 13. Criar componente orquestrador `components/bolao/perfil/PerfilDashboard.tsx`
- [ ] 14. Atualizar `app/(dashboard)/perfil/page.tsx` para usar `PerfilDashboard` em vez de `ProfileStats`
