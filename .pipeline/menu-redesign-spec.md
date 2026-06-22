# Spec: Redesign da Navegação (Header + Tab Bar + Pull Tabs)

**Slug:** menu-redesign
**Data:** 2026-06-22
**Status:** spec

---

## Objetivo

Reformular completamente a navegação do Bolão da Copa em três camadas independentes: (1) header compacto de uma linha, (2) tab bar fixa no rodapé com 4 itens e (3) pull tabs laterais deslizantes que substituem o `DualFooterBar` e o chip flutuante do `GroupChatWidget`. A mudança elimina ruído visual no rodapé, aumenta legibilidade dos links de navegação de 11px para 13px e adiciona acesso contextual a ONTEM, AO VIVO e CHAT via painéis que deslizam da borda direita.

---

## Histórias de Usuário

- Como participante do bolão, quero que os links de navegação estejam no rodapé com fonte legível (13px) e área de toque adequada (52px), para navegar com conforto no celular
- Como participante, quero acessar o resumo de ontem e o ranking ao vivo sem um botão poluindo o rodapé, abrindo-os via aba lateral ao toque
- Como participante, quero que o chat do grupo seja acessível pela mesma mecânica das abas laterais, sem chip flutuante sobre o conteúdo
- Como participante, quero que o header ocupe apenas uma linha, liberando espaço vertical para o conteúdo

---

## Modelo de Dados

Nenhuma alteração no banco de dados. Esta feature é exclusivamente de frontend/UI.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. Esta feature não altera lógica de backend.

---

## Frontend — Componentes React

### Visão Geral da Arquitetura

```
app/(dashboard)/layout.tsx          ← servidor — orquestra os três blocos
  ├── <header>                      ← linha única: logo + GroupMenu
  ├── <main>                        ← padding-top e padding-bottom ajustados
  ├── <TabBar />                    ← novo componente cliente, rodapé fixo
  └── <SidePanelContainer />        ← novo componente cliente, pull tabs + painéis
```

**Componentes eliminados:**
- `DualFooterBar.tsx` — substituído pelos pull tabs ONTEM e AO VIVO do `SidePanelContainer`
- `RecapController.tsx` — lógica absorvida pelo `SidePanelContainer`
- chip flutuante de `GroupChatWidget.tsx` — substituído pelo pull tab CHAT

**Componentes refatorados (extração de conteúdo):**
- `RecapBottomSheet.tsx` → conteúdo extraído para `RecapPanelContent.tsx`
- `LiveTodayBottomSheet.tsx` → conteúdo extraído para `LiveTodayPanelContent.tsx`
- `GroupChatWidget.tsx` → conteúdo extraído para `ChatPanelContent.tsx`

Os `BottomSheet` originais podem ser mantidos no arquivo mas não serão mais renderizados no layout. O conteúdo (corpo scrollável, tabelas, mensagens) é reutilizado sem alterações nos painéis laterais.

---

### 1. `app/(dashboard)/layout.tsx` — Refatoração

**Arquivo:** `app/(dashboard)/layout.tsx`
**Tipo:** Server Component (permanece)

**Mudanças:**

1. Remover importação e uso de `GroupChatWidget`
2. Remover importação e uso de `RecapController`
3. Adicionar importação de `TabBar` (Client Component — carregado com `dynamic` ou import direto com `'use client'` em arquivo separado)
4. Adicionar importação de `SidePanelContainer`
5. Header: remover a `<div>` da "Linha 2: navegação" (que contém `<NavLinks />`)
6. Header: manter apenas a linha do logo + `GroupMenu`
7. Header: ajustar padding para `padding: '0 1.5rem'`, com altura implícita de ~44px via `align-items: center` e `height: calc(44px + env(safe-area-inset-top))`
8. `<main>`: ajustar `paddingTop` para `calc(44px + env(safe-area-inset-top) + 1.5rem)`
9. `<main>`: ajustar `paddingBottom` para `calc(52px + env(safe-area-inset-bottom) + 1.5rem)` — sempre, não condicional por `activeGroup`
10. Renderizar `<TabBar />` após `<main>` (não precisa de props — usa `usePathname` internamente)
11. Renderizar `<SidePanelContainer groupId={activeGroup?.id} currentUserId={user.id} />` após `<TabBar />` — apenas quando `activeGroup` existir

**Resultado esperado do layout:**

