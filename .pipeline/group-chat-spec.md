# Spec: Chat do Grupo

**Slug:** group-chat
**Data:** 2026-06-18
**Status:** spec

---

## Objetivo

Criar uma funcionalidade de troca de mensagens escopada ao grupo ativo do bolão. Um chip flutuante fixo no canto inferior direito do layout do dashboard expande em um painel de chat ao ser clicado. As mensagens são visíveis a todos os membros do grupo, persistidas no Supabase e atualizadas em tempo real. Quando o painel está minimizado e existem mensagens não lidas desde a última abertura, o chip exibe um contador de não lidas.

---

## Histórias de Usuário

- Como participante do bolão, quero enviar e ler mensagens do meu grupo sem sair da tela atual, para comentar os jogos sem perder o contexto
- Como participante, quero ver as mensagens atualizadas em tempo real, para acompanhar a conversa sem precisar recarregar a página
- Como participante, quero saber quantas mensagens não li enquanto o chat está fechado, para decidir quando abrir o painel
- Como participante, quero que o chip do chat esteja sempre visível em qualquer página do dashboard, para não precisar navegar para uma seção específica

---

## Modelo de Dados

### Tabela nova: `group_messages`

```sql
CREATE TABLE group_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_messages_group_id    ON group_messages(group_id);
CREATE INDEX idx_group_messages_created_at  ON group_messages(group_id, created_at DESC);
```

### RLS — `group_messages`

```sql
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: somente membros do grupo podem ler mensagens
CREATE POLICY "group_messages_select_member"
  ON group_messages FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

-- INSERT: somente membros do grupo podem escrever, e apenas como si mesmos
CREATE POLICY "group_messages_insert_member"
  ON group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id, auth.uid())
  );
```

Nota: a função `is_group_member(p_group_id uuid, p_user_id uuid)` já existe (`SECURITY DEFINER`, criada na migration `create_groups_and_members`). Não recriar.

