# Plano de Implementação: Exemplo Dedicado por Regra de Pontuação

**Slug:** exemplos-por-regra
**Branch:** feature/exemplos-por-regra
**Data:** 2026-06-16
**Spec:** .pipeline/exemplos-por-regra-spec.md

## Tarefas

- [ ] 1. Validar programaticamente os 7 cenários de `(game, prediction)` contra `calculateScore()` de `lib/scoring.ts` (script Node ad-hoc descartável), confirmando que os breakdowns/totais batem byte-a-byte com a tabela da spec antes de hardcodar qualquer coisa em `page.tsx`.
- [ ] 2. Adicionar a prop opcional `ruleLabel` à interface `ScoringExampleProps` em `components/bolao/ScoringExample.tsx` e renderizar o rótulo (uppercase, `color-muted`, `10px`, `letter-spacing: 0.08em`) abaixo do título quando presente, sem alterar o comportamento existente quando ausente.
- [ ] 3. Reescrever as constantes de exemplo em `app/(dashboard)/como-pontuar/page.tsx`: substituir `EXEMPLO_1`/`EXEMPLO_2`/`EXEMPLO_3` por `EXEMPLO_1` a `EXEMPLO_6` (1:1 com `SCORING_RULES`) mais `EXEMPLO_BONUS_EMPATE`, cada um com `ruleLabel`, título renumerado, breakdown isolado e nota pedagógica, conforme valores validados na tarefa 1.
- [ ] 4. Atualizar o layout da seção "EXEMPLOS DE CÁLCULO": grid dos 6 exemplos numerados + subseção "EXEMPLO COMPLEMENTAR" para o exemplo de empate, frase de transição explicando a numeração, e ajuste de breakpoints (mobile 1 col / tablet 2 col / desktop 3 col) garantindo não quebrar em 360px/768px/1280px.
- [ ] 5. Revisão visual e de build: checar manualmente os 7 cards renderizados (rótulos, breakdowns, notas), rodar lint/build do projeto e confirmar que não há regressão no bloco "REGRAS ESPECIAIS".
- [ ] 6. Escrever `.pipeline/exemplos-por-regra-changelog.md` e commitar.
