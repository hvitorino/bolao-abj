# Spec: Exclusão de Grupo pelo Admin

**Slug:** delete-group
**Data:** 2026-06-17
**Status:** spec

---

## Objetivo

Permitir que o admin de um grupo o exclua diretamente pela tela `/grupos/[id]`, com confirmação explícita via modal. A exclusão remove em cascata todos os palpites (`predictions`) e scores (`scores`) vinculados ao grupo, sem afetar `profiles`, `auth.users` ou o grupo ativo de outros grupos.

---

## Histórias de Usuário

- Como admin de um grupo, quero poder excluir o grupo para encerrar o bolão definitivamente, removendo todos os palpites e pontuações associados.
- Como admin, quero ser alertado com clareza antes de confirmar a exclusão de que os palpites e scores serão permanentemente deletados e que os perfis dos participantes não serão afetados.
- Como não-admin (membro ou usuário externo), quero que a opção de excluir grupo seja invisível para mim, sem nenhuma rota de acesso à ação.

---

## Modelo de Dados

### Tabelas afetadas

Nenhuma tabela nova é criada. A exclusão de um grupo deleta em cascata:

| Tabela | Efeito | FK de suporte |
|--------|--------|---------------|
| `groups` | Linha deletada | — |
| `group_members` | Deletado em cascata | `group_members.group_id REFERENCES groups(id) ON DELETE CASCADE` |
| `predictions` | Deletado em cascata | `predictions.group_id REFERENCES groups(id) ON DELETE CASCADE` |
| `scores` | Deletado em cascata | `scores.group_id REFERENCES groups(id) ON DELETE CASCADE` |
| `group_invites` | Deletado em cascata | `group_invites.group_id REFERENCES groups(id) ON DELETE CASCADE` (implementado na feature `convites-nominais`) |

O CASCADE já está no schema desde as features `grupos` e `convites-nominais`. Não é necessária nenhuma migration de schema.

### Migrations necessárias

Nenhuma. O schema já suporta a exclusão em cascata.

---

## Backend — Endpoints Next.js (Route Handlers TypeScript)

### DELETE /api/groups/[id]

**Arquivo:** `app/api/groups/[id]/route.ts` (adicionar handler `DELETE` ao arquivo existente, que hoje já contém o `GET`)

**Autenticação:** requerida (Bearer JWT — mesmo padrão de autenticação de `app/api/groups/[id]/route.ts`)

**Parâmetro de rota:** `id` (UUID do grupo a excluir)

**Body:** nenhum

**Lógica (ordem exata):**

1. Autentica o usuário via Bearer JWT (função `authenticate(request)` já existente no arquivo).
2. Valida `id` como UUID via `isValidUUID(id)` (função já existente no arquivo). Se inválido, retorna 400.
3. Usando `serviceClient()` (service_role), busca `group_members` para `(group_id = id, user_id = user.id)`:
   - Linha não encontrada → 404 (grupo inexistente) se o grupo também não existir; ou 403 (usuário não é membro) se o grupo existir.
   - Para distinguir os dois casos: primeira query verifica se o grupo existe (`groups.select('id').eq('id', id).maybeSingle()`); segunda verifica a membership. Se grupo não existe → 404. Se grupo existe mas membership não existe → 403.
4. Verifica `membership.role === 'admin'`. Se não for admin → 403 (mensagem: "Apenas o admin pode excluir o grupo.").
5. Executa `DELETE FROM groups WHERE id = $1` via `serviceClient().from('groups').delete().eq('id', id)`. O ON DELETE CASCADE no banco cuida de `group_members`, `predictions`, `scores` e `group_invites`.
6. Se o delete retornar erro do Supabase → 500.
7. Retorna 200 com `{ deleted: true, group_id: id }`.

**Resposta de sucesso (200):**
```json
{ "deleted": true, "group_id": "<uuid>" }
```

**Erros possíveis:**
- 400: `id` não é UUID válido
- 401: não autenticado
- 403: usuário é membro mas não é admin do grupo
- 403: usuário não é membro do grupo (mensagem diferente: "Você não participa deste grupo.")
- 404: grupo não encontrado
- 500: erro Supabase

**Nota de segurança:** toda a lógica usa `serviceClient()` (service_role) para contornar RLS de forma controlada, exatamente como nos demais handlers de `app/api/groups/`. A verificação de admin é feita explicitamente no código do Route Handler (defesa secundária), além da RLS de `DELETE` que não existia antes (ver seção RLS abaixo).

---

## RLS — Nova Policy de DELETE em `groups`

Para permitir que o `serviceClient()` (service_role) execute o `DELETE` sem bloqueio de RLS (service_role ignora RLS por padrão no Supabase, então tecnicamente não é obrigatório), e como defesa em profundidade para impedir que um client anon/authenticated tente deletar diretamente:

**Não adicionar policy permissiva de DELETE para `authenticated`.** O `service_role` ignora RLS; a operação de delete é exclusiva do Route Handler server-side. Documentar esse comportamento no código com um comentário.

