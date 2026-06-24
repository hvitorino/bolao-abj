# Changelog: Animação de Posição dos Palpites na Página Pública de Jogo

**Slug:** animated-predictions-ranking
**Branch:** feature/animated-predictions-ranking
**Data:** 2026-06-24
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/PublicParticipantsList.tsx` — componente reescrito para suportar ordenação reativa por pontuação e animação FLIP de reposicionamento de cards em tempo real.

#### Mudanças principais

1. **Função `sortParticipants`** (fora do componente, sem dependência de React):
   - `pending`: participantes com palpite (`hasPrediction=true`) vêm antes; desempate por nome pt-BR ascendente.
   - `live`: pontuação efetiva via `calculateLiveScore`; sem palpite = -1 (sempre ao final); desempate por nome pt-BR.
   - `finished`: `p.points ?? -1`; sem palpite = -1; desempate por nome pt-BR.

2. **`useMemo` para `sortedParticipants`**: recalcula automaticamente sempre que `participants`, `gameStatus`, `liveHomeScore` ou `liveAwayScore` mudam — incluindo atualizações de placar ao vivo via props.

3. **Técnica FLIP manual com `useLayoutEffect`**:
   - `rowRefs`: `useRef<Map<string, HTMLDivElement>>` — rastreia o elemento DOM de cada row por `userId`.
   - `prevPositions`: `useRef<Map<string, DOMRect>>` — armazena `getBoundingClientRect()` de cada row antes de cada re-render.
   - `capturePositions()`: função estável que lê as posições atuais e salva em `prevPositions`.
   - `isFirstRender`: `useRef(true)` — suprime animação no primeiro render; setado para `false` na primeira execução do `useLayoutEffect`.
   - Algoritmo FLIP: First (posições salvas) → Last (posições pós-reorder) → Invert (transform reverso sem transition) → reflow forçado (`void el.getBoundingClientRect()`) → Play (transition `transform 350ms ease-in-out`, transform vazio).

4. **Captura de snapshot no handler Realtime de `scores`**: `capturePositions()` é chamado imediatamente antes de `setParticipants` no callback do canal Supabase, garantindo que o step FIRST do FLIP capture o estado visual correto antes da re-renderização.

5. **Substituição de `<table>` por `<div role="table">`**: rows de `<div role="row">` com `display: flex` permitem `translateY` confiável em todos os browsers (limitação conhecida de `<tr>` com `transform`).

6. **Roles ARIA preservados**: `role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"` com `aria-label` no container.

7. **Aparência visual preservada**: mesmas cores (`--color-*`), tipografia JetBrains Mono, paddings, bordas, rodapé "* PONTUAÇÃO PROVISÓRIA" e badge "AO VIVO" inalterados.

### Backend (Ruby/Sinatra)

Nenhuma alteração — feature é puramente de UI/UX.

### Banco de Dados

Nenhuma alteração — nenhuma migration ou policy nova.

---

## Decisões técnicas

- **FLIP manual vs. Framer Motion**: Framer Motion não está instalado no projeto. A técnica FLIP nativa com `useLayoutEffect` é suficiente para o caso de uso e evita adicionar uma dependência externa de ~30KB.

- **`void el.getBoundingClientRect()` para reflow**: substituiu `eslint-disable @typescript-eslint/no-unused-expressions` que o lint flagou como desnecessário. `void` expressa a intenção de descarte do valor retornado.

- **`capturePositions` como função estável**: definida no corpo do componente mas sem dependências externas que mudem — chamada tanto no `useLayoutEffect` quanto no handler Realtime sem precisar de `useCallback`.

- **`getRowRef` como callback ref**: cria closures por `userId` para registrar/desregistrar entries no mapa `rowRefs` de forma limpa, sem `useEffect` adicional por item.

- **Animação em props de placar ao vivo**: quando `liveHomeScore`/`liveAwayScore` mudam (propagados por `useGameRealtime`), o `useMemo` recalcula `sortedParticipants`, o que dispara o `useLayoutEffect`. Nesse caso, o snapshot FIRST é o último `capturePositions()` chamado ao final do ciclo FLIP anterior — comportamento correto porque entre dois renders consecutivos o DOM não muda sem `sortedParticipants` mudar.

---

## Pontos de atenção para o Revisor

1. **Snapshot FIRST para mudanças de prop vs. mudanças de estado**: quando a reordenação é disparada por mudança de `liveHomeScore`/`liveAwayScore` (prop), não há um `setParticipants` onde capturar o snapshot antes. O snapshot usado é o salvo no final do ciclo FLIP anterior. Verificar se isso é suficiente para todos os casos, ou se pode haver um ciclo em que o snapshot fique desatualizado.

2. **Lint warnings pré-existentes**: os 5 erros de lint que `npm run lint` reporta (`group-switcher.tsx`, `ChatPanelContent.tsx`, `GroupChatWidget.tsx`, `SidePanelContent.tsx`, etc.) são pré-existentes e não foram introduzidos por esta feature. `PublicParticipantsList.tsx` passa sem warnings ou erros.

3. **Compatibilidade de `overflow: hidden` no container**: o container raiz tem `overflow: hidden`. O FLIP usa `translateY` que move elementos para fora do fluxo visual sem afetar o layout do container — verificar se em casos extremos de delta grande o card animado fica cortado durante a transição.

4. **Reordenação em `pending`**: a spec define que não deve haver animação em `pending` porque a lista não muda nesse estado. A ordenação `pending` está implementada, mas como o estado não muda enquanto o jogo está pendente, o `useLayoutEffect` FLIP simplesmente não encontrará deltas e não animará. Correto por construção.

5. **Dependências do `useLayoutEffect`**: o array de dependências inclui `[sortedParticipants]`. O eslint-plugin-react-hooks aceita isso porque `sortedParticipants` é um array derivado por `useMemo` — um novo array por referência a cada recalculo. Verificar se há risco de loop (não deve haver pois o FLIP não chama `setState`).

---

## Commits realizados

```
90b94f8 feat(animated-predictions-ranking): implementa ordenação e animação FLIP nos palpites da página pública de jogo
a61f8a0 chore(animated-predictions-ranking): adiciona plano de implementação
```
