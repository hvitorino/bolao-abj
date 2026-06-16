# Changelog: Correção da Regra "Somente Placar do Perdedor"

**Slug:** fix-loser-score-rule
**Branch:** fix/fix-loser-score-rule
**Data:** 2026-06-16
**Status:** aprovado

---

## O que foi implementado

### Lógica de pontuação (TypeScript)
- `lib/scoring.ts` — o bloco que concede `loser_score_points` (+1, "Somente placar do perdedor") foi movido do branch `else` (quando `predWinner !== realWinner`) para dentro do branch `if (predWinner === realWinner)`, como uma checagem irmã de `winner_score_points`/`diff_points`, avaliada após o cálculo de `diff_points` e dentro do `else` do teste de placar exato. O branch `else` externo (vencedor errado) agora não concede nenhum bônus, mantendo a invariante de que nenhum bônus se aplica quando o vencedor é errado. O comentário de topo do arquivo foi reescrito para descrever a regra nova e suas exclusividades (com `exact_points`, e mutuamente exclusiva por construção aritmética com `winner_score_points`/`diff_points`).

### Banco de Dados
- Migration nova: `supabase/migrations/20260616130000_fix_loser_score_rule.sql` — `CREATE OR REPLACE FUNCTION calculate_scores_for_game`, copiada linha a linha da versão vigente (`20260615120500_group_scoped_scoring_trigger.sql`), com a única mudança real sendo mover a atribuição de `v_loser_pts` para dentro do `IF v_pred_winner = v_real_winner`, ao lado de `v_ws_pts`/`v_diff_pts`, com a condição invertida. Preserva 100% das demais regras (vencedor, exato, placar do vencedor, diferença de gols, goleada) e o scoping por `group_id`.
- A migration inclui, ao final, um bloco `DO $$ ... $$` que percorre todos os jogos `status = 'finished'` e chama `PERFORM calculate_scores_for_game(g.id)`, recalculando retroativamente quaisquer scores gravados pela regra antiga.
- Nenhuma migration já aplicada foi editada. `db/migrations/` não foi tocado (confirmado como espelho desatualizado e opcional pela spec).
- **A migration foi apenas criada — NÃO foi aplicada ao banco de produção.** Aplicação fica fora do escopo desta tarefa, conforme a spec instrui; deve ser feita posteriormente via skill `supabase-migration` quando solicitado explicitamente.

### Frontend
- `CLAUDE.md` — linha da tabela de regras de pontuação alterada para `Somente placar do perdedor (acertou vencedor)`.
- `components/bolao/ScoringRulesTable.tsx` — nota da regra "Somente placar do perdedor" alterada de `'independente de acertar o vencedor'` para `'requer acerto do vencedor'`. `MAX_POINTS = 9` não foi alterado (continua correto, confirmado pela spec).
- `app/(dashboard)/como-pontuar/page.tsx`:
  - `EXEMPLO_5` reescrito por completo: cenário agora é BRA 3×1 ARG, palpite 2×1 ARG → **+4 pts** (breakdown `{winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:0}`), substituindo o cenário antigo que ilustrava a regra invertida (vencedor errado).
  - `EXEMPLO_1` ajustado (palpite alterado de 1×0 para 3×2) para não acionar `loser_score` incidentalmente, continuando a isolar somente "Acerto do vencedor" → **+3 pts** (breakdown inalterado em valor, `{winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:0}`).
  - `EXEMPLO_6` (Goleada, BRA 5×0 MEX, palpite 4×0) teve total e breakdown atualizados para refletir o `loser_score` incidental que a regra nova passa a conceder neste cenário → **+5 pts** (breakdown `{winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:1}`), com nova linha de breakdown e nota atualizada.
  - `EXEMPLO_2`, `EXEMPLO_3`, `EXEMPLO_4` e `EXEMPLO_BONUS_EMPATE` não foram alterados — validados sem mudança de total/breakdown.

### Documentação
- `CHANGELOG.md` — nova entrada `[fix-loser-score-rule]` adicionada (entradas antigas não foram editadas).

---

## Decisões técnicas

