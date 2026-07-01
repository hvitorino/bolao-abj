# Changelog: Maximizar Bottom Sheet de Análise de Jogo

**Slug:** maximize-analise-drawer
**Branch:** feature/maximize-analise-drawer
**Data:** 2026-07-01
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/GameAnaliseDrawer.tsx` — Único arquivo modificado. Adicionados:
  - Estado `isMaximized: boolean` (padrão `false`) ao bloco de estados do componente
  - Reset de `isMaximized` no `handleClose()` antes de `setIsOpen(false)`
  - Reset de `isMaximized` no `useEffect` de abertura (junto com `setLoading`, `setError`, `setData`) garantindo que cada nova abertura começa no tamanho padrão
  - `maxHeight` condicional no `style` do painel: `72vh` (normal) vs `calc(100dvh - 52px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))` (maximizado)
  - `borderRadius` condicional: `8px 8px 0 0` (normal) vs `0` (maximizado)
  - `transition` expandida para incluir `max-height 250ms ease, border-radius 250ms ease` além do `transform 250ms ease` já existente
  - Drag handle reestruturado de `display: flex; justifyContent: center` para `position: relative; display: flex; alignItems: center; justifyContent: center` com padding lateral (`0.75rem`)
  - Pill de arraste permanece centralizado no layout flex
  - Botão `▲`/`▼` posicionado com `position: absolute; right: 0.75rem; top: 50%` — visível em todos os estados de conteúdo (loading, erro e dados)
  - `e.stopPropagation()` no `onClick` do botão para não propagar para handlers de drag
  - `onTouchEnd` no botão limpa estado residual de drag em mobile (`setIsDragging(false)`, `setDragOffset(0)`, `touchStartY.current = null`)
  - `aria-label` dinâmico: `'Maximizar análise'` / `'Restaurar tamanho padrão'`
  - Área de toque mínima: `minWidth: 44px; minHeight: 44px`

### Backend (Ruby/Sinatra)

Nenhuma alteração.

### Banco de Dados

Nenhuma alteração.

---

## Decisões técnicas

- **`100dvh` em vez de `100vh`:** usado para evitar o problema do endereço do Safari/iOS que comprime `100vh`. O projeto não usava `dvh` em outros lugares, mas a spec recomenda `dvh` e o suporte atual (2026) é amplo em todos os browsers modernos. O fallback natural é `100vh` caso o browser não suporte — a diferença é de poucos pixels.
- **Reset no `useEffect` vs na prop `gameId`:** O reset de `isMaximized` é feito dentro do `useEffect([gameId, groupId])` via `Promise.resolve().then()`, consistente com o padrão já usado no componente para evitar cascata de renders.
- **Sem lógica condicional por breakpoint:** conforme spec, o comportamento em desktop (viewport >= 768px) é idêntico ao mobile — apenas `maxHeight` e `borderRadius` mudam, `left`/`right` permanecem `1.5rem`.
- **Swipe e ESC sem comportamento intermediário:** conforme spec, ambos fecham o drawer diretamente sem passar por "restaurar primeiro".
- **Botão `<button>` nativo:** garante acessibilidade por teclado (Tab, Enter, Space) sem propriedades ARIA adicionais além do `aria-label`.

---

## Pontos de atenção para o Revisor

- Verificar que o `onTouchEnd` do botão intercepta corretamente o evento antes do `handleTouchEnd` do container pai em iOS — lógica de limpeza do estado de drag (`setIsDragging(false)`, `setDragOffset(0)`, `touchStartY.current = null`).
- Confirmar que a `transition` de `max-height` (de `72vh` para `calc(100dvh - ...)`) produz animação suave — transições de `max-height` com valores `calc()` funcionam corretamente nos browsers modernos.
- Verificar que `border-radius 250ms ease` na mesma transition string não interfere com os outros valores.
- Confirmar que o reset no `useEffect` de abertura acontece antes da animação de entrada (deve acontecer, pois o `setIsOpen(true)` ocorre após duplo rAF).
- Os erros de lint (`26 problems, 10 errors, 16 warnings`) são todos pré-existentes em outros arquivos — nenhum em `GameAnaliseDrawer.tsx`. O build (`npm run build`) passa sem erros novos.

---

## Commits realizados

```
e8f1640 feat(maximize-analise-drawer): adiciona botão de maximizar/restaurar no bottom sheet de análise
63d8d8d chore(maximize-analise-drawer): adiciona plano de implementação
```
