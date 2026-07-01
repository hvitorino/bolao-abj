# Spec: Maximizar Bottom Sheet de Análise de Jogo

**Slug:** maximize-analise-drawer
**Data:** 2026-07-01
**Status:** spec

---

## Objetivo

Permitir que o usuário expanda o `GameAnaliseDrawer` (bottom sheet de análise) para ocupar quase a totalidade da tela, melhorando a leitura das informações sem rolagem excessiva. A expansão é animada (250ms ease) e reversível via botão de toggle visível na área do drag handle. Todos os comportamentos existentes (swipe-to-close, ESC, backdrop, palpite inline, Realtime) permanecem funcionais em ambos os estados.

---

## Histórias de Usuário

- Como participante, quero expandir o drawer de análise para ver mais conteúdo sem rolar, para tomar decisões de palpite com mais contexto visível de uma só vez.
- Como participante, quero restaurar o drawer ao tamanho padrão sem fechá-lo, para não perder o contexto de análise enquanto navego.

---

## Modelo de Dados

Nenhuma alteração. Feature puramente client-side.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado.

---

## Frontend — Componentes React

### GameAnaliseDrawer

**Arquivo:** `components/bolao/GameAnaliseDrawer.tsx`

Este é o único arquivo a ser modificado.

---

### Novo estado

Adicionar ao bloco de estados existentes (linhas 76-83):

```tsx
const [isMaximized, setIsMaximized] = useState(false)
```

---

### Reset do estado ao abrir/fechar

**Ao fechar** (`handleClose`): adicionar `setIsMaximized(false)` antes de `setIsOpen(false)`, para que na próxima abertura o drawer comece no tamanho padrão.

```tsx
function handleClose() {
  setIsOpen(false)
  setIsMaximized(false)   // <-- novo
  setTimeout(() => {
    setIsVisible(false)
    onClose()
  }, 250)
}
```

**Ao abrir** (no `useEffect` que observa `gameId`): adicionar `setIsMaximized(false)` junto com os outros resets (`setLoading`, `setError`, `setData`).

---

### CSS do painel — diferença entre os dois estados

O estilo do painel (`<div role="dialog">`) muda nos seguintes atributos conforme `isMaximized`:

| Propriedade CSS | Estado normal | Estado maximizado |
|---|---|---|
| `maxHeight` | `'72vh'` | `'calc(100dvh - 52px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))'` |
| `borderRadius` | `'8px 8px 0 0'` | `'0'` |
| `transition` (sem drag) | `'transform 250ms ease, max-height 250ms ease'` | idem — mesma string |

O atributo `bottom` (`calc(52px + env(safe-area-inset-bottom))`) permanece **inalterado em ambos os estados**. O drawer cresce para cima ao maximizar, sem mudar o ponto de ancoragem no rodapé.

O campo `transition` quando `isDragging === true` continua sendo `'none'` (comportamento existente preservado).

**Implementação do style do painel:**

```tsx
style={{
  // ... props existentes inalteradas (position, bottom, left, right, zIndex, backgroundColor, border, borderBottom, display, flexDirection, fontFamily) ...
  maxHeight: isMaximized
    ? 'calc(100dvh - 52px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))'
    : '72vh',
  borderRadius: isMaximized ? '0' : '8px 8px 0 0',
  transform: isOpen
    ? isDragging ? `translateY(${dragOffset}px)` : 'translateY(0)'
    : 'translateY(100%)',
  transition: isDragging
    ? 'none'
    : 'transform 250ms ease, max-height 250ms ease, border-radius 250ms ease',
}}
```

**Nota sobre `100dvh`:** usar `dvh` (dynamic viewport height) evita o problema do endereço do browser em Safari/iOS que comprime `100vh`. Se `100dvh` não tiver suporte suficiente no target, usar `100vh` como fallback via CSS custom property ou simplesmente `100vh` — a diferença é apenas alguns pixels em Safari. O Programador deve verificar o suporte atual no projeto; se outros componentes já usam `dvh`, manter consistência.

---

### Botão de maximizar/restaurar — layout do drag handle

O drag handle atual é um `<div>` com `display: flex; justifyContent: center` contendo apenas o pill de 32×3px. Deve ser reestruturado para acomodar o botão no lado direito, mantendo o pill centralizado visualmente.

**Novo layout do drag handle:**

```tsx
<div
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  style={{
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 0.75rem 6px',
    flexShrink: 0,
    cursor: 'grab',
    touchAction: 'none',
  }}
>
  {/* Pill de arraste — permanece centralizado */}
  <div
    style={{
      width: '32px',
      height: '3px',
      borderRadius: '2px',
      backgroundColor: 'var(--color-border)',
    }}
  />

  {/* Botão de maximizar/restaurar */}
  <button
    type="button"
    aria-label={isMaximized ? 'Restaurar tamanho padrão' : 'Maximizar análise'}
    onClick={(e) => {
      e.stopPropagation()
      setIsMaximized((prev) => !prev)
    }}
    onTouchEnd={(e) => {
      e.stopPropagation()
      setIsDragging(false)
      setDragOffset(0)
      touchStartY.current = null
    }}
    style={{
      position: 'absolute',
      right: '0.75rem',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--color-muted)',
      fontSize: '14px',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      minWidth: '44px',
      minHeight: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      lineHeight: 1,
    }}
  >
    {isMaximized ? '▼' : '▲'}
  </button>
</div>
```

**Detalhes da implementação do botão:**