Não é necessária nenhuma migration de RLS para esta feature.

---

## Frontend — Componentes React

### DeleteGroupButton

**Arquivo:** `components/bolao/DeleteGroupButton.tsx`
**Diretiva:** `'use client'`

**Props:**
```ts
interface DeleteGroupButtonProps {
  groupId: string
  groupName: string
}
```

**Estados internos:**
- `idle` — botão "EXCLUIR GRUPO" visível, cor `color-error`, borda `1px solid var(--color-error)`
- `confirming` — modal aberto (ver layout do modal abaixo)
- `loading` — botão "EXCLUINDO..." desabilitado dentro do modal, sem spinner (texto simples)
- `error` — mensagem de erro inline em `color-error` dentro do modal, botão "EXCLUIR" reabilitado

**Comportamento:**
1. Estado `idle`: botão "EXCLUIR GRUPO" na cor `color-error`. Ao clicar, passa para `confirming`.
2. Estado `confirming`: modal sobreposto (ver layout abaixo) com mensagem de aviso e botão de confirmação. Nenhuma ação de navegação ocorre nesse estado.
3. Ao clicar "CONFIRMAR EXCLUSÃO" no modal: passa para `loading`, chama `DELETE /api/groups/[id]` com `Authorization: Bearer <jwt>`. JWT obtido via `supabase.auth.getSession()` (mesmo padrão de `AtivarGrupoButton` e `JoinGroupButton` já existentes).
4. Em sucesso (200): chama `router.push('/grupos')` para redirecionar para a lista de grupos.
5. Em erro: volta para `confirming` com mensagem de erro em `color-error` dentro do modal.
6. Botão "CANCELAR" no modal: volta para `idle` sem qualquer chamada de rede.

**Layout do modal:**

```
┌──────────────────────────────────────────────────────┐
│  EXCLUIR GRUPO                                        │
│  ─────────────────────────────────────────────────── │
│  Você está prestes a excluir o grupo                 │
│  "<NOME DO GRUPO>".                                   │
│                                                      │
│  Esta ação é irreversível:                           │
│  ✗ Todos os palpites serão deletados                 │
│  ✗ Todas as pontuações serão deletadas               │
│  ✓ Os perfis dos participantes não serão afetados    │
│                                                      │
│  [ CANCELAR ]          [ CONFIRMAR EXCLUSÃO ]        │
└──────────────────────────────────────────────────────┘
```

**Especificações de estilo do modal:**
- Overlay: `position: fixed; inset: 0; background: rgba(10,14,26,0.85); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem`
- Container interno: `background: var(--color-surface); border: 1px solid var(--color-error); max-width: 420px; width: 100%; font-family: 'JetBrains Mono', 'Courier New', monospace`
- Cabeçalho: `padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-error); font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-error)`
- Corpo: `padding: 1rem; font-size: 13px; color: var(--color-text); line-height: 1.6`
- Nome do grupo no corpo: `color: var(--color-accent)`
- Itens de aviso negativos (✗): `color: var(--color-error)` 
- Item positivo (✓): `color: var(--color-win)`
- Rodapé com botões: `padding: 0.75rem 1rem; border-top: 1px solid var(--color-border); display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap`
- Botão "CANCELAR": borda `1px solid var(--color-muted)`, fundo transparente, texto `var(--color-muted)`, uppercase, 12px
- Botão "CONFIRMAR EXCLUSÃO" (estado idle): fundo `var(--color-error)`, texto `var(--color-bg)`, uppercase, 12px, bold
- Botão "EXCLUINDO..." (estado loading): idêntico ao de confirmação mas desabilitado, opacidade 0.6, cursor `not-allowed`
- Sem `border-radius` em nenhum elemento (consistente com DESIGN.md)
- Sem `box-shadow`

---

### Modificação em `app/(dashboard)/grupos/[id]/page.tsx`

**Arquivo:** `app/(dashboard)/grupos/[id]/page.tsx` (já existente — adicionar seção de exclusão condicionada a `isAdmin`)

**O que adicionar:**

Após a lista de participantes e antes do link "← VOLTAR PARA MEUS GRUPOS", adicionar uma seção de zona de perigo visível somente quando `isAdmin === true`:

```
┌──────────────────────────────────────────────────────┐
│  ZONA DE PERIGO                                       │
│  ─────────────────────────────────────────────────── │
│  [ EXCLUIR GRUPO ]                                   │
└──────────────────────────────────────────────────────┘
```

Especificações de estilo da seção:
- Container: `border: 1px solid var(--color-error); background: var(--color-surface); margin-top: 1rem`
- Label da seção: `padding: 0.5rem 1rem; border-bottom: 1px solid var(--color-error); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-error)`
- Corpo: `padding: 1rem`
- `<DeleteGroupButton groupId={id} groupName={group.name} />` renderizado aqui

Membros não-admin **não veem** esta seção (condicional `{isAdmin && (...)}` envolvendo todo o bloco).

---

## Regras de Negócio

