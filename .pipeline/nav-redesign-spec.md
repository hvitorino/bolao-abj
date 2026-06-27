# Spec: Redesign da Navegação (Abas)

**Slug:** nav-redesign
**Data:** 2026-06-27
**Status:** spec

---

## Objetivo

Reformular a tab bar fixa do dashboard removendo a aba JOGOS e adicionando uma aba CHAT que abre um bottom sheet com o chat do grupo — no mesmo espaço geométrico (posição e dimensões idênticas) ao drawer de análise de jogos (`GameAnaliseDrawer`). A rota `/jogos` e todos os seus arquivos permanecem intactos.

---

## Histórias de Usuário

- Como participante, quero acessar o chat do meu grupo com um toque na tab bar, sem precisar procurar um chip flutuante ou pull tab lateral.
- Como participante, quero que o chat abra como bottom sheet sobre o conteúdo atual, ocupando o mesmo espaço que o drawer de análise de jogos.
- Como participante, quero ver um badge de não lidas no ícone CHAT da tab bar quando houver mensagens novas.
- Como participante, quero navegar pelos jogos acessando `/jogos` diretamente pela URL ou por outro ponto de entrada — a rota não deve ser deletada.

---

## Modelo de Dados

Nenhuma alteração de schema, tabela, migration ou política RLS. Esta feature é exclusivamente de UI.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado.

---

## Frontend — Componentes React

### Estado atual (referência para o Programador)

**`components/bolao/TabBar.tsx`** — tab bar atual com:
```
MAIN_ITEMS = [EU (/perfil), JOGOS (/jogos), PALPITES (/palpites), RANKING (/ranking)]
MAIS_ITEMS = [GRUPOS, REGRAS, CONFIG]
```
Sem props. Renderizado em `layout.tsx` como `<TabBar />`.

**`components/bolao/SidePanelContainer.tsx`** — slide-in panel da esquerda. Gerencia 3 painéis via pull tabs verticais fixos em `left: 0`: ONTEM, AO VIVO e CHAT. O painel CHAT contém `ChatPanelContent`. `PanelId = 'recap' | 'live' | 'chat' | null`.

**`components/bolao/ChatPanelContent.tsx`** — conteúdo do chat. Props: `activeGroupId`, `activeGroupName`, `currentUserId`, `isVisible`, `onUnreadCountChange?`. Gerencia Realtime, mensagens, envio e unreadCount.

**`components/bolao/GameAnaliseDrawer.tsx`** — bottom sheet de referência de posicionamento. CSS exato:
```
position: fixed
bottom: calc(52px + env(safe-area-inset-bottom))
left: calc(28px + 1.5rem)
right: 1.5rem
maxHeight: 72vh
zIndex: 51
backgroundColor: var(--color-surface)
border: 1px solid var(--color-border)
borderBottom: none
borderRadius: 8px 8px 0 0
```
Tem drag handle (swipe-to-close), backdrop, handler de ESC.

---

### 1. `components/bolao/TabBar.tsx` — MODIFICAR

**Mudanças:**

**Props (nova interface):**
```typescript
interface TabBarProps {
  groupId: string          // '' quando o usuário não tem grupo ativo
  currentUserId: string
  activeGroupName: string
}
```

**MAIN_ITEMS — nova ordem e conteúdo:**
```
EU       → Link href="/perfil"
RANKING  → Link href="/ranking"
PALPITES → Link href="/palpites"
CHAT     → button (abre ChatBottomSheet, não é Link)
```
MAIS permanece como 5th item com GRUPOS, REGRAS, CONFIG.

**Estado novo:**
```typescript
const [chatOpen, setChatOpen] = useState(false)
const [chatUnreadCount, setChatUnreadCount] = useState(0)
```

**Aba CHAT:**
- Renderiza como `<button type="button">` com o mesmo `itemStyle` das demais abas
- `active = chatOpen` para fins de estilo (borderTop verde quando chatOpen é true)
- Ao clicar: se `groupId === ''`, não faz nada (sem grupo ativo = sem chat); caso contrário, `setChatOpen(true)`
- Quando `!chatOpen && chatUnreadCount > 0`, exibe badge de não lidas acima/ao lado do label CHAT:
  ```
  CHAT
  [N]  ← badge: backgroundColor var(--color-accent), color var(--color-bg), fontSize 9px,
         fontWeight bold, fontFamily FONT, minWidth 14px, height 14px,
         position absolute top:2px right:2px
  ```
- O container do botão CHAT precisa de `position: 'relative'` para o badge absoluto funcionar

**`ChatBottomSheet` renderizado no retorno do componente:**
```tsx
// Ao final do return, antes do fechamento do fragment/div raiz:
{groupId && (
  <ChatBottomSheet
    isOpen={chatOpen}
    onClose={() => setChatOpen(false)}
    groupId={groupId}
    currentUserId={currentUserId}
    activeGroupName={activeGroupName}
    onUnreadCountChange={(count) => setChatUnreadCount(count)}
  />
)}
```