- **Símbolo:** `▲` para expandir (crescer para cima), `▼` para restaurar (encolher). Consistente com a linguagem ASCII do DESIGN.md (`►`, `✓`, `██`).
- **`e.stopPropagation()` no `onClick`:** impede que o clique do botão propague para os handlers de drag do container pai.
- **`onTouchEnd` com `e.stopPropagation()`:** em mobile, o `touchstart` no botão propaga para o container e ativa `handleTouchStart`, colocando `isDragging = true`. O `onTouchEnd` no botão intercepta o evento antes que `handleTouchEnd` do container execute, e limpa manualmente o estado de drag (`isDragging = false`, `dragOffset = 0`, `touchStartY.current = null`). O `onClick` do botão dispara após o touch, chamando `setIsMaximized`. Sem este `onTouchEnd`, o `isDragging` ficaria `true` residual e desabilitaria a transition CSS no próximo render.
- **`aria-label` dinâmico:** muda entre `'Maximizar análise'` e `'Restaurar tamanho padrão'` conforme o estado.
- **Acessibilidade por teclado:** o `<button>` nativo recebe foco com `Tab`, ativa com `Enter` e `Space`. Nenhuma propriedade ARIA adicional é necessária além do `aria-label`.
- **Tamanho mínimo de toque:** `minWidth: 44px; minHeight: 44px` garante área de toque mínima recomendada (WCAG 2.5.5).
- **Cor:** `color-muted` em estado normal. Não muda ao maximizar (o símbolo já comunica o estado).

---

### Comportamento do swipe-to-close em ambos os estados

Os handlers `handleTouchStart`, `handleTouchMove`, `handleTouchEnd` permanecem **inalterados em lógica**. O swipe-to-close (`dragOffset > 60px`) fecha o drawer independentemente de `isMaximized`. Não há "desmaximizar com swipe" — swipe maior que 60px sempre fecha.

---

### Comportamento do ESC em ambos os estados

O `useEffect` que escuta `keydown` com `Escape` permanece **inalterado**. Pressionar ESC fecha o drawer (chama `handleClose()`) tanto no estado normal quanto no maximizado. Não há comportamento intermediário de "ESC primeiro restaura, segundo ESC fecha".

---

### Comportamento em desktop (viewport ≥ 768px)

O drawer em desktop já tem `left: 1.5rem; right: 1.5rem` (não é full-width). Ao maximizar, apenas `maxHeight` e `borderRadius` mudam — a posição horizontal é preservada. Não há nenhuma lógica condicional por breakpoint nesta feature.

---

### Sem regressão no Realtime

`useGameRealtime` e `useScoreRealtime` são chamados dentro do `GameCard` renderizado dentro do drawer. A adição do estado `isMaximized` e do botão não toca em nenhuma subscription Realtime. O `GameCard` é montado/desmontado apenas quando `data` muda (fetch completo), não quando `isMaximized` muda.

---

## Regras de Negócio

1. `isMaximized` começa em `false` sempre que o drawer abre (reset no `useEffect` do `gameId`).
2. `isMaximized` é resetado para `false` no `handleClose()` — o fechamento sempre limpa o estado de maximização.
3. O botão `▲`/`▼` é visível em todos os estados de conteúdo: loading (skeleton), erro e dados carregados.
4. O toggle de maximização não fecha o drawer, não faz re-fetch dos dados e não afeta o estado de `gameId`.
5. Swipe-to-close e ESC fecham o drawer diretamente, sem passar por "restaurar primeiro".

---

## Proteção de Rotas

Nenhuma nova rota. O drawer é renderizado dentro de `app/(dashboard)/palpites/palpites-live-section.tsx`, que já está protegido pelo layout do dashboard.

---

## Integração Supabase Realtime

Nenhuma nova integração. A feature é puramente de UI/UX client-side.

---

## Critérios de Aceite

- [ ] `GameAnaliseDrawer` possui estado `isMaximized: boolean`, `false` por padrão.
- [ ] Botão `▲`/`▼` visível à direita da área do drag handle, com `aria-label` dinâmico e área de toque mínima de 44×44px.
- [ ] Clicar/tocar o botão alterna entre `maxHeight: 72vh` (normal) e `maxHeight: calc(100dvh - 52px - env(...))` (maximizado).
- [ ] A transição entre os dois estados é animada com `250ms ease` (sem flash visual, sem pulo).
- [ ] `borderRadius` do painel vai de `8px 8px 0 0` para `0` ao maximizar, com a mesma transição de 250ms.
- [ ] `isMaximized` é resetado para `false` ao fechar o drawer (via botão, swipe, backdrop, ESC) e ao abrir para um novo jogo.
- [ ] Swipe-to-close (drag > 60px) fecha o drawer em ambos os estados (normal e maximizado).
- [ ] ESC fecha o drawer em ambos os estados (normal e maximizado).
- [ ] Em mobile, o toque no botão não deixa estado residual de drag (`isDragging` e `dragOffset` são limpos no `onTouchEnd` do botão).
- [ ] Em desktop (≥ 768px), o comportamento maximizado altera apenas a altura — `left`/`right` permanecem em `1.5rem`.
- [ ] Nenhuma regressão: backdrop, scroll interno, skeleton, mensagem de erro, GameCard inline, MatchupStatsCard, RecentGamesSection, GroupStandingsCard, Realtime e `onPredictionSubmitted` continuam funcionando.
- [ ] Botão acessível por teclado: focável com `Tab`, ativável com `Enter` e `Space`.
- [ ] Design segue DESIGN.md: símbolo ASCII (`▲`/`▼`), cor `color-muted`, fonte JetBrains Mono, sem sombra, sem border-radius desnecessário.
- [ ] `npm run lint` e `npm run build` passam sem erros novos.
- [ ] Diff isolado a `components/bolao/GameAnaliseDrawer.tsx` (nenhum outro arquivo modificado, salvo absolutamente necessário).
