# Fix 1: Redesign da Navegação (Header + Tab Bar + Pull Tabs)

**Slug:** menu-redesign
**Data:** 2026-06-22
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `pullTabBaseStyle` define `border: 'none'` após `borderLeft` e `borderBottom`, cancelando as bordas
**Arquivo:** `components/bolao/SidePanelContainer.tsx` (linhas 117–130)
**Severidade:** importante
**Descrição:** O objeto `pullTabBaseStyle` define `borderLeft: '1px solid var(--color-border)'` e `borderBottom: '1px solid var(--color-border)'` nas linhas 117–118, mas logo após na linha 130 define `border: 'none'`, que sobrescreve todas as propriedades `border*` individuais definidas anteriormente (em JavaScript/CSS inline, a shorthand `border` não tem precedência sobre as longhands quando declarada depois — ela as substitui). Na prática o bug é mascarado porque cada botão individual redefine `borderLeft`, `borderBottom` e `borderTop` explicitamente no spread. No entanto, o código é confuso e frágil: qualquer pull tab adicionado no futuro que não redefina as bordas individualmente ficará sem borda visual, e o `pullTabBaseStyle` como documentação/contrato é enganoso.
**Correção esperada:** Remover as linhas `borderLeft: '1px solid var(--color-border)'` e `borderBottom: '1px solid var(--color-border)'` do `pullTabBaseStyle` (linhas 117–118), mantendo apenas o `border: 'none'` que é o valor base correto para um `<button>`. As bordas reais de cada aba já estão corretamente definidas nos spreads individuais de cada botão.

```ts
// Antes (incorreto):
const pullTabBaseStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: '28px',
  backgroundColor: 'var(--color-surface)',
  borderLeft: '1px solid var(--color-border)',   // ← cancelado por border: 'none' abaixo
  borderBottom: '1px solid var(--color-border)', // ← cancelado por border: 'none' abaixo
  display: 'flex',
  // ...
  border: 'none',  // ← sobrescreve borderLeft e borderBottom acima
  outline: 'none',
  position: 'relative',
}

// Depois (correto):
const pullTabBaseStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: '28px',
  backgroundColor: 'var(--color-surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '0.75rem 0',
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  fontFamily: FONT,
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  border: 'none',
  outline: 'none',
  position: 'relative',
}
```

---

### Problema 2: Painel lateral não tem `role="region"` com `aria-label` descritivo
**Arquivo:** `components/bolao/SidePanelContainer.tsx` (linha 246 — o `div` do painel lateral)
**Severidade:** menor
**Descrição:** A spec exige explicitamente: "cada painel deve ter `role="region"` com `aria-label` descritivo". O `div` container que faz o slide (`translateX`) tem `aria-hidden={openPanel === null}` mas não tem `role="region"` nem `aria-label`. Os componentes filhos `RecapPanelContent` e `LiveTodayPanelContent` têm `role="region"` internamente, mas o `ChatPanelContent` não tem (só tem `role="region"` no seu `div` raiz). O container do painel deslizante em si também deve ter o `role` para que leitores de tela anunciem o painel quando ele abre.
**Correção esperada:** Adicionar `role="region"` e um `aria-label` dinâmico ao `div` do painel lateral. O label deve mudar conforme o painel aberto:

```tsx
<div
  role="region"
  aria-label={openPanel !== null ? panelTitles[openPanel] : 'Painel lateral'}
  aria-hidden={openPanel === null}
  style={{ ... }}
>
```

---

## Itens OK (não precisam ser revisados novamente)

- `TabBar.tsx`: estrutura, itens CAMPANHA/JOGOS/RANKING/MAIS, popover para cima, `useEffect` para fechar ao clicar fora, estilo ativo com `borderTop`, font 13px JetBrains Mono — correto
- `group-switcher.tsx`: alteração de `fontSize` de 11px para 13px — correto
- `layout.tsx`: header de uma linha com 44px, `paddingTop: env(safe-area-inset-top)`, remoção de `NavLinks`/`GroupChatWidget`/`RecapController`, `paddingBottom` fixo para o `<main>`, renderização de `<TabBar />` e `<SidePanelContainer />` — correto
- Lógica de abertura automática do recap via localStorage `bolao_recap_YYYY-MM-DD` (horário ET) — correto
- Lazy-mount do `ChatPanelContent` com `chatEverOpened` — correto
- Badge de não-lidas no pull tab CHAT com `onUnreadCountChange` — correto
- Animação `blink` no pull tab AO VIVO — keyframe já existe em `globals.css` — correto
- `nav-links.tsx` não importado pelo layout — correto
- Backdrop transparente que fecha o painel ao clicar — correto
- Transição `ease-out`/`ease-in` condicional para abertura/fechamento — correto
- `aria-hidden` no backdrop e no painel fechado — correto
- `RecapPanelContent`, `LiveTodayPanelContent`, `ChatPanelContent` têm `role="region"` e `aria-label` internamente — correto
- Cabeçalho do painel centralizado no `SidePanelContainer` (decisão técnica documentada) — aceito
