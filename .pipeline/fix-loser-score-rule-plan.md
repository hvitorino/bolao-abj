# Plano de Implementação: Correção da Regra "Somente Placar do Perdedor"

**Slug:** fix-loser-score-rule
**Branch:** fix/fix-loser-score-rule
**Data:** 2026-06-16
**Spec:** .pipeline/fix-loser-score-rule-spec.md

## Tarefas

- [ ] 1. Corrigir `lib/scoring.ts`: mover o cálculo de `loser_score_points` do branch `else` (predWinner !== realWinner) para dentro do branch `if (predWinner === realWinner)`, ao lado de `winner_score_points`/`diff_points`; reescrever o comentário de topo do arquivo
- [ ] 2. Criar migration nova `supabase/migrations/20260616130000_fix_loser_score_rule.sql` com `CREATE OR REPLACE FUNCTION calculate_scores_for_game` espelhando a versão vigente (`20260615120500_group_scoped_scoring_trigger.sql`), com a condição de `v_loser_pts` corrigida, incluindo bloco de recálculo retroativo para jogos `finished` (sem aplicar a migration ao banco)
- [ ] 3. Atualizar `CLAUDE.md` — linha da tabela de regras de pontuação para `Somente placar do perdedor (acertou vencedor)`
- [ ] 4. Atualizar `components/bolao/ScoringRulesTable.tsx` — nota da regra "Somente placar do perdedor" para `'requer acerto do vencedor'`
- [ ] 5. Validar `calculateScore()` via script ad-hoc (`npx tsx`, não commitado) para todos os EXEMPLO_N e EXEMPLO_BONUS_EMPATE pós-edição de `lib/scoring.ts`
- [ ] 6. Atualizar `app/(dashboard)/como-pontuar/page.tsx`: reescrever EXEMPLO_5 (cenário BRA 3×1 ARG / palpite 2×1), ajustar EXEMPLO_1 (palpite 3×2) e EXEMPLO_6 (breakdown/total com loser_score incidental), com comentários "Confirmado contra calculateScore()" atualizados
- [ ] 7. Adicionar entrada nova em `CHANGELOG.md` descrevendo a correção
- [ ] 8. Rodar `npm run lint` e `npm run build`, confirmar que passam limpos
- [ ] 9. Escrever `.pipeline/fix-loser-score-rule-changelog.md` e fazer commit
- [ ] 10. Invocar o Revisor