### Realtime — publicação da tabela

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
```

### Migrations necessárias

1. `20260618000001_create_group_messages.sql` — cria a tabela `group_messages`, índices, RLS e habilita publicação no Realtime.

---

## Backend

Esta feature é **100% client-side + Supabase direto**. Não há endpoint Ruby nem Route Handler Next.js para criar ou listar mensagens. O cliente browser usa o Supabase anon key com RLS garantindo o isolamento por grupo.

- **Leitura inicial:** `supabase.from('group_messages').select('id, content, created_at, user_id, profiles(name)').eq('group_id', activeGroupId).order('created_at', { ascending: true }).limit(100)`
- **Envio:** `supabase.from('group_messages').insert({ group_id: activeGroupId, user_id: session.user.id, content })`
- **Realtime:** canal `group-chat-${activeGroupId}`, evento `INSERT` na tabela `group_messages` com filtro `group_id=eq.${activeGroupId}`

O join com `profiles(name)` funciona via Supabase PostgREST porque `profiles` tem RLS permissiva para autenticados (SELECT sem filtro adicional).

---

## Frontend — Componentes React

### `GroupChatWidget`

**Arquivo:** `components/bolao/GroupChatWidget.tsx`
**Tipo:** Client Component (`'use client'`)

**Props:**
```typescript
interface GroupChatWidgetProps {
  activeGroupId: string
  currentUserId: string
}
```

**Estados internos:**
- `isOpen: boolean` — controla expansão/contração do painel
- `messages: ChatMessage[]` — lista de mensagens carregadas e recebidas via Realtime
- `newMessage: string` — conteúdo do input de envio
- `isLoading: boolean` — carregamento inicial das mensagens
- `isSending: boolean` — envio em andamento
- `unreadCount: number` — mensagens recebidas enquanto `isOpen === false`
- `lastReadAt: string | null` — ISO timestamp do momento em que o painel foi aberto pela última vez (persiste em `localStorage` sob chave `chat_last_read_${activeGroupId}`)

**Tipo `ChatMessage`:**
```typescript
interface ChatMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { name: string } | null
}
```

**Comportamento:**

1. **Montagem:** busca as últimas 100 mensagens do grupo via Supabase. Define `isLoading: true` até a resposta chegar. Lê `chat_last_read_${activeGroupId}` do `localStorage` para inicializar `lastReadAt`. Calcula `unreadCount` como o número de mensagens com `created_at > lastReadAt` (ou 0 se `lastReadAt` for null).

2. **Realtime:** ao montar, assina o canal `group-chat-${activeGroupId}` com filtro `group_id=eq.${activeGroupId}` e evento `INSERT`. Ao receber uma nova mensagem:
   - Se `isOpen === true`: acrescenta à lista `messages` e não altera `unreadCount` (o usuário está vendo)
   - Se `isOpen === false`: acrescenta à lista e incrementa `unreadCount`

3. **Abrir painel (`isOpen = true`):** grava `new Date().toISOString()` em `localStorage` sob `chat_last_read_${activeGroupId}` e zera `unreadCount`. Rola a lista de mensagens para o final após a animação de abertura (500ms).

4. **Fechar painel (`isOpen = false`):** contrai para chip. Mantém `messages` em memória — a próxima abertura não refaz o fetch (as mensagens novas chegam via Realtime).

5. **Enviar mensagem:**
   - Valida `newMessage.trim().length > 0` e `newMessage.length <= 500`
   - Define `isSending: true`
   - Chama `supabase.from('group_messages').insert(...)` diretamente (sem Route Handler)
   - Em sucesso: limpa o campo `newMessage`, mantém foco no input
   - Em erro: exibe mensagem de erro inline em `color-error` por 3 segundos
   - `isSending: false` sempre ao final

6. **Envio por teclado:** `Enter` (sem Shift) envia a mensagem. `Shift+Enter` insere quebra de linha. Limitar o `textarea` a 3 linhas visíveis (CSS `max-height` + `overflow-y: auto`).

7. **Desmontagem:** cancela a subscription do Realtime (`channel.unsubscribe()`).

**Animação:**
- Usar CSS `transition` com `transform` e `opacity`:
  - Chip → aberto: `transform: scale(1) translateY(0)`, `opacity: 1`, duração 250ms, easing `ease-out`
  - Aberto → chip: `transform: scale(0.95) translateY(8px)`, `opacity: 0`, duração 200ms, easing `ease-in`
- O painel chat tem `position: fixed`, `bottom: 1.5rem`, `right: 1.5rem`, `z-index: 50`
- Em mobile (`max-width: 640px`): painel ocupa `width: calc(100vw - 3rem)`, `max-height: 60vh`
- Em desktop: `width: 320px`, `max-height: 480px`

**Layout do Chip (minimizado):**
```
┌──────────────────┐
│  CHAT  [ 3 ]     │
└──────────────────┘
```
- Fundo: `color-surface`, borda `1px solid color-border`
- Texto `CHAT`: uppercase, `color-accent`, JetBrains Mono bold 12px
- Contador (quando `unreadCount > 0`): badge retangular (sem border-radius), fundo `color-primary`, texto `color-bg`, bold, mostra o número; omitido quando 0
- Largura mínima: `96px`; padding: `0.375rem 0.75rem`
- Cursor: `pointer`

**Layout do Painel (expandido):**
```
┌────────────────────────────────────┐
│  CHAT — BOLÃO DA INGRISIA ABJ  [X] │
├────────────────────────────────────┤
│  HAMON  · 15:42                    │
│  Vai Brasil!                       │
│                                    │
│  RODRIGO  · 15:43                  │
│  Na veia!                          │
│                                    │
│  (área rolável — flex-col-reverse) │
├────────────────────────────────────┤
│  [ textarea                     ]  │
│  [ ENVIAR ]                        │
└────────────────────────────────────┘
```
- Header: `CHAT — <NOME DO GRUPO>` uppercase `color-text`, botão `[X]` no canto direito fecha o painel (`color-muted`, transição para `color-text` no hover)
- Área de mensagens: `overflow-y: auto`, fundo `color-bg`, padding `0.5rem`; usar `flex-direction: column` com `overflow-anchor` para scroll automático ao final
- Cada mensagem:
  - Linha 1: `<NOME>  ·  HH:MM` — `color-accent` (nome próprio) e `color-muted` (hora), uppercase, 11px
  - Linha 2: conteúdo da mensagem — `color-text`, 13px, preserve-whitespace
  - Mensagens do próprio usuário: nome em `color-primary` em vez de `color-accent`
  - Separação entre mensagens: `margin-bottom: 0.75rem`
- Input de envio:
  - `textarea` com placeholder `MENSAGEM...`, fundo `color-surface`, borda `1px solid color-border`, `color-text`, font JetBrains Mono 12px, resize `none`, 2 linhas de altura; foco: borda `color-primary`
  - Botão `ENVIAR`: fundo `color-primary`, texto `color-bg`, uppercase, bold, desabilitado quando `newMessage.trim() === '' || isSending`; durante envio: texto `ENVIANDO...`

**Estado de carregamento:** enquanto `isLoading === true`, exibir três linhas `CARREGANDO...` em `color-muted` na área de mensagens.

**Estado vazio:** quando `messages.length === 0` e `!isLoading`, exibir `SEM MENSAGENS. SEJA O PRIMEIRO!` centralizado em `color-muted`.

---

### Integração no Layout

**Arquivo:** `app/(dashboard)/layout.tsx` (modificar)

O `DashboardLayout` já é Server Component e já resolve `activeGroup` do cookie. Deve importar e renderizar `<GroupChatWidget>` abaixo do `<main>`, fora do container `maxWidth: 960px`, passando:
- `activeGroupId={activeGroup.id}` (ou string vazia se `activeGroup` for undefined — nesse caso o widget não deve renderizar; usar renderização condicional `activeGroup && <GroupChatWidget ...>`)
- `currentUserId={user.id}`

O widget deve ficar **fora** do fluxo do documento (posição `fixed`), então a posição no JSX não afeta o layout visual.

---

## Regras de Negócio

1. **Escopo por grupo:** mensagens são sempre escopadas ao `activeGroupId` lido da prop. O widget nunca mistura mensagens de grupos distintos.

2. **Limite de caracteres:** máximo 500 caracteres por mensagem. O frontend bloqueia o envio se `content.length > 500`. O banco tem `CHECK (char_length(content) BETWEEN 1 AND 500)` como segunda linha de defesa.

3. **Limite de histórico:** carregar apenas as últimas 100 mensagens na abertura inicial (`.limit(100)`). Não há paginação; mensagens mais antigas ficam inacessíveis pelo chat (aceitável para o escopo desta feature).

4. **Mensagens novas chegam via Realtime:** o INSERT do próprio usuário também chega pelo canal Realtime. Para evitar duplicação, **não** adicionar otimisticamente a mensagem enviada à lista local — aguardar o evento Realtime. Isso garante que a mensagem exibida tem o `id` e `created_at` reais do banco.

5. **Contagem de não lidas:** baseada em `localStorage`. Se o usuário abre em uma nova aba ou outro dispositivo, o contador começa do zero (sem sincronização cross-device). Isso é aceitável.

6. **Grupo sem membros:** se `activeGroup` for `undefined` (usuário não pertence a nenhum grupo), o widget não é renderizado.

7. **Conteúdo vazio:** mensagens com `content.trim() === ''` não são enviadas (validação client-side).

---

## Proteção de Rotas

Não há rota nova. O widget é montado somente dentro de `app/(dashboard)/layout.tsx`, que já garante autenticação via `supabase.auth.getUser()` e redireciona para `/login` se não autenticado.

As políticas RLS no Supabase garantem isolamento de dados mesmo que o client seja manipulado.

---

## Integração Supabase Realtime

- **Tabela:** `group_messages`
- **Evento:** `INSERT`
- **Canal:** `group-chat-${activeGroupId}`
- **Filtro:** `group_id=eq.${activeGroupId}`
- **O que fazer ao receber:** acrescentar a mensagem ao array `messages` (imutavelmente, via `setMessages(prev => [...prev, newMsg])`); se `isOpen === false`, incrementar `unreadCount`
- **Setup:**
```typescript
const channel = supabase
  .channel(`group-chat-${activeGroupId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'group_messages',
      filter: `group_id=eq.${activeGroupId}`,
    },
    (payload) => handleNewMessage(payload.new as ChatMessage)
  )
  .subscribe()
```
- **Limpeza:** `return () => { supabase.removeChannel(channel) }` no `useEffect` de cleanup

---

## Critérios de Aceite

- [ ] Chip `CHAT` visível no canto inferior direito em todas as páginas do dashboard (`/jogos`, `/ranking`, `/meus-palpites`, `/grupos`, `/grupos/[id]`)
- [ ] Chip não aparece quando o usuário não pertence a nenhum grupo
- [ ] Ao clicar no chip, o painel expande com animação suave (250ms)
- [ ] Ao clicar em `[X]`, o painel contrai de volta ao chip com animação (200ms)
- [ ] Mensagens são carregadas ao expandir o painel pela primeira vez
- [ ] Mensagens novas aparecem sem reload via Supabase Realtime
- [ ] Mensagem enviada com Enter aparece na lista após confirmação do Realtime (sem duplicação)
- [ ] Shift+Enter insere quebra de linha sem enviar
- [ ] Botão `ENVIAR` funciona equivalentemente ao Enter
- [ ] Contador de não lidas aparece no chip quando fechado e há mensagens novas
- [ ] Contador some ao abrir o painel
- [ ] Contador persiste entre navegações de página (widget remontado mas `localStorage` preserva o estado)
- [ ] Mensagens exibem nome do remetente, hora e conteúdo
- [ ] Nome do próprio usuário aparece em `color-primary`; outros usuários em `color-accent`
- [ ] Mensagens com mais de 500 caracteres são bloqueadas no frontend
- [ ] Estado vazio (`SEM MENSAGENS. SEJA O PRIMEIRO!`) quando não há histórico
- [ ] Estado de carregamento (`CARREGANDO...`) visível enquanto busca mensagens
- [ ] Migração cria tabela `group_messages` com RLS correta (membros leem e escrevem, outros não)
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, sem border-radius, dark only, sem ícones decorativos
- [ ] Funciona em mobile: painel ocupa `calc(100vw - 3rem)`, `max-height: 60vh`
- [ ] Chip não obstrui elementos de UI críticos (ex: botão de palpite) — verificar em viewport móvel estreita
