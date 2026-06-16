# Changelog: Colapsar/Expandir Card de Jogo com Palpites dos Participantes

**Slug:** collapse-game-card
**Branch:** feature/collapse-game-card
**Data:** 2026-06-16
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhuma mudança. Feature puramente de UI/interação no client, conforme spec.

### Frontend (Next.js/React)

- `components/games/GameCard.tsx`:
  - Adicionado estado `isParticipantsExpanded` (`useState(false)`), declarado junto aos demais estados locais do card (`currentPrediction`, `isEditing`), antes das chamadas a `useGameRealtime`/`useScoreRealtime` — que permanecem exatamente onde estavam, no topo do componente, incondicionais.
  - Substituído o bloco que renderizava `GameParticipantsList` sempre que `participants.length > 0` por:
    1. Um `<button type="button">` de toggle, renderizado quando `participants.length > 0`, com `onClick` que inverte `isParticipantsExpanded`, `aria-expanded={isParticipantsExpanded}`, `aria-controls={\`participants-${liveGame.id}\`}`, texto `VER PALPITES ▾` (colapsado) / `OCULTAR PALPITES ▴` (expandido), estilo inline consistente com o resto do componente (fonte monospace, `color-muted`, uppercase, borda superior tracejada `1px dashed var(--color-border)` que substitui a borda que antes vivia implicitamente antes da seção).
    2. Um `<div id={\`participants-${liveGame.id}\`}>` envolvendo `<GameParticipantsList>`, renderizado somente quando `participants.length > 0 && isParticipantsExpanded`.

### Banco de Dados

Nenhuma migration, nenhuma RLS policy, nenhuma query nova — conforme exigido pela spec.

---

## Decisões técnicas

**Nenhum desvio da spec.** O trecho de código fornecido na spec (linhas 76-119) foi seguido literalmente, com uma única simplificação: o `style` do `<button>` não inclui a propriedade `borderTop: '1px dashed var(--color-border)'` redundante junto das três propriedades equivalentes (`borderTopStyle`, `borderTopWidth`, `borderTopColor`) — a spec listava ambas as formas no mesmo objeto de estilo (o que seria um shorthand seguido de longhands, tecnicamente redundante mas inofensivo em CSS-in-JS via `style` do React, já que a ordem de propriedades no objeto determina qual "ganha" ao serializar para o atributo `style` do DOM). Mantive apenas as três propriedades longhand (`borderTopStyle`/`borderTopWidth`/`borderTopColor`) e omiti a `borderTop` shorthand para evitar ambiguidade, sem qualquer mudança visual perceptível — o resultado renderizado é idêntico (`border-top: 1px dashed var(--color-border)`).

**Posição dos hooks Realtime:** verificado manualmente (linhas 56-70 do arquivo final) que `useGameRealtime` e `useScoreRealtime` continuam no mesmo nível do componente, antes do `return`, sem qualquer condicionamento a `isParticipantsExpanded`. Nenhum `useEffect`/canal foi movido.

**Nenhuma alteração em `GameParticipantsList.tsx`, `GameList.tsx` ou `app/(dashboard)/jogos/page.tsx`** — confirmado por leitura desses arquivos antes da implementação; nenhum precisava de mudança, conforme a spec previu.

---

## Pontos de atenção para o Revisor

1. **Diff isolado a um único arquivo de produto** (`components/games/GameCard.tsx`), além do plano em `.pipeline/`. Nenhum outro arquivo foi tocado — confirmado via `git diff main feature/collapse-game-card --stat`.
2. **Acessibilidade:** o controle é um `<button>` nativo (foco via Tab, ativação via Enter/Espaço nativamente, sem `role`/`tabIndex`/`onKeyDown` manuais), com `aria-expanded` e `aria-controls` corretos.
3. **Independência entre cards:** o estado `isParticipantsExpanded` é local a cada instância de `GameCard` (via `useState` dentro do componente), portanto múltiplos cards podem estar expandidos simultaneamente sem interferência — não há estado compartilhado/global.
4. **Realtime preservado:** verificado que os hooks `useGameRealtime`/`useScoreRealtime` permanecem incondicionais no topo do componente; o colapso/expansão afeta apenas a renderização de `GameParticipantsList`, que é puramente apresentacional (sem hooks próprios).
5. **`npm run lint`** executou sem erros e sem warnings.
6. **`npm run build`** executou com sucesso (Next.js 16.2.9 / Turbopack), compilação e checagem de tipos TypeScript sem erros, todas as rotas geradas normalmente (incluindo `/jogos`).
7. Não foi possível validar visualmente em navegador (sem ambiente de execução interativo neste fluxo) — recomenda-se ao Revisor (ou a um passo de verificação manual) confirmar visualmente o toggle em `/jogos` com múltiplos jogos e participantes, incluindo o comportamento em mobile (largura de toque do botão, ausência de overflow horizontal) e o cenário de jogo `live` recebendo atualização Realtime com o card expandido.

---

## Commits realizados

```
e1ff9a3 feat(collapse-game-card): adiciona toggle de expansão para palpites dos participantes
9ec3a2d chore(collapse-game-card): adiciona plano de implementação
```
