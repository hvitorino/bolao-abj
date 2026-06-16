# Spec: Exemplo Dedicado por Regra de Pontuação

**Slug:** exemplos-por-regra
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Na página `/como-pontuar`, garantir que cada uma das 6 regras listadas na `ScoringRulesTable` tenha um exemplo de cálculo concreto e isolado demonstrando especificamente aquela regra — substituindo o conjunto atual de 3 exemplos (que cobre só 2 das 6 regras de forma isolada: "acerto do vencedor" e "placar exato") por um conjunto de 7 exemplos: 6 exemplos numerados 1-6, alinhados 1:1 com a ordem das linhas da tabela, mais 1 exemplo bônus de empate exato (já existente, reaproveitado) demonstrando que a regra de placar exato também se aplica em caso de empate.

Cada exemplo deve isolar sua regra: as demais linhas do breakdown daquele exemplo devem aparecer como "não atingidas" (`hit: false`, +0), exceto quando a cumulatividade documentada exigir mostrar duas regras juntas (caso do "acerto do vencedor", que é base obrigatória e aparece com +3 em todos os exemplos onde o vencedor foi acertado).

---

## Histórias de Usuário

- Como participante do bolão, quero ver um exemplo de cálculo isolado para cada linha da tabela de pontuação, para entender exatamente quando cada bônus se aplica sem precisar inferir a partir de exemplos compostos.
- Como participante do bolão, quero identificar visualmente qual exemplo corresponde a qual linha da tabela, para não ter que adivinhar a relação entre as duas seções da página.
- Como participante do bolão, quero continuar vendo o exemplo de empate exato e a explicação de cumulatividade, para não perder informação que já era útil na versão anterior da página.

---

## Modelo de Dados

Não há alteração de modelo de dados. Esta feature é inteiramente estática (conteúdo de página + componentes de apresentação), sem novas tabelas, colunas, migrations, RLS, ou endpoints.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. Feature inteiramente estática no frontend, igual à feature `como-pontuar` original.

---

## Validação obrigatória dos números (antes de codificar)

Todos os 7 cenários abaixo foram validados programaticamente replicando fielmente a lógica de `calculateScore()` em `/Users/hamonvitorino/workspace/bolao-abj/lib/scoring.ts` (mesmas condições, mesma ordem de avaliação). O Programador **deve** importar e chamar a função real `calculateScore` de `lib/scoring.ts` (ex: em um teste unitário, ou em um script Node ad-hoc rodado durante o desenvolvimento) para confirmar que os números abaixo batem byte-a-byte antes de hardcodar os breakdowns no `page.tsx`. Não confiar apenas nesta spec ou em cálculo manual — `lib/scoring.ts` é a fonte da verdade.

Resumo dos resultados confirmados (ver tabela completa na seção "Os 7 Exemplos"):

| # | Cenário | game | prediction | points | breakdown |
|---|---------|------|------------|--------|-----------|
| 1 | Acerto do vencedor (parcial) | 2x0 | 1x0 | 3 | `{winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:0}` |
| 2 | Placar exato | 3x1 | 3x1 | 8 | `{winner:3, exact:5, winner_score:0, diff:0, loser_score:0, goleada:0}` |
| 3 | Somente placar do vencedor | 2x0 | 2x1 | 6 | `{winner:3, exact:0, winner_score:3, diff:0, loser_score:0, goleada:0}` |
| 4 | Diferença de gols correta | 2x0 | 3x1 | 5 | `{winner:3, exact:0, winner_score:0, diff:2, loser_score:0, goleada:0}` |
| 5 | Somente placar do perdedor | 3x1 | 0x1 | 1 | `{winner:0, exact:0, winner_score:0, diff:0, loser_score:1, goleada:0}` |
| 6 | Goleada | 5x0 | 4x0 | 4 | `{winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:1}` |
| 7 (bônus) | Empate exato | 1x1 | 1x1 | 8 | `{winner:3, exact:5, winner_score:0, diff:0, loser_score:0, goleada:0}` |

---

## Os 7 Exemplos (especificação completa)

Cada exemplo é uma instância de `ScoringExample` (componente existente, com ajuste de props — ver seção "Frontend"). Times fictícios usados apenas para ilustração (consistente com o estilo já usado na página: BRA, ARG, MEX, ALE, FRA — códigos de 3 letras).