```tsx
<div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
  <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, ... }}>
    {/* Uma linha: logo | GroupMenu */}
  </header>

  <main style={{ paddingTop: 'calc(44px + env(safe-area-inset-top) + 1.5rem)', paddingBottom: 'calc(52px + env(safe-area-inset-bottom) + 1.5rem)', ... }}>
    {children}
  </main>

  <TabBar />

  {activeGroup && (
    <SidePanelContainer
      groupId={activeGroup.id}
      currentUserId={user.id}
    />
  )}
</div>
```

---

### 2. Header — Ajustes em `app/(dashboard)/layout.tsx`

**Especificação do novo header:**

```tsx
<header
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    paddingTop: 'env(safe-area-inset-top)',
  }}
>
  <div
    style={{
      maxWidth: '960px',
      margin: '0 auto',
      padding: '0 1.5rem',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <span style={{
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '14px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--color-accent)',
    }}>
      BOLÃO DA COPA
    </span>
    <GroupMenu ... />
  </div>
</header>
```

**Altura total do header:** `44px + env(safe-area-inset-top)`.

---

### 3. `app/(dashboard)/group-switcher.tsx` — Ajuste de fonte

**Mudança única:** no objeto `MONO`, alterar `fontSize: '11px'` para `fontSize: '13px'`.

```ts
// Antes:
const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '11px',
  ...
}

// Depois:
const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '13px',
  ...
}
```

Nenhuma outra alteração neste arquivo.

---

### 4. `components/bolao/TabBar.tsx` — Componente Novo

**Arquivo:** `components/bolao/TabBar.tsx`
**Tipo:** `'use client'`

**Interface de props:** nenhuma prop (lê rota via `usePathname`)

**Estrutura lógica:**

```ts
const MAIN_ITEMS = [
  { href: '/perfil',   label: 'CAMPANHA' },
  { href: '/jogos',    label: 'JOGOS'    },
  { href: '/ranking',  label: 'RANKING'  },
]

const MAIS_ITEMS = [
  { href: '/grupos',        label: 'GRUPOS' },
  { href: '/como-pontuar',  label: 'REGRAS' },
  { href: '/configuracoes', label: 'CONFIG' },
]
```

**Estado interno:**
- `maisOpen: boolean` — controla visibilidade do popover
- `maisRef: RefObject<HTMLDivElement>` — para detectar clique fora

**Comportamento do item ativo:**
- Um item é ativo se `pathname === href || pathname.startsWith(href + '/')`
- O botão MAIS é ativo se qualquer `MAIS_ITEMS[].href` estiver ativo
- Indicador visual de ativo: `borderTop: '2px solid var(--color-primary)'` (na borda superior da tab bar, para o item)
- Cor ativa: `color-primary`; cor inativa: `color-muted`

**Popover MAIS:**
- Abre **para cima** (`bottom: 100%` relativo ao botão), com `zIndex: 200`
- Background: `var(--color-surface)`, border: `1px solid var(--color-border)`
- Itens com padding `0.75rem 1rem`, fonte 13px
- Fecha ao selecionar item (via `onClick`) ou ao clicar fora (`useEffect` + `mousedown`)

**Especificação CSS da tab bar:**

```tsx
// Container externo
{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  backgroundColor: 'var(--color-surface)',
  borderTop: '1px solid var(--color-border)',
  paddingBottom: 'env(safe-area-inset-bottom)',
}

// Linha interna dos itens
{
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'stretch',
  height: '52px',
  maxWidth: '960px',
  margin: '0 auto',
}

// Cada item (Link ou button)
{
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textDecoration: 'none',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
  borderTop: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
}
```

---

### 5. `components/bolao/SidePanelContainer.tsx` — Componente Novo

**Arquivo:** `components/bolao/SidePanelContainer.tsx`
**Tipo:** `'use client'`

**Props:**

```ts
interface SidePanelContainerProps {
  groupId: string
  currentUserId: string
}
```

**Estado interno:**

```ts
type PanelId = 'recap' | 'live' | 'chat' | null
const [openPanel, setOpenPanel] = useState<PanelId>(null)
```

**Hooks consumidos (já existem, sem alteração):**

```ts
const { loading, hasData, data } = useDailyRecap(groupId)
const {
  hasGamesToday,
  entries: liveTodayEntries,
  games: liveTodayGames,
  loading: liveTodayLoading,
} = useLiveTodayRanking(groupId)
```

**Visibilidade dos pull tabs:**
- Pull tab ONTEM: renderizar apenas quando `!loading && hasData === true`
- Pull tab AO VIVO: renderizar apenas quando `hasGamesToday === true`
- Pull tab CHAT: sempre renderizado quando o componente está montado (sempre tem `groupId`)