1. **Somente o admin pode excluir o grupo.** A verificação é feita server-side no Route Handler; a UI também condiciona a renderização do botão a `isAdmin === true`, mas isso é apenas UX — a proteção real é no backend.

2. **A exclusão é permanente e irreversível.** Não há soft-delete, lixeira ou período de graça. O `DELETE FROM groups WHERE id = $1` deleta em cascata tudo que está em `predictions`, `scores`, `group_members` e `group_invites` vinculado ao grupo.

3. **`profiles` e `auth.users` não são afetados.** A exclusão de um grupo nunca toca em perfis ou contas de usuário. Usuários que pertenciam ao grupo continuam existindo no sistema e podem criar ou entrar em outros grupos.

4. **Se o grupo excluído era o grupo ativo do usuário (cookie `bolao_active_group`), o cookie não é limpo pelo servidor automaticamente.** Ao redirecionar para `/grupos` após a exclusão, a função `resolveActiveGroup()` já existente cuidará de auto-curar o cookie órfão (o grupo não existirá mais na lista de memberships, então o fallback para o primeiro grupo disponível será ativado silenciosamente, conforme implementado na feature `grupo-ativo-persistente`).

5. **Usuário sem nenhum grupo restante após a exclusão.** Se o admin excluir seu único grupo, ao ser redirecionado para `/grupos` a página exibirá o estado vazio ("VOCÊ NÃO PARTICIPA DE NENHUM GRUPO AINDA") com o CTA de criar novo grupo. Nenhum tratamento especial é necessário além do redirecionamento padrão para `/grupos`.

6. **Grupo inexistente ou já excluído.** Se o `DELETE` for chamado para um `group_id` que não existe mais (ex: duplo clique ou requisição repetida), o Route Handler retornará 404. O frontend não precisa tratar esse caso especialmente além da mensagem de erro genérica já prevista no estado `error` do `DeleteGroupButton`.

---

## Proteção de Rotas

- O botão "EXCLUIR GRUPO" está em `/grupos/[id]`, que é uma rota protegida dentro do grupo `(dashboard)` — já requer autenticação pelo middleware/layout existente.
- O endpoint `DELETE /api/groups/[id]` requer Bearer JWT (mesmo padrão dos demais handlers nesse arquivo).
- Verificação de admin é explícita no Route Handler (server-side).
- Nenhuma rota nova pública é criada.

---

## Integração Supabase Realtime

Nenhuma. Esta feature não usa Supabase Realtime. A exclusão é uma operação pontual; não há necessidade de notificar outros clientes em tempo real sobre a remoção do grupo (o usuário é redirecionado imediatamente, e outros membros veriam o grupo desaparecer na próxima navegação).

---

## Critérios de Aceite

- [ ] Botão "EXCLUIR GRUPO" aparece em `/grupos/[id]` somente quando o usuário autenticado é admin do grupo — membros não-admin não veem o botão nem a seção "ZONA DE PERIGO".
- [ ] Clicar no botão abre o modal de confirmação exibindo o nome do grupo em destaque (`color-accent`) e listando explicitamente que palpites e scores serão deletados (✗) e que perfis não serão afetados (✓).
- [ ] Clicar "CANCELAR" no modal fecha-o sem qualquer chamada de rede.
- [ ] Clicar "CONFIRMAR EXCLUSÃO" no modal dispara `DELETE /api/groups/[id]` com Authorization Bearer JWT. O botão muda para "EXCLUINDO..." e fica desabilitado durante a requisição.
- [ ] Em sucesso, o usuário é redirecionado para `/grupos` e o grupo deletado não aparece mais na lista.
- [ ] Em erro, uma mensagem de erro em `color-error` aparece dentro do modal; o botão "CONFIRMAR EXCLUSÃO" é reabilitado; o modal permanece aberto para nova tentativa.
- [ ] `DELETE /api/groups/[id]` retorna 403 quando chamado por um usuário membro não-admin.
- [ ] `DELETE /api/groups/[id]` retorna 403 quando chamado por um usuário que não pertence ao grupo.
- [ ] `DELETE /api/groups/[id]` retorna 404 para um `group_id` inexistente.
- [ ] Após a exclusão, consultas a `predictions` e `scores` com o `group_id` excluído retornam vazias (cascade confirmado).
- [ ] `profiles` e `auth.users` dos ex-membros permanecem intactos após a exclusão.
- [ ] Se o grupo excluído era o ativo (cookie `bolao_active_group`), a navegação pós-redirect para `/grupos` não exibe erro — o cookie órfão é auto-curado pelo `resolveActiveGroup()` existente.
- [ ] Design segue DESIGN.md: borda `color-error` na zona de perigo e no modal, fonte JetBrains Mono, uppercase, dark only, sem border-radius, sem sombras.
- [ ] Funciona em mobile (coluna única): modal responsivo com `max-width: 420px` e `padding: 1rem` no overlay; botões do modal quebram em linha graciosamente com `flex-wrap: wrap`.
- [ ] Interface 100% em português brasileiro.
- [ ] `npm run lint` e `npm run build` executados com sucesso após as mudanças.
