# Changelog: Como Pontuar

**Slug:** como-pontuar
**Branch:** feature/como-pontuar
**Data:** 2026-06-15
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhum endpoint necessário. A feature é inteiramente estática.

### Frontend (Next.js/React)

- `components/bolao/ScoringRulesTable.tsx` — Tabela de pontuação com todos os 6 eventos de pontuação. Header em `color-secondary`, coluna de pontos em `color-accent`, símbolo `►` em `color-primary` para o evento base, linha de máximo possível separada por borda mais espessa. Server Component.

- `components/bolao/ScoringExample.tsx` — Card de exemplo de cálculo de pontuação. Exibe: título da seção, placar real vs palpite do usuário, breakdown linha a linha com `✓`/`✗`, total em `color-accent`. Aceita prop `note` opcional para nota pedagógica. Server Component.

- `app/(dashboard)/como-pontuar/page.tsx` — Página principal. Server Component com metadata. Estrutura: header (COMO PONTUAR + subtítulo), bloco de aviso sobre cumulatividade, `<ScoringRulesTable />`, seção de exemplos com 3 instâncias de `<ScoringExample />`, seção de regras especiais (2 blocos: "Bônus Cumulativos" e "Empate"), rodapé com link de volta para `/jogos`. Grid responsivo: 1 coluna em mobile, 3 colunas em `md+` via `<style>` inline.

- `app/(dashboard)/nav-links.tsx` — Adicionado item `{ href: '/como-pontuar', label: 'REGRAS' }` ao array `NAV_ITEMS`. O comportamento de `isActive` existente cobre a nova rota sem alterações adicionais.

### Banco de Dados

Nenhuma migration necessária. Feature inteiramente estática.

---

## Decisões técnicas

**Máximo possível por jogo (+9, não +14):** A spec menciona "+14" na tabela visual de referência, mas pede explicitamente para verificar `lib/scoring.ts`. Com base no código: quando `exact_points=5`, `winner_score_points` e `diff_points` ficam em 0 (mutuamente exclusivos). O máximo real é `winner(3) + exact(5) + goleada(1) = 9` ou `winner(3) + winner_score(3) + diff(2) + goleada(1) = 9`. Exibido como `+9`.

**Grid responsivo via `<style>` inline:** A página é um Server Component puro. Para aplicar media queries, optou-se por um bloco `<style>` inline com `className` CSS ao invés de `"use client"` só para responsividade. Isso mantém o componente como Server Component sem overhead de JavaScript no cliente.

**Nota pedagógica opcional em `ScoringExample`:** A prop `note` foi adicionada (não está na interface da spec) para permitir notas explicativas nos exemplos sem criar um componente separado. É puramente aditivo e não quebra nenhum critério de aceite.

**Exemplo 2 — `loser_score_points`:** O placar do perdedor no Exemplo 2 (BRA 2×0 MEX, palpite BRA 1×0 MEX) está correto: perdedor = MEX, placar real MEX = 0, palpite MEX = 0 → bate (+1). Total: winner(3) + loser_score(1) = **+4 pts**, conforme spec.

---

## Pontos de atenção para o Revisor

1. **Máximo exibido (+9):** Verificar se está de acordo com a interpretação do `scoring.ts`. A spec é ambígua (menciona +14 como referência visual mas pede para verificar o código).

2. **Grid responsivo via `<style>` inline:** Verificar se esta abordagem é aceitável ou se deve ser migrada para Tailwind classes com `className`.

3. **Proteção de rota:** A rota `/como-pontuar` está dentro do grupo `(dashboard)` e herda o `DashboardLayout` com verificação de autenticação — sem proteção adicional implementada, conforme spec.

4. **Exemplos de breakdown:** Verificar se os breakdowns dos 3 exemplos refletem fielmente as regras do `scoring.ts` (especialmente o Exemplo 3 — empate — onde `diff_points` não aplica mas foi incluído com `hit: false` para clareza pedagógica).

---

## Commits realizados

```
72c73d2 feat(como-pontuar): adiciona link REGRAS na navegação do dashboard
d6f18c4 feat(como-pontuar): cria página /como-pontuar com tabela e exemplos de pontuação
d3a24c5 feat(como-pontuar): cria componente ScoringExample com layout de exemplo de cálculo
d5f59dd feat(como-pontuar): cria componente ScoringRulesTable com tabela de pontuação
2940a21 chore(como-pontuar): adiciona plano de implementação
```
