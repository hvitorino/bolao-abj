# Fix 2: Chat do Grupo

**Slug:** group-chat
**Data:** 2026-06-18
**Rodada de revisão:** 2

---

## Problemas Encontrados

### Problema 1: Recálculo redundante e incorreto de `unreadCount` dentro de `loadMessages`
**Arquivo:** `components/bolao/GroupChatWidget.tsx` — função `loadMessages` (linhas 74–86) e `handleOpen` (linhas 142–159)
**Severidade:** importante
**Descrição:** `handleOpen` zera `unreadCount` com `setUnreadCount(0)` e grava o timestamp atual em `localStorage` antes de chamar `loadMessages`. Dentro de `loadMessages`, o código recalcula `unreadCount` com base em `lastReadAt` — mas o `lastReadAt` lido do `localStorage` nesse momento já é o timestamp recém-gravado pelo `handleOpen`, então o recálculo sempre resulta em 0 ou quase 0 mensagens. O bloco é tecnicamente inócuo na prática, mas é conceitualmente incorreto: o painel já está aberto quando `loadMessages` roda, e recalcular o contador de não lidas nesse momento é errado por definição. Se por alguma razão o `localStorage.setItem` do `handleOpen` não tiver rodado antes do `localStorage.getItem` do `loadMessages` (race de microtask), o recálculo pode setar o `unreadCount` para um valor não-zero com o painel já visível, causando flash visual indesejado no chip (que não está renderizado quando `isOpen === true`, mas o estado incorreto persiste para quando o painel fechar).

**Correção esperada:** Remover o bloco de recálculo de `unreadCount` dentro de `loadMessages`. O único lugar que deve zerar o contador é `handleOpen`, que já o faz antes de chamar `loadMessages`. `loadMessages` deve ser responsável apenas por buscar e setar `messages` e marcar `hasFetched = true`.

```typescript
// REMOVER de loadMessages:
const lastReadAt =
  typeof window !== 'undefined'
    ? localStorage.getItem(localStorageKey)
    : null
if (lastReadAt) {
  const unread = msgs.filter((m) => m.created_at > lastReadAt).length
  setUnreadCount(unread)
}
```

### Problema 2: `handleAnimationEnd` não filtra pelo nome da animação
**Arquivo:** `components/bolao/GroupChatWidget.tsx` — função `handleAnimationEnd` (linhas 167–172) e uso em `onAnimationEnd` (linha 301)
**Severidade:** importante
**Descrição:** O evento `animationend` no elemento raiz do painel faz bubbling — qualquer animação CSS que termine em um elemento filho também dispara o `onAnimationEnd` do pai. Atualmente não há animações filhas, mas o `handleAnimationEnd` não verifica `e.animationName`, então qualquer futura adição de animação CSS em elementos internos (hover states, loading spinners, etc.) fecharia o painel prematuramente durante o estado `isClosing`. A correção correta é verificar `e.animationName === 'chatClose'` antes de executar a lógica de fechamento.

**Correção esperada:** Adicionar o parâmetro `e: React.AnimationEvent` e filtrar por `e.animationName`:

```typescript
const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
  if (isClosing && e.animationName === 'chatClose') {
    setIsOpen(false)
    setIsClosing(false)
  }
}, [isClosing])
```

---

## Itens OK (não precisam ser revisados novamente)

- Migration `supabase/migrations/20260618000001_create_group_messages.sql`: aprovado na revisão 1, não alterado
- Integração no `app/(dashboard)/layout.tsx`: aprovado na revisão 1, não alterado
- Subscription Realtime na montagem (fix-1 correção 1): correto
- Deduplicação por `id` no callback do Realtime: correto
- Animação de fechamento com `isClosing` + `chatClose` (fix-1 correção 2): correto
- Guarda `!isOpen && !isClosing` no chip: correto
- Scroll inteligente com `isScrolledToBottom` e limiar 80px (fix-1 correção 3): correto
- `overflowAnchor: 'auto'`: correto
- Todos os itens aprovados no fix-1 permanecem aprovados
