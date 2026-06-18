# Changelog: Chat do Grupo

**Slug:** group-chat
**Branch:** feature/group-chat
**Data:** 2026-06-18
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados
- Migration `supabase/migrations/20260618000001_create_group_messages.sql`:
  - Cria tabela `group_messages` com colunas `id`, `group_id`, `user_id`, `content` (máx 500 chars), `created_at`
  - Índice simples em `group_id` e índice composto em `(group_id, created_at DESC)` para leitura eficiente
  - RLS habilitada: policy `SELECT` e `INSERT` usando `is_group_member()` já existente
  - `ALTER PUBLICATION supabase_realtime ADD TABLE group_messages` para habilitar Realtime

### Frontend (Next.js/React)
- `components/bolao/GroupChatWidget.tsx` — Client Component com:
  - Chip minimizado (posição `fixed`, canto inferior direito) com badge de não lidas
  - Painel expandido com header, área de mensagens rolável, input de envio
  - Carregamento inicial das últimas 100 mensagens via Supabase
  - Subscription Realtime no canal `group-chat-${activeGroupId}` com filtro por `group_id`
  - Contador de não lidas persistido em `localStorage` sob chave `chat_last_read_${activeGroupId}`
  - Envio via `Enter` (sem `Shift`) ou botão `ENVIAR`; `Shift+Enter` insere quebra de linha
  - Mensagem de erro inline por 3 segundos em caso de falha no envio
  - Estado de carregamento (`CARREGANDO...`) e estado vazio (`SEM MENSAGENS. SEJA O PRIMEIRO!`)
  - Nome do próprio usuário em `color-primary`; outros usuários em `color-accent`
  - Animação de abertura: `scale(0.95) translateY(8px)` → `scale(1) translateY(0)`, 250ms `ease-out`
  - Cleanup correto da subscription Realtime no `useEffect` de desmontagem
  - Função auxiliar `resolveProfile()` para lidar com `profiles` retornado como array ou objeto pelo PostgREST

- `app/(dashboard)/layout.tsx` — modificado:
  - Import de `GroupChatWidget`
  - Renderização condicional `{activeGroup && <GroupChatWidget .../>}` abaixo do `<main>`, fora do container de `maxWidth: 960px`
  - Props passadas: `activeGroupId`, `activeGroupName`, `currentUserId`

---

## Decisões técnicas

- **Sem Route Handler nem API Ruby:** toda a comunicação com o banco é client-side via Supabase com RLS, conforme especificado. A anon key + RLS garantem isolamento por grupo.
- **Realtime não duplica mensagens do próprio usuário:** o INSERT do usuário não é adicionado otimisticamente — a mensagem aparece somente quando o evento Realtime retorna, garantindo que o `id` e `created_at` reais do banco sejam usados.
- **Busca de perfil no evento Realtime:** o payload do Realtime não inclui dados de join. Por isso, ao receber o evento `INSERT`, o componente faz um `SELECT` adicional em `profiles` para obter o nome do remetente. Para grupos pequenos (escopo do bolão), o custo é aceitável.
- **`resolveProfile()` helper:** o PostgREST pode retornar `profiles` como `{ name }` ou `[{ name }]` dependendo do contexto. A função normaliza o retorno sem suprimir tipos.
- **`isOpenRef`:** usado dentro do closure do Realtime para ler o valor atual de `isOpen` sem recriar a subscription a cada mudança de estado.
- **`activeGroupName` como prop:** o nome do grupo já está disponível no Server Component do layout, evitando um fetch adicional no cliente.

---

## Pontos de atenção para o Revisor

1. **Busca de perfil no Realtime:** verificar se a abordagem de buscar `profiles` em cada evento INSERT é aceitável para o escopo do bolão, ou se seria melhor manter um cache local de nomes já vistos nas mensagens carregadas inicialmente.
2. **Scroll automático:** o `messagesEndRef.scrollIntoView` é chamado toda vez que `messages` muda com o painel aberto — verificar se isso não conflita com o scroll manual do usuário lendo mensagens antigas.
3. **Mobile:** verificar em viewport estreita se o chip não cobre botões críticos (ex: botão de palpite). O `z-index: 50` pode sobrepor elementos interativos.
4. **Animação de fechamento:** a spec pede animação de fechamento (200ms `ease-in`), mas a implementação atual simplesmente troca para o chip sem animar o painel saindo — isso ocorre porque ao setar `isOpen = false` o painel é desmontado imediatamente. O Revisor deve avaliar se isso precisa ser resolvido com `AnimatePresence` (Framer Motion) ou uma solução CSS pura com estado de `isClosing`.

---

## Commits realizados

```
1a6572b fix(group-chat): corrige tipagem de profiles retornado pelo PostgREST
f3343e3 feat(group-chat): integra GroupChatWidget no layout do dashboard
3badcf0 feat(group-chat): implementa componente GroupChatWidget com Realtime e contador de não lidas
ec01eb8 feat(group-chat): cria migration para tabela group_messages com RLS e Realtime
3b2210b chore(group-chat): adiciona plano de implementação
```
