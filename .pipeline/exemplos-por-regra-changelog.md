# Changelog: Exemplo Dedicado por Regra de Pontuação

**Slug:** exemplos-por-regra
**Branch:** feature/exemplos-por-regra
**Data:** 2026-06-16
**Status:** aprovado

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhum endpoint novo ou modificado. Feature inteiramente estática, conforme spec.

### Frontend (Next.js/React)

- `components/bolao/ScoringExample.tsx` — Adicionada prop opcional `ruleLabel?: string` à interface `ScoringExampleProps`. Quando presente, renderiza um rótulo (`REGRA: <texto>`) abaixo do título, em `color-muted`, uppercase, `10px`, `letter-spacing: 0.08em`. Comportamento existente preservado integralmente quando a prop não é passada (nenhum uso anterior é afetado, já que é opcional e o componente só é usado nesta página).

- `app/(dashboard)/como-pontuar/page.tsx` — Substituídas as constantes `EXEMPLO_1`/`EXEMPLO_2`/`EXEMPLO_3` por sete constantes: `EXEMPLO_1` a `EXEMPLO_6` (alinhadas 1:1 com a ordem de `SCORING_RULES` em `ScoringRulesTable.tsx`) e `EXEMPLO_BONUS_EMPATE`. Cada uma das seis primeiras isola sua regra-alvo no breakdown (demais linhas com `hit: false`, exceto "Acertou o vencedor" quando aplicável por cumulatividade) e inclui `ruleLabel` com o texto exato do `event` correspondente da tabela. Layout da seção "EXEMPLOS DE CÁLCULO": frase de transição explicando a numeração, grid com os 6 exemplos numerados, e subseção "EXEMPLO COMPLEMENTAR" abaixo do grid com o exemplo de empate. Bloco "REGRAS ESPECIAIS" mantido sem alterações. Breakpoints do grid ajustados: 1 coluna (`<640px`), 2 colunas (`640px–1023px`), 3 colunas (`≥1024px`).

### Banco de Dados

Nenhuma migration necessária. Feature inteiramente estática.

---

## Decisões técnicas

**Validação programática prévia (obrigatória pela spec):** Antes de hardcodar qualquer breakdown em `page.tsx`, foi criado um script Node ad-hoc (`scripts-tmp-validate-examples.ts`, removido após uso e não incluído nos commits) que importou `calculateScore` de `lib/scoring.ts` e executou os 7 cenários `(game, prediction)` da spec via `npx tsx`. Todos os 7 resultados bateram byte-a-byte com a tabela "Validação obrigatória dos números" da spec:

```
#1 Acerto do vencedor (parcial): points=3  breakdown={"winner":3,"exact":0,"winner_score":0,"diff":0,"loser_score":0,"goleada":0}
#2 Placar exato:                 points=8  breakdown={"winner":3,"exact":5,"winner_score":0,"diff":0,"loser_score":0,"goleada":0}
#3 Somente placar do vencedor:   points=6  breakdown={"winner":3,"exact":0,"winner_score":3,"diff":0,"loser_score":0,"goleada":0}
#4 Diferença de gols correta:    points=5  breakdown={"winner":3,"exact":0,"winner_score":0,"diff":2,"loser_score":0,"goleada":0}
#5 Somente placar do perdedor:   points=1  breakdown={"winner":0,"exact":0,"winner_score":0,"diff":0,"loser_score":1,"goleada":0}
#6 Goleada:                      points=4  breakdown={"winner":3,"exact":0,"winner_score":0,"diff":0,"loser_score":0,"goleada":1}
#7 Empate exato (bônus):         points=8  breakdown={"winner":3,"exact":5,"winner_score":0,"diff":0,"loser_score":0,"goleada":0}
```

Nenhuma divergência encontrada — os breakdowns hardcoded em `page.tsx` refletem exatamente esses resultados.

**Rótulo de vínculo (`ruleLabel`) como prop opcional, não estrutural:** Optou-se por manter `ruleLabel` totalmente opcional na interface (não obrigatório) para não exigir alteração de nenhum outro call site futuro do componente. Hoje `ScoringExample` só é usado nesta página, mas a opção reduz acoplamento.