**Observação sobre posicionamento:** `ChatBottomSheet` usa `position: fixed`, o que o posiciona em relação ao viewport, não ao ancestral. Nenhum ancestral de `TabBar` usa `transform`, `perspective` ou `filter`, portanto a renderização dentro do DOM da TabBar é correta.

---

### 2. `components/bolao/ChatBottomSheet.tsx` — CRIAR

**Arquivo:** `components/bolao/ChatBottomSheet.tsx`

**Props:**
```typescript
interface ChatBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  currentUserId: string
  activeGroupName: string
  onUnreadCountChange?: (count: number) => void
}
```

**Estados internos:**
- `isVisible: boolean` — controla montagem/desmontagem do DOM (lazy-mount)
- `isAnimatingIn: boolean` — controla a animação de entrada (translateY)
- `dragOffset: number` — deslocamento durante swipe
- `isDragging: boolean`
- `touchStartY: useRef<number | null>`
- `everOpened: boolean` — true após a primeira abertura; impede desmontagem do ChatPanelContent

**Lógica de abertura/fechamento:**

Seguir exatamente o padrão de `GameAnaliseDrawer`:

Abertura (`isOpen` muda para `true`):
```
1. setIsVisible(true)
2. rAF → rAF → setIsAnimatingIn(true)
```

Fechamento (onClose chamado):
```
1. setIsAnimatingIn(false)
2. setTimeout 250ms → setIsVisible(false) + chamar onClose() do pai
```

**Handler ESC:** `useEffect` com `document.addEventListener('keydown', handler)` quando `isAnimatingIn` é true.

**Trava de scroll do body:** `document.body.style.overflow = isAnimatingIn ? 'hidden' : ''`

**Swipe-to-close (drag handle):**
- Aplicado apenas no drag handle (não no conteúdo inteiro)
- `onTouchStart`, `onTouchMove`, `onTouchEnd` replicando `GameAnaliseDrawer`
- Threshold para fechar: `dragOffset > 60`

**Estrutura JSX quando `isVisible` é true:**

```tsx
<>
  {/* Backdrop */}
  <div
    role="presentation"
    onClick={handleClose}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: isAnimatingIn ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
      transition: 'background-color 250ms ease',
    }}
  />

  {/* Painel */}
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Chat — ${activeGroupName}`}
    style={{
      position: 'fixed',
      bottom: 'calc(52px + env(safe-area-inset-bottom))',
      left: 'calc(28px + 1.5rem)',
      right: '1.5rem',
      zIndex: 51,
      maxHeight: '72vh',
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderBottom: 'none',
      borderRadius: '8px 8px 0 0',
      transform: isAnimatingIn
        ? isDragging ? `translateY(${dragOffset}px)` : 'translateY(0)'
        : 'translateY(100%)',
      transition: isDragging ? 'none' : 'transform 250ms ease',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}
  >
    {/* Drag handle */}
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 0 6px',
        flexShrink: 0,
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <div style={{
        width: '32px',
        height: '3px',
        borderRadius: '2px',
        backgroundColor: 'var(--color-border)',
      }} />
    </div>

    {/* Cabeçalho */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 0.75rem 0.5rem',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '11px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--color-text)',
      }}>
        CHAT — {activeGroupName.toUpperCase()}
      </span>
      <button
        type="button"
        onClick={handleClose}
        style={{ /* mesmo estilo [FECHAR] do SidePanelContainer */ }}
        aria-label="Fechar chat"
      >
        [ FECHAR ]
      </button>
    </div>

    {/* Conteúdo com scroll — lazy-mount */}
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {everOpened && (
        <ChatPanelContent
          activeGroupId={groupId}
          activeGroupName={activeGroupName}
          currentUserId={currentUserId}
          isVisible={isAnimatingIn}
          onUnreadCountChange={onUnreadCountChange}
        />
      )}
    </div>
  </div>
</>
```

**Lazy-mount:** `everOpened` começa como `false`. No `useEffect` que observa `isOpen`:
```
if (isOpen && !everOpened) setEverOpened(true)
```
Assim `ChatPanelContent` é montado na primeira abertura e nunca desmontado (a subscription Realtime permanece ativa).

---

### 3. `app/(dashboard)/layout.tsx` — MODIFICAR

**Mudança única:** passar props para `<TabBar />`:

```tsx
// Antes:
<TabBar />

// Depois:
<TabBar
  groupId={activeGroup?.id ?? ''}
  currentUserId={user.id}
  activeGroupName={activeGroup?.name ?? ''}
