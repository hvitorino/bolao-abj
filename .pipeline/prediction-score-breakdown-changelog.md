# Changelog: Detalhamento da Pontuação no Palpite

**Slug:** prediction-score-breakdown
**Branch:** feature/prediction-score-breakdown
**Data:** 2026-06-16
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhuma mudança. Conforme a spec, esta feature é puramente de propagação/apresentação de um dado já buscado pelo Server Component; nenhum endpoint em `api/` foi tocado.

### Frontend (Next.js/React)

- `lib/types/participant.ts` — adicionado o campo `breakdown: ScoreBreakdown | null` à interface `ParticipantEntry`, importando `ScoreBreakdown` de `lib/types/score.ts`.
- `app/(dashboard)/jogos/page.tsx`:
  - `scoreByUserGame` passou de `Record<string, number>` (apenas `points`) para `Record<string, { points: number; breakdown: ScoreBreakdown }>`, indexando ambos os campos a partir do mesmo registro de `scores` já buscado na query existente (`select('*')`, nenhuma query nova).
  - Ao montar `participantsByGameId`, `breakdown` agora é propagado junto de `points` (`scoreEntry?.breakdown ?? null`), seguindo a mesma condição de nulidade já usada para `points` (sem palpite ou sem score calculado → `null`).
- `components/bolao/PredictionBreakdown.tsx` (novo) — componente de apresentação pura que recebe `points: number` e `breakdown: ScoreBreakdown` já resolvidos e renderiza a lista de componentes de pontuação com `pts > 0` (rótulo de `BREAKDOWN_LABELS` + valor `+N`), uma linha de `TOTAL`, ou o estado zero `✗ SEM PONTOS NESTE PALPITE` quando nenhum componente pontuou. Nenhuma lógica de cálculo (`calculateScore`/`calculateLiveScore`) é importada ou chamada neste arquivo.
- `components/bolao/GameParticipantsList.tsx`:
  - Adicionado `'use client'` no topo do arquivo (passa a usar `useState`).
  - Novo estado local `expandedUserId: string | null`, inicializado em `null` a cada montagem — accordion exclusivo: no máximo uma linha de participante expandida por vez dentro da lista de um jogo.
  - Cada `<tr>` de participante agora é envolvida em um `Fragment` (importado de `react`), permitindo renderizar uma segunda `<tr>` condicional (a linha de breakdown) imediatamente após a linha do participante, sem quebrar a estrutura de `<table>/<tbody>`.
  - Uma linha é elegível para expansão (`isExpandable`) somente quando `p.prediction !== null && p.breakdown !== null`. Linhas elegíveis recebem `onClick`, `onKeyDown` (trata `Enter` e `Espaço`), `role="button"`, `tabIndex={0}`, `aria-expanded` e `cursor: pointer`. Linhas não elegíveis permanecem exatamente como antes (nenhum atributo novo).
  - Indicador visual `▾`/`▴` adicionado ao final do nome do participante, somente em linhas elegíveis, via `<span>` em `color-muted`, `fontSize: 9px`, dentro de um `<div style={{ display: 'flex', justifyContent: 'space-between' }}>` que substitui o texto solto que existia antes na célula PARTICIPANTE (mesmo comportamento de truncamento com `ellipsis` preservado, agora aplicado ao `<span>` do nome em vez de à célula inteira, para o indicador não ser cortado).
  - Quando uma linha está expandida, renderiza uma `<tr>` adicional com `<td colSpan={columnCount}>` contendo `<PredictionBreakdown points={p.points} breakdown={p.breakdown} />`. `columnCount` é calculado a partir das mesmas variáveis `showPoints`/`showLivePoints` já usadas no `<thead>` (2 ou 3), evitando uma constante separada que pudesse dessincronizar.

### Banco de Dados

Nenhuma migration. Nenhuma policy RLS nova ou modificada — a feature lê um campo (`breakdown`) que já estava sendo retornado pela query `scores.select('*')` existente, apenas descartado antes de chegar ao client.

---

## Decisões técnicas