**Lógica de abertura automática do recap (migrada de `RecapController`):**

```ts
function getRecapKey(): string {
  const nowUTC = new Date()
  const nowET = new Date(nowUTC.getTime() - 4 * 60 * 60 * 1000)
  const yyyy = nowET.getUTCFullYear()
  const mm = String(nowET.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowET.getUTCDate()).padStart(2, '0')
  return `bolao_recap_${yyyy}-${mm}-${dd}`
}

// No useEffect:
useEffect(() => {
  if (loading) return
  if (decidedRef.current) return
  decidedRef.current = true
  const key = getRecapKey()
  if (localStorage.getItem(key) === 'shown') return
  localStorage.setItem(key, 'shown')
  if (hasData) {
    queueMicrotask(() => setOpenPanel('recap'))
  }
}, [loading, hasData])
```

**Fechar painel ao tocar fora:**
- Backdrop semitransparente em `z-index: 149` cobre os `15vw` à esquerda do painel
- `onClick` no backdrop chama `setOpenPanel(null)`

**Animação do painel:**
- Abertura: `translateX(100%)` → `translateX(0)` em 250ms ease-out
- Fechamento: `translateX(0)` → `translateX(100%)` em 250ms ease-in
- Implementar via CSS `transition: transform 250ms ease-out` com a class/style aplicado condicionalmente, não via keyframes — para que a transição de fechamento também funcione com `ease-in`

**Estratégia alternativa para animação (recomendada):**

```tsx
// Renderiza o painel sempre (nunca desmonta enquanto SidePanelContainer está montado)
// Altera apenas o transform via estado
<div
  style={{
    position: 'fixed',
    top: 'var(--header-h, 44px)',
    bottom: 'var(--tabbar-h, 52px)',
    right: 0,
    width: '85vw',
    zIndex: 150,
    backgroundColor: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    transform: openPanel !== null ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 250ms ease-out',
    overflowY: 'auto',
  }}
>
  {/* Conteúdo renderizado conforme openPanel */}
</div>
```

Porém, o conteúdo de cada painel só é montado quando aquele painel específico está ativo (ou já foi aberto ao menos uma vez — lazy-mount para preservar estado do chat).

**Estratégia de montagem do ChatPanelContent:**
- Chat usa `hasFetched` internamente para não recarregar mensagens ao fechar/abrir
- Montar `ChatPanelContent` na primeira vez que `openPanel === 'chat'`, manter montado depois (mesmo com painel fechado)
- Usar flag interna: `const [chatEverOpened, setChatEverOpened] = useState(false)` — setar para `true` quando `openPanel === 'chat'` pela primeira vez

**CSS custom properties para o header e tab bar:**
- Definir `--header-h` e `--tabbar-h` no `<html>` ou via layout para referência dos pull tabs e painéis
- Valor inicial: `--header-h: 44px`, `--tabbar-h: 52px`
- O `SidePanelContainer` pode ler esses valores via `var()` no CSS inline

**Especificação CSS dos pull tabs:**

```tsx
// Container dos pull tabs (posicionamento vertical centrado entre header e tab bar)
{
  position: 'fixed',
  right: 0,
  top: 'var(--header-h, 44px)',
  bottom: 'var(--tabbar-h, 52px)',
  zIndex: 160,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  justifyContent: 'center',
  pointerEvents: 'none', // o container não bloqueia cliques — apenas os botões individuais bloqueiam
}

// Cada pull tab (botão)
{
  pointerEvents: 'auto',
  width: '28px',
  backgroundColor: 'var(--color-surface)',
  borderLeft: '1px solid var(--color-border)',
  borderTop: '1px solid var(--color-border)',    // apenas na primeira aba
  borderBottom: '1px solid var(--color-border)', // em todas
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '0.75rem 0',
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  border: 'none',
  background: 'var(--color-surface)',
  outline: 'none',
}

// Cores por aba:
// ONTEM: color: 'var(--color-accent)'
// AO VIVO: color: 'var(--color-live)' + animation: 'blink 1s step-end infinite'
// CHAT: color: 'var(--color-primary)'
```

**Especificação CSS do painel lateral:**

```tsx
{
  position: 'fixed',
  top: 'var(--header-h, 44px)',
  bottom: 'var(--tabbar-h, 52px)',
  right: 0,
  width: '85vw',
  zIndex: 150,
  backgroundColor: 'var(--color-surface)',
  borderLeft: '1px solid var(--color-border)',
  overflowY: 'auto',
  transform: openPanel !== null ? 'translateX(0)' : 'translateX(100%)',
  transition: openPanel !== null
    ? 'transform 250ms ease-out'
    : 'transform 250ms ease-in',
}
```

