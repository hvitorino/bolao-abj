# Plano de Implementação: Correção da Regra de Goleada na Pontuação

**Slug:** fix-goleada-scoring
**Branch:** feature/fix-goleada-scoring
**Data:** 2026-06-14
**Spec:** .pipeline/fix-goleada-scoring-spec.md

## Tarefas

- [ ] 1. Corrigir o bloco de goleada em `lib/scoring.ts` (TypeScript) para usar `predWinnerScore >= 4 && realGoalDiff >= 4`
- [ ] 2. Atualizar o comentário de cabeçalho em `lib/scoring.ts` para descrever a regra correta
- [ ] 3. Criar migration `supabase/migrations/20260614000003_fix_goleada_scoring.sql` com a função Postgres corrigida
- [ ] 4. Atualizar `CLAUDE.md` com a nova definição da regra de goleada
