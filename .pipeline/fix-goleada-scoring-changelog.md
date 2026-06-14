# Changelog: Correção da Regra de Goleada na Pontuação

**Slug:** fix-goleada-scoring
**Branch:** feature/fix-goleada-scoring
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (TypeScript)
- `lib/scoring.ts` — Corrigido o bloco da Regra 6 (goleada). A lógica anterior verificava apenas se o vencedor real fez `>= 3 gols`. A lógica correta verifica três condições simultâneas: acertou o vencedor (garantido pelo bloco pai), o vencedor no **palpite** marcou `>= 4 gols`, e a diferença de gols no resultado real é `>= 4`. Comentário de cabeçalho atualizado para refletir a nova definição.

### Banco de Dados
- Migration `supabase/migrations/20260614000003_fix_goleada_scoring.sql` — Recria a função `calculate_scores_for_game` via `CREATE OR REPLACE FUNCTION` com a condição corrigida: `v_pred_winner_score >= 4 AND v_real_diff >= 4`. Introduz a variável `v_pred_winner_score` para capturar os gols do vencedor no palpite (não no resultado real).

### Documentação
- `CLAUDE.md` — Tabela de pontuação atualizada: linha da goleada agora descreve a regra correta (acertou vencedor, vencedor no palpite fez 4+ gols e diferença real >= 4 gols).

---

## Decisões técnicas

- A variável `v_pred_winner_score` foi adicionada à função Postgres para capturar os gols do vencedor **no palpite**, não no resultado real. Isso é necessário porque a condição de goleada avalia tanto o palpite quanto o resultado.
- No TypeScript, `predWinnerScore` é derivado de `prediction.home_score` ou `prediction.away_score` dependendo de quem o `realWinner` é — isso mantém simetria exata com a implementação Postgres.
- O bloco goleada em TypeScript é colocado fora do `if/else` de placar exato (assim como estava antes), pois o bônus é cumulativo e pode combinar com exact, winner_score e diff.
- O arquivo `api/scores/calculate.rb` não foi modificado conforme especificado na spec — ele apenas faz RPC para a função Postgres e não contém lógica de pontuação própria.

---

## Pontos de atenção para o Revisor

- Verificar que os casos de teste da spec foram todos cobertos pela nova lógica:
  - 7×1, palpite 3×0 → goleada=0 (pred_winner_score=3 < 4)
  - 7×1, palpite 4×0 → goleada=1
  - 3×0, palpite 4×0 → goleada=0 (real_diff=3 < 4)
  - 4×0, palpite 4×0 → goleada=1
  - 2×2, palpite qualquer → goleada=0 (realWinner='draw')
- Confirmar que nenhuma outra regra de pontuação foi tocada (winner, exact, winner_score, diff, loser_score).
- Confirmar alinhamento lógico exato entre TypeScript e Postgres.

---

## Commits realizados

```
a5132cd docs(fix-goleada-scoring): atualiza CLAUDE.md com nova definição da regra de goleada (>= 4)
c1a65d8 fix(fix-goleada-scoring): adiciona migration SQL com calculate_scores_for_game corrigido para goleada >= 4
13e263c fix(fix-goleada-scoring): corrige regra de goleada em lib/scoring.ts para predWinnerScore >= 4 e realGoalDiff >= 4
51d8575 chore(fix-goleada-scoring): adiciona plano de implementação
```
