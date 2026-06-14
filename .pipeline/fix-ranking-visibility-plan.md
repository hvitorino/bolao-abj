# Plano de Implementação: Correção — Visibilidade no Ranking

**Slug:** fix-ranking-visibility
**Branch:** feature/fix-ranking-visibility
**Data:** 2026-06-14
**Spec:** .pipeline/fix-ranking-visibility-spec.md

## Tarefas

- [ ] 1. Criar migration `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` com LEFT JOIN e COALESCE para incluir todos os perfis cadastrados no ranking
- [ ] 2. Corrigir `RankingTable.tsx` — passar `isLeader={entry.rank_position === 1 && entry.total_points > 0}` para `RankingRow` em vez de apenas `entry.rank_position === 1`
- [ ] 3. Verificar e documentar resultados das queries de diagnóstico no changelog (estado real da base de dados)