### Exemplo 1 — Regra 1: Acerto do vencedor

- **Título:** `EXEMPLO 1 — ACERTO DO VENCEDOR`
- **Jogo real:** BRA 2 x 0 MEX
- **Palpite:** BRA 1 x 0 MEX
- **Breakdown:**
  - Acertou o vencedor → `+3` (`hit: true`)
  - Placar exato → `+0` (`hit: false`)
  - Somente placar do vencedor → `+0` (`hit: false`)
  - Diferença de gols correta → `+0` (`hit: false`)
- **Total: 3 pontos**
- **Nota:** "Acertou que o BRA venceria, mas errou a diferença de gols (real=2, palpite=1) e o placar do vencedor (real=2, palpite=1). Nenhum bônus adicional se aplica."
- Equivale ao `EXEMPLO_2` atual — pode ser reaproveitado quase integralmente, apenas renomeando o título para `EXEMPLO 1 — ACERTO DO VENCEDOR` e simplificando a nota.

### Exemplo 2 — Regra 2: Placar exato

- **Título:** `EXEMPLO 2 — PLACAR EXATO`
- **Jogo real:** BRA 3 x 1 ARG
- **Palpite:** BRA 3 x 1 ARG
- **Breakdown:**
  - Acertou o vencedor → `+3` (`hit: true`)
  - Placar exato → `+5` (`hit: true`)
  - Diferença de gols → `+0` (`hit: false`) — nota explicando exclusão mútua
- **Total: 8 pontos**
- **Nota:** "Placar exato engloba 'placar do vencedor' e 'diferença de gols' — não são cumulativos com o placar exato."
- Equivale ao `EXEMPLO_1` atual — reaproveitar integralmente, apenas renumerando o título para `EXEMPLO 2 — PLACAR EXATO`.

### Exemplo 3 — Regra 3: Somente placar do vencedor

- **Título:** `EXEMPLO 3 — SOMENTE PLACAR DO VENCEDOR`
- **Jogo real:** BRA 2 x 0 MEX
- **Palpite:** BRA 2 x 1 MEX
- **Breakdown:**
  - Acertou o vencedor → `+3` (`hit: true`)
  - Placar exato → `+0` (`hit: false`)
  - Somente placar do vencedor → `+3` (`hit: true`)
  - Diferença de gols correta → `+0` (`hit: false`)
- **Total: 6 pontos**
- **Nota:** "Acertou o placar do BRA (vencedor, 2 gols), mas errou o placar do MEX (palpite 1, real 0) — não é placar exato. Diferença real é 2, palpite é 1 — não bate, então o bônus de diferença de gols não se aplica."
- **Novo exemplo** (não existe hoje).

### Exemplo 4 — Regra 4: Diferença de gols correta

- **Título:** `EXEMPLO 4 — DIFERENÇA DE GOLS CORRETA`
- **Jogo real:** BRA 2 x 0 MEX
- **Palpite:** BRA 3 x 1 MEX
- **Breakdown:**
  - Acertou o vencedor → `+3` (`hit: true`)
  - Placar exato → `+0` (`hit: false`)
  - Somente placar do vencedor → `+0` (`hit: false`)
  - Diferença de gols correta → `+2` (`hit: true`)
- **Total: 5 pontos**
- **Nota:** "Diferença real e do palpite são iguais (2 gols), mas nenhum dos dois placares individuais bateu exatamente (BRA: palpite 3 ≠ real 2; MEX: palpite 1 ≠ real 0). Ainda assim, acertar a diferença com o vencedor certo garante o bônus de +2."
- **Novo exemplo** (não existe hoje).

### Exemplo 5 — Regra 5: Somente placar do perdedor

- **Título:** `EXEMPLO 5 — SOMENTE PLACAR DO PERDEDOR`
- **Jogo real:** BRA 3 x 1 ARG (BRA venceu; ARG perdeu fazendo 1 gol)
- **Palpite:** BRA 0 x 1 ARG (palpite aponta ARG como vencedor — errou o vencedor)
- **Breakdown:**
  - Acertou o vencedor → `+0` (`hit: false`) — "Palpite indicava vitória do ARG; o BRA venceu."
  - Somente placar do perdedor → `+1` (`hit: true`)
