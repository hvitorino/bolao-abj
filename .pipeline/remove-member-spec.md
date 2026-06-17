# Spec: Remover Participante do Grupo

**Slug:** remove-member
**Data:** 2026-06-17
**Status:** spec

---

## Objetivo

Permitir que o admin de um grupo remova um participante diretamente pela tela de gerenciamento do grupo (`/grupos/[id]`). O admin vê um botão de remoção ao lado de cada membro (exceto ao lado de si mesmo); ao clicar, um modal de confirmação é exibido; após confirmação, o membro é excluído da tabela `group_members` via endpoint autenticado e a lista de participantes é atualizada imediatamente na UI.

---

## Histórias de Usuário

- Como admin de um grupo, quero poder remover um participante da lista de membros para controlar quem pertence ao meu bolão
- Como admin, quero confirmar a remoção antes de executá-la para evitar cliques acidentais
- Como membro, não quero ver botões de remoção na lista para não ter acesso a ações que não me cabem
- Como participante removido, quero que meu acesso ao grupo seja revogado imediatamente na próxima requisição que verificar minha membership

---

## Modelo de Dados

### Tabelas existentes (sem alteração de schema)

**`group_members`** — estrutura atual (migration `20260615120000_create_groups_and_members.sql`):

```sql
group_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
)
```

**RLS existente em `group_members`:** apenas `SELECT` para membros do próprio grupo via `is_group_member()`. Não há nenhuma policy de `DELETE` para o papel `authenticated` — toda escrita ocorre via `service_role` nos Route Handlers.

**Funções auxiliares existentes:**
- `is_group_member(p_group_id uuid, p_user_id uuid) → boolean` — verifica membership (SECURITY DEFINER)
- `is_group_admin(p_group_id uuid, p_user_id uuid) → boolean` — verifica se é admin (SECURITY DEFINER, criada em `20260616120000_create_group_invites.sql`)

### Migrations necessárias

Nenhuma migration de schema é necessária. Não há nova tabela, nova coluna, nem nova policy de RLS. A deleção será feita via `service_role` no Route Handler, exatamente como já ocorre em todos os outros endpoints de escrita de `group_members` (criação de grupo, entrada via convite).

---

## Backend — Endpoints Next.js Route Handlers

### DELETE /api/groups/[id]/members/[userId]

**Arquivo:** `app/api/groups/[id]/members/[userId]/route.ts`

**Autenticação:** requerida — Bearer JWT no header `Authorization`

**Parâmetros de rota:**
- `id` — UUID do grupo
- `userId` — UUID do membro a remover

**Resposta de sucesso (200):**
```json
{ "removed": true, "group_id": "<uuid>", "user_id": "<uuid>" }
```

**Erros possíveis:**
- `400` — `id` ou `userId` não são UUIDs válidos
- `401` — header `Authorization: Bearer <jwt>` ausente ou JWT inválido
- `403` — chamador não é membro do grupo, ou não é admin, ou está tentando remover a si mesmo
- `404` — grupo não encontrado
- `422` — membro alvo não existe em `group_members` para este grupo
- `500` — erro interno ao consultar ou deletar

**Lógica de implementação:**

```
1. Autenticar chamador: extrair JWT de `Authorization: Bearer`, validar via supabase-anon-key → obter `callerId`
2. Validar UUIDs: `id` e `userId` devem ser UUIDs v4 válidos (reutilizar `isValidUUID()` já existente em /api/groups/[id]/route.ts)
3. Verificar que grupo existe (via serviceClient): SELECT id FROM groups WHERE id = $id → 404 se não encontrado
4. Verificar membership do chamador (via serviceClient): SELECT role FROM group_members WHERE group_id = $id AND user_id = $callerId → 403 se ausente
5. Verificar que chamador é admin: role !== 'admin' → 403 ("Apenas o admin pode remover participantes.")
6. Verificar que chamador não está tentando remover a si mesmo: callerId === userId → 403 ("O admin não pode remover a si mesmo.")
7. Verificar que o alvo é membro do grupo: SELECT id FROM group_members WHERE group_id = $id AND user_id = $userId → 422 se não encontrado
8. Executar deleção: DELETE FROM group_members WHERE group_id = $id AND user_id = $userId (via serviceClient)
9. Retornar 200 com { removed: true, group_id: id, user_id: userId }
```