1. **Correção de tipo não prevista na spec — `breakdownItems` em `PredictionBreakdown.tsx`:** o trecho de código sugerido literalmente na spec (array literal anotado como `Array<{ key: keyof ScoreBreakdown; ... }>` seguido de `.filter(...)`) falhou o type-check do Next.js (`next build`) porque o TypeScript inferiu `key` como `string` widened no array literal antes de unificar com a anotação de tipo da variável, e essa inferência não é compatível com `keyof ScoreBreakdown` em seguida. Resolvido extraindo um `type BreakdownItem = { key: keyof ScoreBreakdown; label: string; pts: number }`, declarando `allItems: BreakdownItem[]` primeiro e só então aplicando `.filter()` em uma variável separada (`breakdownItems`). Nenhuma mudança de comportamento — apenas reorganização para satisfazer o compilador. `ScoreDisplay.tsx` (componente de referência citado na spec) não tem esse problema porque lá os itens não carregam o campo `key` (só `label`/`pts`), então não há colisão de tipo.
2. **Wrapper `<div>` na célula PARTICIPANTE:** para posicionar o indicador `▾`/`▴` à direita do nome sem alterar o comportamento de truncamento (`text-overflow: ellipsis`) que já existia na célula inteira, o truncamento foi movido para um `<span>` interno dedicado ao nome, dentro de um `<div style={{ display: 'flex', justifyContent: 'space-between' }}>`. Isso evita que o indicador seja cortado junto com o nome em participantes com nomes longos.
3. **Borda inferior na linha de breakdown expandida:** a spec não especifica explicitamente uma borda na `<td colSpan>` da linha de breakdown. Foi adicionado `borderBottom: '1px solid var(--color-border)'` nessa célula para manter a separação visual consistente com as demais linhas da tabela (sem isso, a transição entre a linha de breakdown e a próxima linha de participante ficaria sem separador). Não há `box-shadow` nem borda externa arredondada — consistente com DESIGN.md.

---

## Pontos de atenção para o Revisor

- Confirmar que a UI do toggle de linha está de acordo com a spec: clique simples alterna (abre/fecha), clique em linha diferente fecha a anterior e abre a nova (accordion exclusivo), `Enter`/`Espaço` replicam o clique, `aria-expanded` reflete o estado.
- Confirmar que linhas sem `prediction` ou sem `breakdown` (jogos `pending`/`live`, ou `finished` sem trigger disparado, ou participante sem palpite) permanecem visualmente idênticas ao comportamento anterior — sem `cursor: pointer`, sem indicador `▾`/`▴`, sem `role="button"`.
- Verificar que nenhuma chamada a `calculateScore()`/`calculateLiveScore()` foi introduzida em `PredictionBreakdown.tsx` ou no handler de toggle (`handleToggle` só manipula `expandedUserId`; `calculateLiveScore` continua sendo usado exclusivamente para a coluna `PTS*` de jogos `live`, comportamento pré-existente e fora do escopo desta feature).
- Validar visualmente em mobile que o `<td colSpan>` do breakdown não gera overflow horizontal (o componente usa apenas `display: flex` com `justify-content: space-between`, sem larguras fixas que excedam a largura da célula).
- Validar que `npm run lint` e `npm run build` (já executados nesta implementação, ambos sem erros) continuam passando após qualquer ajuste de revisão.
- A decisão técnica nº 1 (reestruturação do array `breakdownItems`) é um desvio do trecho de código ilustrativo da spec — vale confirmar que o Revisor concorda que é equivalente em comportamento, divergindo apenas por necessidade de compilação.

---

## Commits realizados

```
13eebf8 fix(prediction-score-breakdown): corrige inferência de tipo do array breakdownItems
b6131fd feat(prediction-score-breakdown): adiciona toggle de breakdown por linha em GameParticipantsList
92ac293 feat(prediction-score-breakdown): cria componente PredictionBreakdown
f86885f feat(prediction-score-breakdown): propaga breakdown de scores para ParticipantEntry
fb08e75 chore(prediction-score-breakdown): adiciona plano de implementação
```