- **Comentário sobre `EXEMPLO_6`:** a spec oferecia duas alternativas igualmente aceitáveis — aceitar o "ruído" do `loser_score` incidental (total sobe para 5 pts) ou trocar `predAway` para evitar o ruído (mantendo 4 pts). Optei pela primeira alternativa (aceitar o total 5, com a linha extra de breakdown), pois é a opção com texto/números já totalmente especificados na spec, exigindo menos invenção e mantendo o exemplo fiel ao cenário historicamente usado no arquivo.
- **Linha sobre "Push" em `CLAUDE.md`:** ao editar `CLAUDE.md`, o arquivo já tinha uma linha não relacionada (`**Push**: nenhum agente do pipeline deve executar git push...`) modificada localmente antes do início desta tarefa, fora do escopo desta correção. Como o commit foi feito sobre o arquivo inteiro, essa linha pré-existente acabou incluída no mesmo commit. Não é uma mudança de regra de negócio de pontuação e é inofensiva/correta (já é uma convenção real do projeto), mas registro aqui para transparência caso o Revisor confira o diff linha a linha.
- **Bloco `else` vazio em `lib/scoring.ts`:** o branch externo `else` (quando `predWinner !== realWinner`) ficou vazio, apenas com um comentário explicando que nenhum bônus se aplica (todas as variáveis já inicializadas em 0 no topo da função). Confirmado que isso não gera warning de lint (`npm run lint` limpo).
- **Validação dos exemplos:** seguindo o padrão da feature `exemplos-por-regra`, criei um script ad-hoc temporário em `/tmp/validate-scoring.ts` (fora do repositório), executado via `npx tsx`, que importou `calculateScore` diretamente de `lib/scoring.ts` e validou os 6 exemplos numerados + o exemplo bônus de empate + 1 caso de regressão (vencedor totalmente errado deve zerar todos os bônus, inclusive o antigo `loser_score`). Todos os 8 casos passaram com os valores exatos previstos pela spec. O script foi removido após a validação — não ficou órfão no repositório.

---

## Pontos de atenção para o Revisor

- Confirmar que o branch `else` externo de `calculateScore()` (vencedor errado) realmente zera todos os bônus, incluindo o antigo `loser_score` — este é o coração da correção.
- Confirmar que a migration nova (`20260616130000_fix_loser_score_rule.sql`) é idêntica à versão vigente (`20260615120500_group_scoped_scoring_trigger.sql`) exceto pelo reposicionamento de `v_loser_pts`, incluindo o scoping por `group_id` no `INSERT`/`ON CONFLICT`.
- Confirmar que a migration NÃO foi aplicada ao banco (apenas o arquivo SQL foi criado) — isso é intencional conforme a spec.
- Confirmar que `EXEMPLO_1`, `EXEMPLO_5` e `EXEMPLO_6` em `/como-pontuar` batem com os números recalculados, e que `EXEMPLO_2`, `EXEMPLO_3`, `EXEMPLO_4` e `EXEMPLO_BONUS_EMPATE` permanecem inalterados.
- Confirmar que nenhuma migration já aplicada foi editada (`git diff` nas migrations pré-existentes deve estar vazio).
- `npm run lint` e `npm run build` foram executados nesta sessão e passaram limpos (build gerou todas as 21 rotas, incluindo `/como-pontuar`, sem erros).
- A mudança incidental e pré-existente em `CLAUDE.md` (linha sobre `Push`) não foi introduzida por esta tarefa — já estava no working tree antes do início desta correção (ver seção "Decisões técnicas").

---

## Commits realizados

```
64e72fa docs(changelog): registra correção da regra de placar do perdedor
bb28856 fix(como-pontuar): atualiza exemplos 1, 5 e 6 com a nova regra de placar do perdedor
32b17b5 docs(scoring): atualiza CLAUDE.md e ScoringRulesTable com nova regra de placar do perdedor
d5cd8cb fix(scoring): adiciona migration que corrige calculate_scores_for_game
1c7401d fix(scoring): corrige regra de placar do perdedor para exigir acerto do vencedor
844cc9e chore(fix-loser-score-rule): adiciona plano de implementação
```