**Especificação CSS do backdrop:**

```tsx
{
  position: 'fixed',
  top: 'var(--header-h, 44px)',
  bottom: 'var(--tabbar-h, 52px)',
  left: 0,
  right: '85vw', // cobre os 15vw à esquerda do painel
  zIndex: 149,
  background: 'transparent',
  display: openPanel !== null ? 'block' : 'none',
  cursor: 'default',
}
```

**Cabeçalho interno do painel:**
- Cada painel exibe um cabeçalho com título e botão `[ FECHAR ]`
- Botão FECHAR: `onClick={() => setOpenPanel(null)}`, texto `[ FECHAR ]`, alinhado à direita, `color-muted`, `13px`
- Título: `14px`, bold, uppercase, `letter-spacing: 0.1em`, `color-text`

---

### 6. `components/bolao/RecapPanelContent.tsx` — Componente Novo

**Arquivo:** `components/bolao/RecapPanelContent.tsx`
**Tipo:** `'use client'`

**Props:**

```ts
interface RecapPanelContentProps {
  data: DailyRecapData | null
  currentUserId: string
  onClose: () => void
}
```

**Conteúdo:** extraído do `RecapBottomSheet` — todas as seções (JOGOS DE ONTEM, RANKING DO DIA, DESTAQUES, botão FECHAR) sem o wrapper `position: fixed`, backdrop ou animação de bottom sheet. O conteúdo é idêntico ao interior do painel existente — copiar a lógica de renderização dos `data.games`, `data.rankingDay` e `data.badges`, incluindo `RecapGameCard`.

**Sem alterações** nos dados, hooks ou lógica de pontuação.

---

### 7. `components/bolao/LiveTodayPanelContent.tsx` — Componente Novo

**Arquivo:** `components/bolao/LiveTodayPanelContent.tsx`
**Tipo:** `'use client'`

**Props:**

```ts
interface LiveTodayPanelContentProps {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]
  loading: boolean
  currentUserId: string
  onClose: () => void
}
```

**Conteúdo:** extraído do `LiveTodayBottomSheet` — seções JOGOS DE HOJE, tabela de ranking, legenda, botão FECHAR, sem wrapper `position: fixed` ou backdrop. `LiveTodayGameCard` pode ser movido para este arquivo ou mantido no arquivo original e importado.

---

### 8. `components/bolao/ChatPanelContent.tsx` — Componente Novo

**Arquivo:** `components/bolao/ChatPanelContent.tsx`
**Tipo:** `'use client'`

**Props:**

```ts
interface ChatPanelContentProps {
  activeGroupId: string
  activeGroupName: string
  currentUserId: string
  isVisible: boolean // true quando o painel CHAT está aberto
}
```

**Conteúdo:** toda a lógica e UI do `GroupChatWidget` — subscription Realtime, carregamento de mensagens, envio, contagem de não-lidas — sem o chip flutuante e sem o drag. O painel é a variante "expandida" do widget atual, mas sem o shell `position: fixed; bottom; right; width: min(320px, ...)`.

**Contagem de não-lidas:**
- Manter a lógica de `unreadCount` para que o pull tab CHAT possa exibir um badge de não-lidas
- Expor `unreadCount` via callback `onUnreadCountChange?: (count: number) => void` — o `SidePanelContainer` usa isso para renderizar o badge no pull tab

**Scroll automático:** ao `isVisible` mudar para `true`, rolar para o final das mensagens (`messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`)

---

### 9. `app/(dashboard)/nav-links.tsx` — Descontinuação

Este arquivo deixa de ser importado pelo `layout.tsx` e pode ser deletado ou mantido sem uso. O Programador deve remover a importação do layout. O arquivo `nav-links.tsx` em si pode ser deixado no repositório para referência, mas não deve ser referenciado em nenhum componente ativo após esta feature.

---

## Regras de Negócio

1. **Visibilidade dos pull tabs:**
   - ONTEM só aparece se `hasData === true` E `loading === false`
   - AO VIVO só aparece se `hasGamesToday === true`
   - CHAT sempre aparece quando há `groupId` (independente de mensagens)

2. **Um painel por vez:** ao abrir qualquer painel, qualquer outro que esteja aberto fecha imediatamente (sem animação de saída do anterior — simplesmente o conteúdo muda)