/>
```

Nenhuma outra mudança no layout.

---

### 4. `components/bolao/SidePanelContainer.tsx` — MODIFICAR

Remover o pull tab CHAT e o painel CHAT do `SidePanelContainer`, pois o chat agora é acessível via tab bar.

**Mudanças específicas:**

1. `PanelId` — alterar de `'recap' | 'live' | 'chat' | null` para `'recap' | 'live' | null`

2. Remover estados: `chatEverOpened`, `chatUnreadCount`

3. Remover callback: `handleUnreadCountChange`

4. Remover o `useEffect` que setava `chatEverOpened` ao abrir o painel chat

5. `showChatTab` — remover a constante e o bloco JSX do pull tab CHAT

6. `panelTitles` — remover a chave `chat`

7. No bloco de conteúdo do painel, remover o bloco condicional:
```tsx
{chatEverOpened && (
  <div style={{ display: openPanel === 'chat' ? 'flex' : 'none', ... }}>
    <ChatPanelContent ... />
  </div>
)}
```

8. No bloco do conteúdo: remover `openPanel === 'chat' ? 'hidden' : 'auto'` do `overflow-y` do container de conteúdo — simplificar para `overflow-y: 'auto'` sempre.

9. Remover o import de `ChatPanelContent` (se não for usado em nenhum outro lugar do arquivo).

10. Props de `SidePanelContainer` — remover `currentUserId` se era usado apenas para passar ao `ChatPanelContent`. **Atenção:** verificar se `currentUserId` é usado em algum outro painel (RecapPanelContent, LiveTodayPanelContent) antes de remover da interface.

---

## Regras de Negócio

1. **JOGOS fora da tab bar, mas rota preservada:** a tab bar não linka mais para `/jogos`. O arquivo `app/(dashboard)/jogos/page.tsx` e todos os arquivos em `app/(dashboard)/jogos/` permanecem intactos. O usuário pode acessar `/jogos` diretamente pela URL.

2. **CHAT desabilitado sem grupo ativo:** se `groupId === ''` (usuário sem grupo), o botão CHAT na tab bar não abre o drawer. Visualmente aparece com `color-muted`, sem borderTop ativo, sem cursor pointer. Não exibe mensagem de erro — simplesmente não age.

3. **Badge de não lidas:** exibido apenas quando `chatOpen === false && chatUnreadCount > 0`. Ao abrir o bottom sheet (`chatOpen = true`), o `ChatPanelContent` zera o `unreadCount` internamente via `isVisible` mudando para `true`.

4. **Lazy-mount do ChatPanelContent:** montado na primeira abertura do ChatBottomSheet e nunca desmontado. A subscription Realtime de `group_messages` permanece ativa mesmo quando o drawer está fechado, garantindo que o contador de não lidas seja atualizado.

5. **Swipe-to-close:** arrastar o drag handle para baixo mais de 60px fecha o drawer com animação. Arrastar menos de 60px retorna ao estado aberto.

6. **Pull tab CHAT removido do SidePanelContainer:** o SidePanelContainer continua gerenciando ONTEM (recap) e AO VIVO (live today), mas o pull tab CHAT é removido. O acesso ao chat passa a ser exclusivamente pela aba CHAT da tab bar.

7. **Ordem das abas:** EU | RANKING | PALPITES | CHAT | MAIS (exatamente nessa ordem, da esquerda para a direita).

---

## Proteção de Rotas

Nenhuma rota nova. A tab bar é parte do dashboard protegido (layout.tsx já autentica).

---

## Integração Supabase Realtime

O `ChatPanelContent` já possui subscription ativa no canal `group-chat-${activeGroupId}` para `INSERT` em `group_messages`. Esta spec não altera essa lógica — apenas move onde o componente é renderizado (de `SidePanelContainer` para `ChatBottomSheet`).

---

## Critérios de Aceite

- [ ] Tab bar exibe exatamente 5 abas na ordem: EU, RANKING, PALPITES, CHAT, MAIS
- [ ] A aba JOGOS não aparece na tab bar
- [ ] Clicar em CHAT abre o bottom sheet com animação slide-up
- [ ] O bottom sheet de CHAT tem as mesmas dimensões e posição que `GameAnaliseDrawer` (bottom, left, right, maxHeight, borderRadius)
- [ ] Arrastar o drag handle > 60px para baixo fecha o drawer
- [ ] Clicar no backdrop fecha o drawer
- [ ] Pressionar ESC fecha o drawer
- [ ] Badge de não lidas aparece no botão CHAT quando há mensagens não lidas e o drawer está fechado
- [ ] Badge some ao abrir o drawer
- [ ] Mensagens carregam ao abrir o drawer pela primeira vez (lazy fetch)
- [ ] Subscription Realtime permanece ativa entre aberturas (sem duplo subscribe)
- [ ] Com `groupId === ''`, o botão CHAT não abre o drawer
- [ ] Pull tab CHAT não aparece mais no `SidePanelContainer`
- [ ] Painéis ONTEM e AO VIVO do `SidePanelContainer` funcionam sem regressão
- [ ] Rota `/jogos` e seus arquivos existem e funcionam ao acessar diretamente pela URL
- [ ] `npm run build` e `npm run lint` passam sem erros novos
- [ ] Design segue DESIGN.md: JetBrains Mono, tokens de cor (`color-surface`, `color-border`, `color-text`, `color-muted`, `color-primary`, `color-accent`), sem border-radius excessivo, sem sombras, estilo denso
- [ ] Funciona em mobile (viewport 375px): todas as 5 abas visíveis sem truncamento