**Padrão a seguir:** `app/api/groups/[id]/route.ts` (função `DELETE`) — mesmas funções `authenticate()`, `isValidUUID()`, `serviceClient()`.

---

## Frontend — Componentes React

### RemoveMemberButton

**Arquivo:** `components/bolao/RemoveMemberButton.tsx`

**Props:**
```typescript
interface RemoveMemberButtonProps {
  groupId: string
  userId: string       // UUID do membro a remover
  memberName: string   // nome do membro (para exibir no modal)
  onRemoved: () => void  // callback chamado após remoção bem-sucedida
}
```

**Estados internos:**
```typescript
type ButtonState = 'idle' | 'confirming' | 'loading' | 'error'
```

**Comportamento:**

1. **idle**: exibe um botão `[REMOVER]` com estilo `border: 1px solid var(--color-error)`, `color: var(--color-error)`, `background: transparent`, `fontSize: 11px`, `textTransform: 'uppercase'`, `letterSpacing: '0.05em'`, `padding: '0.2rem 0.5rem'`. Clique abre modal.

2. **confirming**: exibe o modal de confirmação (ver abaixo). Botão "CANCELAR" volta para idle. Botão "CONFIRMAR" chama o endpoint.

3. **loading**: mantém modal aberto, botão de confirmação exibe "REMOVENDO..." e fica desabilitado.

4. **error**: mantém modal aberto, exibe mensagem de erro inline em `color-error`. Botão "CANCELAR" volta para idle; botão "TENTAR NOVAMENTE" reinicia o fetch.

**Modal de confirmação:**
- Overlay: `position: fixed; inset: 0; background: rgba(10,14,26,0.85); zIndex: 50`
- Caixa: `background: var(--color-surface); border: 1px solid var(--color-error); maxWidth: 420px`
- Header: texto `REMOVER PARTICIPANTE` em `color-error`, `fontSize: 14px`, `bold`, `uppercase`
- Corpo: `"Você está prestes a remover <NOME> deste grupo."` em `color-text`, `fontSize: 13px`. Linha abaixo: `"Esta ação é reversível — o participante pode entrar novamente via link de convite."` em `color-muted`, `fontSize: 12px`.
- Rodapé: botão `CANCELAR` (border `color-muted`, text `color-muted`) e botão `CONFIRMAR REMOÇÃO` (background `color-error`, text `color-bg`)
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` apontando para o título

**Chamada ao endpoint:**
```typescript
const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${session.access_token}` },
})
```
- Em caso de sucesso (`res.ok`): fechar modal, chamar `onRemoved()`
- Em caso de erro: ler `body.message`, exibir no modal, mudar estado para `error`

---

### Alterações em `/grupos/[id]/page.tsx`

A página já é um Server Component que busca `members` via Supabase diretamente. Para suportar a remoção otimista sem necessidade de Server Actions ou reload completo, o array de participantes precisa ser gerenciável no cliente.

**Abordagem:** extrair a seção de lista de participantes para um Client Component.

**Novo arquivo:** `components/bolao/MembersList.tsx`

**Props:**
```typescript
interface MembersListProps {
  groupId: string
  initialMembers: GroupMemberEntry[]
  currentUserId: string  // ID do usuário logado
  isAdmin: boolean
}
```

**Comportamento:**
- Estado interno: `members` iniciado com `initialMembers`
- Para cada `member` na lista: se `isAdmin && member.userId !== currentUserId`, renderizar `<RemoveMemberButton>` ao lado do badge de papel
- Callback `onRemoved` passado ao `RemoveMemberButton`: filtrar o membro removido do estado `members` localmente (atualização otimista imediata, sem reload de página)
- Não-admin (`isAdmin === false`): nunca renderiza `<RemoveMemberButton>` em nenhuma linha

**Layout da linha de membro (admin vendo outro membro):**
```
• NOME DO MEMBRO                    MEMBRO  [REMOVER]
```
O botão `[REMOVER]` é inserido após o badge de papel, alinhado à direita via `display: flex; justifyContent: 'space-between'; alignItems: 'center'`. A estrutura interna da linha deve acomodar três elementos: nome à esquerda, badge de papel e botão de remoção agrupados à direita.

**Layout da linha de membro admin (o próprio admin ou outro admin):**
```
• NOME DO ADMIN                      ADMIN
```
Sem botão de remoção.