3. **Abertura automática do recap:** primeira vez no dia (chave `bolao_recap_YYYY-MM-DD` no localStorage), se `hasData === true`, o painel ONTEM abre automaticamente. A chave usa horário ET (UTC-4) para compatibilidade com o código atual.

4. **Chat lazy-mount:** `ChatPanelContent` é montado na primeira abertura do painel CHAT e nunca mais desmontado, preservando o estado da subscription Realtime e o histórico de mensagens em memória.

5. **Badge de não-lidas no pull tab CHAT:** exibir um número em `color-accent` sobreposto ao pull tab quando `unreadCount > 0`. Badge some quando o painel é aberto (`isVisible = true`).

6. **Padding do main:** deve ser fixo — `calc(52px + env(safe-area-inset-bottom) + 1.5rem)` — independente de `activeGroup` existir ou não. A tab bar sempre está presente.

7. **Safe area no header:** `padding-top: env(safe-area-inset-top)` no `<header>`. A altura lógica do conteúdo é sempre 44px; a safe area é adicional acima.

8. **Safe area na tab bar:** `padding-bottom: env(safe-area-inset-bottom)` no container da tab bar. A altura do conteúdo (52px) é a área de toque; a safe area é adicional abaixo.

9. **Acessibilidade dos painéis:** cada painel deve ter `role="region"` com `aria-label` descritivo. O backdrop deve ter `aria-hidden="true"`. O painel fechado (`translateX(100%)`) deve ter `aria-hidden="true"` para não ser lido por leitores de tela.

---

## Proteção de Rotas

Sem alteração. O `DashboardLayout` já redireciona para `/login` se `user` for nulo. Esta feature não afeta a lógica de autenticação.

---

## Integração Supabase Realtime

Sem nova integração. `ChatPanelContent` reutiliza o canal existente do `GroupChatWidget`:
- Tabela: `group_messages`
- Evento: `INSERT`
- Canal: `group-chat-${activeGroupId}`
- Ação: adicionar mensagem à lista e incrementar `unreadCount` quando painel não está visível

Os hooks `useDailyRecap` e `useLiveTodayRanking` continuam sem alteração — são apenas consumidos pelo `SidePanelContainer` em vez do `RecapController`.

---

## Critérios de Aceite

- [ ] Header ocupa uma linha única (`height: 44px` de conteúdo) em qualquer largura de tela, com `env(safe-area-inset-top)` aplicado
- [ ] Tab bar fixa no rodapé com 4 itens (CAMPANHA, JOGOS, RANKING, MAIS), fonte 13px JetBrains Mono uppercase, altura de conteúdo 52px, `env(safe-area-inset-bottom)` aplicado
- [ ] Item ativo na tab bar exibe `borderTop: 2px solid var(--color-primary)` e `color: var(--color-primary)`
- [ ] Botão MAIS abre popover para cima com itens GRUPOS, REGRAS, CONFIG; fecha ao selecionar item ou clicar fora
- [ ] Pull tab ONTEM é `color-accent`, visível apenas quando `hasData === true`
- [ ] Pull tab AO VIVO é `color-live` com animação `blink`, visível apenas quando `hasGamesToday === true`
- [ ] Pull tab CHAT é `color-primary`, sempre visível quando há grupo ativo
- [ ] Texto dos pull tabs em `writing-mode: vertical-rl`, fonte 10px, uppercase
- [ ] Pull tabs ficam em `z-index: 160` — visíveis e tocáveis mesmo com painel aberto
- [ ] Painel abre com `translateX(100%) → translateX(0)` em 250ms ease-out
- [ ] Painel fecha com `translateX(0) → translateX(100%)` em 250ms ease-in ao tocar fora ou no botão FECHAR
- [ ] Abertura automática do recap no primeiro acesso do dia (localStorage `bolao_recap_YYYY-MM-DD`) mantida
- [ ] `DualFooterBar` e chip flutuante do `GroupChatWidget` removidos do DOM
- [ ] `padding-bottom` do `<main>` é `calc(52px + env(safe-area-inset-bottom) + 1.5rem)` — sempre aplicado
- [ ] Fonte do `GroupMenu` (group-switcher) alterada de 11px para 13px
- [ ] `nav-links.tsx` não é mais importado pelo layout
- [ ] Badge de não-lidas aparece no pull tab CHAT quando `unreadCount > 0`
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta `color-accent`/`color-primary`/`color-muted`, dark only, sem border-radius excessivo
- [ ] Funciona em mobile (coluna única, sem overflow horizontal)
- [ ] Nenhuma regressão nos fluxos existentes: recap, ao vivo, chat, navegação entre rotas
