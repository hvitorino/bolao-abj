# Plano de Implementação: Pontuação (Scoring)

**Slug:** scoring
**Branch:** feature/scoring
**Data:** 2026-06-13
**Spec:** .pipeline/scoring-spec.md

## Tarefas

- [ ] 1. Criar migration SQL: tabela `scores`, função `calculate_scores_for_game`, trigger `on_game_finished`, RLS policies e índices
- [ ] 2. Criar tipo TypeScript `lib/types/score.ts` (Score, ScoreBreakdown)
- [ ] 3. Criar lib TypeScript `lib/scoring.ts` com lógica de pontuação espelhando o Postgres
- [ ] 4. Criar endpoint Ruby `api/scores/calculate.rb` (POST /api/scores/calculate, admin-only)
- [ ] 5. Criar hook `lib/hooks/useScoreRealtime.ts` com subscription Supabase Realtime para tabela `scores`
- [ ] 6. Criar componente `components/bolao/ScoreDisplay.tsx` com breakdown visual estilo Elifoot
- [ ] 7. Modificar `components/games/GameCard.tsx` para exibir ScoreDisplay quando jogo encerrado
- [ ] 8. Criar página `app/(dashboard)/meus-palpites/page.tsx` com lista de todos os palpites + pontuação
- [ ] 9. Escrever changelog `.pipeline/scoring-changelog.md`
