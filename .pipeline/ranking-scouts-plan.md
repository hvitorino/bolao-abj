# Plano de Implementação: Scouts no Ranking

**Slug:** ranking-scouts
**Branch:** feature/ranking-scouts
**Data:** 2026-06-21
**Spec:** .pipeline/ranking-scouts-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase com função `get_ranking_scouts(p_group_id uuid)` em `supabase/migrations/20260621100000_create_ranking_scouts_function.sql`
- [ ] 2. Atualizar `lib/types/ranking.ts` — adicionar campo `scouts: string[]` à interface `RankingEntry`
- [ ] 3. Atualizar `app/api/ranking/route.ts` — chamar `get_ranking_scouts` em paralelo via `Promise.all`, calcular badges server-side e incluir campo `scouts` no JSON de resposta
- [ ] 4. Criar componente `components/bolao/ScoutBadges.tsx` — renderiza emojis com tooltip nativo (`title`), retorna `null` para array vazio
- [ ] 5. Atualizar `components/bolao/RankingRow.tsx` — inserir `<ScoutBadges>` na célula PARTICIPANTE após nome e sufixo "(VOCÊ)"
