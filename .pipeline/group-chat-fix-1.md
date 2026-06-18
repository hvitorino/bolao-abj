# Fix 1: Chat do Grupo

**Slug:** group-chat
**Data:** 2026-06-18
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Subscription Realtime iniciada após fetch, não na montagem
**Arquivo:** `components/bolao/GroupChatWidget.tsx` (linha 89–135)
**Severidade:** crítico
**Descrição:** A spec define que o Realtime deve ser assinado na montagem do componente ("ao montar, assina o canal"). Na implementação, a subscription só é criada após `hasFetched === true`, que só ocorre quando o usuário abre o painel pela primeira vez. Consequências: (a) mensagens enviadas por outros usuários enquanto o painel está fechado e o widget ainda não foi aberto sequer uma vez não incrementam `unreadCount` nem aparecem na lista; (b) o contador de não lidas — principal UX de aviso — não funciona na sessão inicial até a primeira abertura manual.
**Correção esperada:** Separar a subscription Realtime do fluxo de fetch. O `useEffect` que cria o canal deve depender apenas de `activeGroupId` e `supabase`, sem a guarda `if (!hasFetched) return`. O payload do evento INSERT deve ser enfileirado em um buffer interno se o fetch ainda não ocorreu, ou simplesmente adicionado à lista e incrementado `unreadCount` diretamente — já que o painel está fechado nesse momento. Após o fetch inicial (primeira abertura), mensagens no buffer (se houver) devem ser mescladas evitando duplicação por `id`.

Uma abordagem mais simples: iniciar o Realtime imediatamente no mount e manter a lógica atual de adicionar mensagem + incrementar contador; ao fazer o fetch inicial, fazer `setMessages` com as 100 mensagens e remover do `unreadCount` as que já foram carregadas pelo fetch (ou simplesmente recalcular com base em `lastReadAt` como já é feito). Isso evita o buffer.

### Problema 2: Animação de fechamento ausente
**Arquivo:** `components/bolao/GroupChatWidget.tsx` (linha 283–310, renderização condicional chip/painel)
**Severidade:** importante
**Descrição:** A spec exige animação de fechamento explicitamente: `transform: scale(0.95) translateY(8px)`, `opacity: 0`, duração 200ms, easing `ease-in`. O Programador reportou no changelog que a animação de fechamento não foi implementada porque ao setar `isOpen = false` o painel é desmontado imediatamente. O critério de aceite "[X] Ao clicar em [X], o painel contrai de volta ao chip com animação (200ms)" não está satisfeito.
**Correção esperada:** Implementar um estado intermediário de fechamento. A abordagem recomendada é CSS puro com um estado `isClosing: boolean`:
1. Ao clicar em [X]: setar `isClosing = true` (não altera `isOpen` imediatamente)
2. O painel, quando `isClosing === true`, aplica a animation `chatClose` via `@keyframes chatClose { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.95) translateY(8px); opacity: 0; } }` com duração 200ms `ease-in` e `animation-fill-mode: forwards`
3. Ao fim da animação (`onAnimationEnd`), setar `isOpen = false` e `isClosing = false`
Isso mantém o painel montado durante a animação de saída e só o troca pelo chip após concluir.

### Problema 3: `overflowAnchor: 'none'` causa scroll indesejado durante leitura de histórico
**Arquivo:** `components/bolao/GroupChatWidget.tsx` (linha 364)
**Severidade:** importante
**Descrição:** A área de mensagens tem `overflowAnchor: 'none'`, desabilitando o comportamento nativo de âncora de scroll do browser. O scroll automático ao final é feito via `useEffect` que chama `messagesEndRef.current?.scrollIntoView` sempre que `messages` muda e `isOpen === true`. Isso significa que, se o usuário rolou para cima para ler mensagens antigas, qualquer nova mensagem via Realtime vai forçosamente puxar a tela de volta ao final, impedindo a leitura do histórico.
**Correção esperada:** Implementar scroll automático inteligente: só rolar ao final automaticamente quando o usuário JÁ estiver perto do final (últimos ~80px da área de mensagens). Adicionar um estado `isScrolledToBottom: boolean` calculado via `onScroll` no container. Modificar o `useEffect` que chama `scrollIntoView` para só executar quando `isScrolledToBottom === true`. Mudar `overflowAnchor` de `'none'` para `'auto'` para que o browser use o âncora nativo quando o usuário está no final.

---

## Itens OK (não precisam ser revisados novamente)

- Migration `supabase/migrations/20260618000001_create_group_messages.sql`: tabela, índices, RLS (SELECT e INSERT com `is_group_member`) e publicação Realtime estão corretos e idênticos à spec
- Renderização condicional `{activeGroup && <GroupChatWidget .../>}` no layout: correto
- Props `activeGroupName` adicionada: extensão válida, necessária para exibir nome no header — a spec define apenas `activeGroupId` e `currentUserId` mas não proíbe props adicionais
- Chip minimizado: visual, badge de não lidas, largura mínima, padding, cursor corretos
- Painel expandido: header, área de mensagens, input, botão ENVIAR — todos seguem a spec
- `resolveProfile()`: helper correto para normalizar retorno do PostgREST
- `isOpenRef`: uso correto para evitar stale closure no Realtime
- Envio via Enter/Shift+Enter: correto
- Limite de 500 caracteres: validação frontend + `maxLength` no textarea + CHECK na migration
- Estados de carregamento e vazio: textos corretos conforme spec
- Nome próprio em `color-primary`, outros em `color-accent`: correto
- JetBrains Mono em todos os elementos: correto
- Sem border-radius nos elementos (bordas retas): correto
- Sem ícones decorativos: correto
- Design dark-only com tokens CSS corretos: correto
- Cleanup da subscription no desmonte: `supabase.removeChannel(channel)` no return do useEffect
- Animação de abertura (`chatOpen`, 250ms ease-out): correta
- `localStorage` sob chave `chat_last_read_${activeGroupId}`: correto
- Envio sem adição otimística (aguarda evento Realtime): correto, evita duplicação
- Mensagem de erro inline por 3 segundos: correto
- `isSending` desabilita textarea e botão: correto
- Mobile: `width: min(320px, calc(100vw - 3rem))` e `maxHeight: min(480px, 60vh)`: cobre os requisitos de mobile da spec
- Commits em português com prefixo correto (`feat`, `fix`, `chore`): correto
- Branch `feature/group-chat`: correto
- Sem Route Handler Ruby nem Next.js: correto conforme spec (100% client-side + Supabase)