**Alteração na `page.tsx`:** substituir o bloco `<div>` da seção "PARTICIPANTES" pelo componente `<MembersList>`, passando `initialMembers={members}`, `currentUserId={user.id}`, `isAdmin={isAdmin}`, `groupId={id}`.

---

## Regras de Negócio

1. **Admin não se remove:** o endpoint retorna `403` e o frontend nunca exibe o botão de remoção ao lado da linha do próprio admin. Dupla defesa: frontend (não renderiza) + backend (valida `callerId !== userId`).

2. **Apenas admin pode remover:** endpoint valida `role === 'admin'` antes de executar. Frontend só renderiza os botões quando `isAdmin === true`.

3. **Sem nó de substituição de admin:** se o grupo só tiver o admin como membro, não há membros para remover — os botões simplesmente não aparecem. Não é necessário tratar transferência de admin role nesta feature.

4. **Acesso revogado imediatamente:** após a deleção de `group_members`, todas as policies de RLS que dependem de `is_group_member()` passam a negar acesso. Na próxima requisição autenticada do membro removido que verificar membership (ex: carregar `/grupos/[id]` ou qualquer endpoint protegido do grupo), ele receberá `403` ou `not_found`. Não há mecanismo de notificação ativa do membro removido.

5. **Dados de palpites e scores:** não são deletados ao remover o membro. O membro removido deixa de ter acesso ao grupo, mas seus palpites e scores permanecem no banco como registro histórico. Esta decisão mantém a integridade do histórico do bolão.

6. **Atualização de lista após remoção:** a lista de participantes no client Component remove o membro do estado local imediatamente após o callback `onRemoved` ser chamado (atualização otimista). Não é feito reload de página nem novo fetch à API.

7. **Remoção de membro inexistente:** se `userId` não existe em `group_members` para o `group_id`, o endpoint retorna `422` com mensagem clara.

---

## Proteção de Rotas

Nenhuma rota nova de página. O novo endpoint de API tem autenticação e autorização próprias:

- `DELETE /api/groups/[id]/members/[userId]`: requer Bearer JWT válido + role admin no grupo + `callerId !== userId`
- A página `/grupos/[id]` já é protegida (redirect para `/login` se usuário não autenticado)

---

## Integração Supabase Realtime

Não aplicável nesta feature. A atualização da lista é feita localmente no estado do Client Component após confirmação do endpoint, sem canal Realtime.

---

## Critérios de Aceitação

- [ ] Endpoint `DELETE /api/groups/[id]/members/[userId]` retorna `200` com `{ removed: true }` quando chamador é admin e remove outro membro
- [ ] Endpoint retorna `401` quando sem Bearer JWT
- [ ] Endpoint retorna `403` quando chamador não é admin
- [ ] Endpoint retorna `403` quando chamador tenta remover a si mesmo
- [ ] Endpoint retorna `404` quando grupo não existe
- [ ] Endpoint retorna `422` quando `userId` não é membro do grupo
- [ ] Admin vê botão `[REMOVER]` ao lado de cada membro que não é ele mesmo
- [ ] Admin não vê botão `[REMOVER]` ao lado da própria linha
- [ ] Membro não-admin não vê nenhum botão `[REMOVER]`
- [ ] Ao clicar em `[REMOVER]`, aparece modal com nome do participante e pedido de confirmação
- [ ] Botão "CANCELAR" fecha o modal sem executar remoção
- [ ] Botão "CONFIRMAR REMOÇÃO" chama o endpoint e exibe estado de loading
- [ ] Após remoção bem-sucedida, o membro desaparece da lista sem reload de página
- [ ] Em caso de erro no endpoint, o modal exibe a mensagem de erro sem fechar
- [ ] O membro removido perde acesso ao grupo na próxima requisição que verificar membership
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta `color-error`/`color-muted`/`color-text`, dark only, dense, sem ícones decorativos SVG, bordas simples 1px
- [ ] Funciona em mobile (coluna única, botão `[REMOVER]` visível na mesma linha sem quebra de layout)
- [ ] `npm run lint` e `npm run build` sem erros

---

## O que NÃO está no escopo desta feature

- Transferência de role de admin para outro membro (promoção de `member` para `admin`)
- Notificação ao membro removido (não há websocket de sessão nem e-mail configurado)
- Deleção dos palpites/scores do membro removido (os dados históricos permanecem)
- Banimento permanente (membro removido pode re-entrar via link de convite)
- Remoção em massa de múltiplos membros simultaneamente
- Audit log de remoções