**Posicionamento do rótulo:** Renderizado entre o título e a linha de placares (sem borda própria), evitando uma nova divisória visual e mantendo a densidade do card consistente com o restante do design (Elifoot-style, sem espaçamento extra desnecessário).

**Exemplo complementar fora do grid principal:** Em vez de inserir o exemplo de empate como 7º item do grid com `grid-column: 1 / -1` (alternativa permitida pela spec), optou-se por renderizá-lo em uma subseção separada com cabeçalho `h3` "EXEMPLO COMPLEMENTAR", abaixo do grid. Essa abordagem deixa mais explícito visualmente que o exemplo de empate está "fora da numeração 1-6", conforme pedido na história de usuário 2 da spec ("identificar visualmente qual exemplo corresponde a qual linha da tabela").

**Breakpoint intermediário (tablet, 2 colunas):** Adicionado conforme sugestão não obrigatória da spec, para evitar cards muito estreitos entre 640px e 1023px com 6 itens no grid (antes só havia 1 coluna até 768px, depois 3 colunas — o que deixaria os cards apertados em tablets retrato).

**Exemplo 5 (placar do perdedor):** Replicado exatamente como especificado — palpite BRA 0x1 ARG (vencedor errado no palpite) vs. jogo real BRA 3x1 ARG (BRA venceu). Isso é o que garante `loser_score_points = 1` calculado no bloco `else` de `calculateScore()` (só executa quando `predWinner !== realWinner`). Este é o cuidado explícito pedido na spec para não repetir o bug histórico do fix-1 de `como-pontuar` (onde um cenário em que o vencedor foi acertado erroneamente exibia `loser_score` como `hit: true`).

**Script de validação não commitado:** O script `scripts-tmp-validate-examples.ts` usado para a validação programática foi deletado após a confirmação dos números — não faz parte da entrega (não é teste permanente do projeto, era apenas uma ferramenta de verificação ad-hoc pedida pela spec). Os resultados ficam documentados nesta seção do changelog para rastreabilidade.

---

## Pontos de atenção para o Revisor

1. **Conferir que os 6 exemplos numerados estão na mesma ordem de `SCORING_RULES`** em `components/bolao/ScoringRulesTable.tsx` (Acerto do vencedor, Placar exato, Somente placar do vencedor, Diferença de gols correta, Somente placar do perdedor, Goleada) — a correspondência 1:1 é o requisito central da spec.

2. **Exemplo 5 é o único com `winner: hit:false` e total não-zero** — vale revisar visualmente se isso fica claro no card renderizado (✗ vermelho/muted em "Acertou o vencedor" e mesmo assim total = 1 pt), conforme pedido explícito da spec.

3. **`ruleLabel` no `ScoringExample.tsx`** — confirmar que a prop é de fato opcional e que nenhum teste/snapshot existente quebrou (projeto não tem testes automatizados para este componente, apenas build/lint).

4. **Grid responsivo** — breakpoints alterados de `768px` (single breakpoint, 1→3 colunas) para `640px` (1→2) e `1024px` (2→3). Vale checar visualmente em 360px, 768px e 1280px conforme critério de aceite, já que não há teste automatizado de layout neste projeto.

5. **Exemplo complementar fora do grid (subseção própria com `h3`)** — a spec permitia tanto essa abordagem quanto incluir como 7º item do grid com `grid-column: 1/-1`. Optei pela subseção separada; revisar se atende ao espírito do critério de aceite "identificado como exemplo complementar/bônus".

6. **Bloco "REGRAS ESPECIAIS"** — não foi alterado, conforme spec (mudança opcional de referenciar o "Exemplo Bônus" não foi aplicada, por não ser obrigatória e para minimizar diff).

7. **`npm run lint` e `npm run build`** rodaram sem erros após as mudanças (saída completa conferida durante a implementação).

---

## Commits realizados

```
1f1a043 feat(exemplos-por-regra): cria 6 exemplos isolados por regra + exemplo bônus de empate
17b57fe feat(exemplos-por-regra): adiciona prop ruleLabel ao componente ScoringExample
8b8b730 chore(exemplos-por-regra): adiciona plano de implementação
```