- **Total: 1 ponto**
- **Nota:** "Mesmo errando completamente o vencedor (palpite indicava ARG vencendo, mas o BRA venceu), o placar do time que de fato perdeu (ARG, 1 gol) foi acertado. Esse bônus é o único que não exige acertar o vencedor — é avaliado de forma independente."
- **Novo exemplo** (não existe hoje). Importante: este é o único exemplo do conjunto onde `winner_points = 0` — deve deixar visualmente claro que o "acerto do vencedor" falhou (✗ em vermelho/muted) e mesmo assim o total não é zero, para reforçar que a regra 5 é avaliada independentemente do acerto do vencedor.

### Exemplo 6 — Regra 6: Goleada

- **Título:** `EXEMPLO 6 — GOLEADA`
- **Jogo real:** BRA 5 x 0 MEX (diferença real = 5, ≥ 4)
- **Palpite:** BRA 4 x 0 MEX (vencedor do palpite fez 4 gols, ≥ 4)
- **Breakdown:**
  - Acertou o vencedor → `+3` (`hit: true`)
  - Placar exato → `+0` (`hit: false`) — palpite não é exato (real é 5x0, palpite é 4x0)
  - Somente placar do vencedor → `+0` (`hit: false`) — placar do vencedor no palpite (4) ≠ real (5)
  - Diferença de gols correta → `+0` (`hit: false`) — diferença real=5, palpite=4, não bate
  - Goleada → `+1` (`hit: true`)
- **Total: 4 pontos**
- **Nota:** "Goleada é cumulativa com o acerto do vencedor e independente de acertar o placar exato ou a diferença: basta o vencedor do palpite ter feito 4+ gols (palpite: BRA fez 4) E a diferença real do jogo ter sido de 4+ gols (real: 5−0=5)."
- **Novo exemplo** (não existe hoje).

### Exemplo 7 (bônus) — Empate exato (reforço da Regra 1 + Regra 2 em contexto de empate)

- **Título:** `EXEMPLO BÔNUS — EMPATE EXATO`
- **Jogo real:** ALE 1 x 1 FRA
- **Palpite:** ALE 1 x 1 FRA
- **Breakdown:**
  - Acertou o empate (= vencedor) → `+3` (`hit: true`)
  - Placar exato no empate → `+5` (`hit: true`)
  - Diferença de gols → `+0` (`hit: false`)
- **Total: 8 pontos**
- **Nota:** "Empate conta como acerto do vencedor. Placar exato no empate aplica +5 normalmente — não há regras especiais de 'placar do vencedor/perdedor' ou 'diferença de gols' em empates, pois não existe vencedor/perdedor definido."
- Equivale ao `EXEMPLO_3` atual — reaproveitar integralmente, apenas com novo título de seção (ver layout abaixo) marcando-o como complementar, fora da numeração 1-6.

---

## Frontend — Componentes React

### `ScoringExample` (modificação)

**Arquivo:** `components/bolao/ScoringExample.tsx`

**Props (interface atualizada):**

```typescript
interface BreakdownItem {
  label: string
  points: number
  hit: boolean
}

interface ScoringExampleProps {
  title: string
  ruleLabel?: string        // NOVO — opcional. Texto do rótulo de vínculo com a tabela, ex: "REGRA: SOMENTE PLACAR DO VENCEDOR"
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  predHome: number
  predAway: number
  breakdown: BreakdownItem[]
  total: number
  note?: string
}
```

**Mudança de comportamento:**
- Nova prop opcional `ruleLabel`. Quando presente, renderizar um pequeno rótulo abaixo do título (`title`), antes da linha de placares, com o texto do `ruleLabel` em `color-muted`, uppercase, `font-size: 10px`, `letter-spacing: 0.08em`, prefixado por `"REGRA: "` ou já contendo o texto completo (decisão do Programador — usar o texto exato do `event` da linha correspondente em `ScoringRulesTable`, ex: `"Somente placar do vencedor"`, para garantir vínculo textual exato).
- Não quebrar nenhum uso existente: `ruleLabel` é opcional, componentes que não passarem essa prop continuam renderizando exatamente como antes.
- Manter todo o restante do componente (placares, breakdown, total, note) sem alterações estruturais.

### `page.tsx` (modificação)

**Arquivo:** `app/(dashboard)/como-pontuar/page.tsx`

**Mudanças:**

