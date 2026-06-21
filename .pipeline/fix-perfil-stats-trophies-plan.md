# Plano de Implementação: Correção — Estatísticas e Troféus na Aba de Perfil

**Slug:** fix-perfil-stats-trophies
**Branch:** feature/fix-perfil-stats-trophies
**Data:** 2026-06-21
**Spec:** .pipeline/fix-perfil-stats-trophies-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase `20260622000005_fix_profile_stats_active_denominator.sql` adicionando campo `active_predictions_made` à função `get_profile_stats`
- [ ] 2. Corrigir `app/api/profile/performance/route.ts` — extrair `active_predictions_made`, usar como denominador de `winner_rate`, `exact_rate` e `avg_points`, e incluir no JSON de resposta
- [ ] 3. Corrigir `app/api/profile/stats/route.ts` — mesma correção de denominador com `active_predictions_made`
- [ ] 4. Atualizar interface `PerformanceData` e lógica do `PerformancePanel.tsx` — adicionar campo `active_predictions_made`, usar na condição `hasData` e nas frações exibidas
- [ ] 5. Refatorar `TrophiesPanel.tsx` — remover `expandedId`, `toggle`, separação em listas, grid 2 colunas e `TrophyRow`; implementar grid vertical único com descrição sempre visível e troféus `secret` tratados como `locked`
