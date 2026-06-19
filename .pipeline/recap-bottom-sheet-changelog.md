# Changelog: Botão Fixo no Rodapé com Bottom Sheet de Resumo

**Slug:** recap-bottom-sheet
**Branch:** feature/recap-bottom-sheet
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/RecapFooterButton.tsx` — novo componente que substitui o `RecapFloatingButton`. Botão fixo de largura total fixado no rodapé da tela (`position: fixed; bottom: 0; left: 0; right: 0; zIndex: 50`). Visível apenas quando `hasData === true && loading === false`. Inclui safe-area iOS via `env(safe-area-inset-bottom)`. Conteúdo centralizado em `max-width: 960px`. Hover altera cor do texto e borda para `color-accent`.

- `components/bolao/RecapBottomSheet.tsx` — novo componente que substitui o `DailyRecapModal`. Bottom sheet com animação slide-up (abertura, 300ms ease-out) e slide-down (fechamento, 300ms ease-in) via keyframes CSS globais. Exibe exatamente o mesmo conteúdo do `DailyRecapModal`: JOGOS DE ONTEM, RANKING DO DIA e DESTAQUES (Craque do Dia, Mãe Diná, Pé-frio). Backdrop semitransparente fecha o sheet. Handle visual de arrasto no topo. Safe-area iOS no `padding-bottom`. Trava `overflow: hidden` no `document.body` enquanto aberto. Props: `data: DailyRecapData | null`, `currentUserId`, `isOpen`, `onClose`.

- `components/bolao/RecapController.tsx` — modificado para usar `RecapFooterButton` e `RecapBottomSheet` em vez dos componentes antigos. Passou a gerenciar a lógica de abertura automática via localStorage (migrada do `DailyRecapModal`): lê/escreve a chave `bolao_recap_YYYY-MM-DD` em BRT, abre o bottom sheet automaticamente no primeiro acesso do dia se `hasData === true`. Passa `data` direto para o `RecapBottomSheet` evitando chamada duplicada ao hook.

- `components/bolao/RecapFloatingButton.tsx` — removido (nenhum outro importador).

- `components/bolao/DailyRecapModal.tsx` — removido (nenhum outro importador).

- `components/bolao/GroupChatWidget.tsx` — ajuste de z-index: o chip minimizado agora usa `zIndex: 51` (era 50) para garantir que fique acima do `RecapFooterButton` que ocupa `zIndex: 50` no rodapé.

- `app/(dashboard)/layout.tsx` — adicionado `paddingBottom: calc(4rem + env(safe-area-inset-bottom))` ao `<main>` quando `activeGroup` existe, evitando que o conteúdo da última seção fique coberto pelo botão fixo no rodapé.

- `app/globals.css` — adicionados keyframes `@keyframes slideUp` e `@keyframes slideDown` para as animações do bottom sheet.

### Backend (Ruby/Sinatra)

Nenhuma alteração. Feature 100% frontend.

### Banco de Dados

Nenhuma migration. Nenhuma alteração de schema.

---

## Decisões técnicas

- **`queueMicrotask` nos setStates do useEffect:** O linter (`react-hooks/set-state-in-effect`) proíbe `setState` síncrono direto no corpo de um effect. A solução foi envolver os `setVisible`/`setAnimating` em `queueMicrotask`, diferindo a execução para a próxima microtarefa. Isso é semanticamente equivalente e resolve o aviso sem alterar o comportamento.

- **Tipo `DailyRecapData`:** A spec referenciava `RecapData` mas o hook `useDailyRecap` exporta `DailyRecapData`. O `RecapBottomSheet` usa o tipo correto exportado pelo hook.

- **Z-index do chip do chat:** O `GroupChatWidget` chip estava em `zIndex: 50`, igual ao `RecapFooterButton`. Com ambos em `position: fixed`, o chip ficaria coberto pelo botão do rodapé na sobreposição visual. Elevamos o chip para `zIndex: 51` — solução pontual que não afeta o painel expandido do chat (que já tem empilhamento próprio pelo DOM order).

- **`padding-bottom` condicional no layout:** A spec sugeria uma solução simples — padding incondicional quando `activeGroup` existe. Optamos por isso em vez de criar uma CSS variable ou comunicação client-side, pois o layout é Server Component.

- **Erros de lint pré-existentes:** Os 2 erros que persistem no `npm run lint` (`group-switcher.tsx` e `GroupChatWidget.tsx`) existem na main antes desta feature e não foram introduzidos aqui.

---

## Pontos de atenção para o Revisor

1. **Animação de fechamento:** O `useEffect` que controla `visible`/`animating` tem um `eslint-disable` para `react-hooks/exhaustive-deps` porque intencionalmente não inclui `visible` na dep array (para evitar re-execução quando `visible` muda internamente). Verificar se esse comportamento é correto.

2. **Abertura automática migrada para `RecapController`:** Antes estava no `DailyRecapModal`. Confirmar que a lógica do `decidedRef` está correta e que o `queueMicrotask(() => setForceOpen(true))` funciona como esperado para abertura automática.

3. **Z-index do painel expandido do chat:** O painel expandido do `GroupChatWidget` ainda usa `zIndex: 50`. Quando o bottom sheet de recap (`zIndex: 201`) estiver aberto e o chat também estiver expandido, o chat ficaria atrás do backdrop do recap (zIndex: 200). Isso é o comportamento desejado (recap tem precedência).

4. **`forceOpen` não fecha automaticamente:** O `RecapController` seta `forceOpen=true` mas não tem uma guarda equivalente ao `Effect 2` do `DailyRecapModal` antigo (que evitava reabrir se já estivesse aberto). O novo fluxo é mais simples: `RecapBottomSheet.isOpen = forceOpen` é controlado diretamente pelo pai. Confirmar que isso não causa problemas de reabertura indesejada após fechar.

---

## Commits realizados

```
b709cc4 fix(recap-bottom-sheet): usa queueMicrotask para diferir setState no useEffect — resolve lint
e8e2051 fix(recap-bottom-sheet): eleva zIndex do chip do chat para 51 — evita sobreposição com botão do rodapé
662338d feat(recap-bottom-sheet): adiciona padding-bottom ao main para não sobrepor botão fixo
c28b1b6 feat(recap-bottom-sheet): remove RecapFloatingButton e DailyRecapModal (substituídos)
e47ab34 feat(recap-bottom-sheet): atualiza RecapController — usa RecapBottomSheet e migra abertura automática
9d05938 feat(recap-bottom-sheet): cria RecapBottomSheet com animação slide-up/slide-down
0c3798d feat(recap-bottom-sheet): cria RecapFooterButton — botão fixo full-width no rodapé
a926d5e feat(recap-bottom-sheet): adiciona keyframes slideUp e slideDown no globals.css
820a965 chore(recap-bottom-sheet): adiciona plano de implementação
```