1. Substituir as constantes `EXEMPLO_1`, `EXEMPLO_2`, `EXEMPLO_3` por `EXEMPLO_1` a `EXEMPLO_6` (alinhados 1:1 com a ordem de `SCORING_RULES` em `ScoringRulesTable.tsx`) mais `EXEMPLO_BONUS_EMPATE`, conforme especificado na seção "Os 7 Exemplos" acima. Cada constante deve incluir a prop `ruleLabel` com o texto exato do `event` correspondente da tabela:
   - `EXEMPLO_1.ruleLabel = 'Acerto do vencedor'`
   - `EXEMPLO_2.ruleLabel = 'Placar exato'`
   - `EXEMPLO_3.ruleLabel = 'Somente placar do vencedor'`
   - `EXEMPLO_4.ruleLabel = 'Diferença de gols correta'`
   - `EXEMPLO_5.ruleLabel = 'Somente placar do perdedor'`
   - `EXEMPLO_6.ruleLabel = 'Goleada'`
   - `EXEMPLO_BONUS_EMPATE` não precisa de `ruleLabel` obrigatoriamente (ou pode usar `'Placar exato (empate)'`), já que é um exemplo complementar fora da numeração 1-6.

2. Os títulos devem ser renumerados para refletir o vínculo direto com a ordem da tabela: `EXEMPLO 1 — ACERTO DO VENCEDOR`, `EXEMPLO 2 — PLACAR EXATO`, `EXEMPLO 3 — SOMENTE PLACAR DO VENCEDOR`, `EXEMPLO 4 — DIFERENÇA DE GOLS CORRETA`, `EXEMPLO 5 — SOMENTE PLACAR DO PERDEDOR`, `EXEMPLO 6 — GOLEADA`, `EXEMPLO BÔNUS — EMPATE EXATO`.

3. Layout da seção "EXEMPLOS DE CÁLCULO":
   - Renderizar os 6 exemplos numerados em um grid (reaproveitar o grid `scoring-examples-grid` já existente: 1 coluna em mobile, ajustar para `repeat(2, 1fr)` ou `repeat(3, 1fr)` em `md+` — ver detalhe de responsividade abaixo).
   - Renderizar o exemplo bônus (empate) **abaixo** do grid principal, em uma subseção separada com um pequeno cabeçalho `h3` dizendo `EXEMPLO COMPLEMENTAR` (ou incluí-lo no mesmo grid como 7º item — decisão do Programador, desde que o vínculo "bônus/complementar, fora da numeração 1-6" fique visualmente claro, por exemplo ocupando largura total via `grid-column: 1 / -1` quando estiver no mesmo grid).
   - **Responsividade:** com 6 itens (em vez de 3), `repeat(3, 1fr)` em desktop deixa 2 linhas de 3 colunas — manter. Em tablet (`640px–1023px`), considerar `repeat(2, 1fr)` para evitar cards muito estreitos. Em mobile (`<640px`), manter 1 coluna. Ajustar o bloco `<style>` inline existente para incluir um breakpoint intermediário se o Programador julgar necessário; não é obrigatório, mas o layout não deve quebrar (texto cortado, overflow horizontal) em nenhuma largura comum (360px, 768px, 1280px).

4. Adicionar uma frase de transição no cabeçalho da seção "EXEMPLOS DE CÁLCULO" explicando a numeração, ex:
   ```
   Cada exemplo abaixo corresponde, na mesma ordem, a uma linha da tabela de pontuação.
   ```
   Estilo: `font-size: 12px`, `color: var(--color-muted)`, abaixo do `h2` "EXEMPLOS DE CÁLCULO" existente.

5. O bloco "REGRAS ESPECIAIS" (cumulatividade + empate) ao final da página permanece sem alterações — já documenta cumulatividade e empate de forma textual, não há regressão a corrigir ali. Opcionalmente, o Programador pode adicionar uma frase curta referenciando o "Exemplo Bônus" para reforçar o vínculo, mas isso não é obrigatório.

**Estados:** página estática, sem loading/error/empty — não há fetch de dados.

**Supabase Realtime:** não aplicável — conteúdo inteiramente estático.

---

## Regras de Negócio

Não há lógica de negócio nova. Esta feature é puramente de conteúdo/apresentação. A única "regra" a observar rigorosamente é: **todos os breakdowns exibidos devem corresponder exatamente à saída de `calculateScore()` em `lib/scoring.ts`** para os pares `(game, prediction)` especificados. Ver seção "Validação obrigatória dos números" acima — o Programador deve confirmar isso programaticamente (não apenas visualmente) antes de finalizar a implementação, por exemplo escrevendo um teste temporário ou script Node que importe `calculateScore` e compare o resultado com os breakdowns hardcoded no `page.tsx`.

Pontos de atenção replicando o histórico de bug already conhecido (`como-pontuar-changelog.md`, fix-1): a função `loser_score_points` só é computada quando `predWinner !== realWinner` (bloco `else` em `calculateScore`). No Exemplo 5 desta spec, isso é satisfeito propositalmente (palpite aponta ARG vencendo, jogo real teve BRA vencendo) — não simplificar o cenário para algo onde o vencedor é acertado, pois isso zeraria `loser_score_points` e invalidaria o exemplo.

---

## Proteção de Rotas

Sem alteração. A rota `/como-pontuar` já está dentro do grupo `(dashboard)` e herda a proteção de autenticação do `DashboardLayout` existente — nenhuma mudança necessária nesta feature.

---

## Integração Supabase Realtime

Não aplicável. Conteúdo inteiramente estático, sem leitura de tabelas do banco.

---

## Critérios de Aceite

- [ ] A página `/como-pontuar` exibe exatamente 6 exemplos numerados (1 a 6) cujo `ruleLabel`/título corresponde, na mesma ordem, às 6 linhas de `SCORING_RULES` em `ScoringRulesTable.tsx`
- [ ] Cada um dos 6 exemplos isola sua regra correspondente: o breakdown exibido mostra a regra-alvo com `hit: true` e demais regras competidoras/relacionadas com `hit: false`, exceto a base "Acertou o vencedor" quando aplicável por cumulatividade
- [ ] Exemplo 3 (Somente placar do vencedor): jogo BRA 2x0 MEX, palpite BRA 2x1 MEX, total = 6 pontos, breakdown `{winner:3, winner_score:3}`
- [ ] Exemplo 4 (Diferença de gols correta): jogo BRA 2x0 MEX, palpite BRA 3x1 MEX, total = 5 pontos, breakdown `{winner:3, diff:2}`
- [ ] Exemplo 5 (Somente placar do perdedor): jogo BRA 3x1 ARG, palpite BRA 0x1 ARG (vencedor errado), total = 1 ponto, breakdown `{loser_score:1}`, com `winner: hit:false` visível
- [ ] Exemplo 6 (Goleada): jogo BRA 5x0 MEX, palpite BRA 4x0 MEX, total = 4 pontos, breakdown `{winner:3, goleada:1}`
- [ ] O exemplo de empate exato (ALE 1x1 FRA) continua presente na página, identificado como exemplo complementar/bônus, com total = 8 pontos
- [ ] O exemplo de placar exato (BRA 3x1 ARG) continua presente, mapeado como Exemplo 2, com total = 8 pontos
- [ ] O exemplo de acerto parcial do vencedor (BRA 2x0 MEX, palpite 1x0) continua presente, mapeado como Exemplo 1, com total = 3 pontos
- [ ] Todos os 7 breakdowns exibidos foram conferidos programaticamente contra `calculateScore()` de `lib/scoring.ts` (não apenas calculados manualmente) antes da entrega
- [ ] Cada card de exemplo exibe um rótulo de vínculo com a regra da tabela (via nova prop `ruleLabel` em `ScoringExample`, ou mecanismo equivalente) tornando óbvia a correspondência exemplo ↔ linha da tabela
- [ ] A seção "EXEMPLOS DE CÁLCULO" inclui uma frase explicando que a numeração dos exemplos segue a ordem da tabela
- [ ] Bloco "REGRAS ESPECIAIS" (cumulatividade, empate) permanece presente e sem regressão de conteúdo
- [ ] Nenhuma quebra de layout (overflow horizontal, texto cortado) em mobile (360px), tablet (768px) e desktop (1280px)
- [ ] Design segue DESIGN.md: fonte monospace, paleta verde/amarelo/azul (`color-primary`, `color-accent`, `color-secondary`), bordas simples `1px solid var(--color-border)`, sem ícones decorativos além do `►`/`✓`/`✗` já usados, sem sombras
- [ ] Build/lint do projeto passa sem erros novos (`npm run build` ou equivalente) após as mudanças em `page.tsx` e `ScoringExample.tsx`
