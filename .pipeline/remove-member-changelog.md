# Changelog: Remover Participante do Grupo

**Slug:** remove-member
**Branch:** feature/remove-member
**Data:** 2026-06-17
**Status:** aguardando revisão (fix 1 aplicado)

---

## O que foi implementado

### Backend (Next.js Route Handler)
- `app/api/groups/[id]/members/[userId]/route.ts` — handler `DELETE` com autenticação JWT (via `Authorization: Bearer`), validação dos dois UUIDs de rota (`id` e `userId`), verificação sequencial de: existência do grupo, membership do chamador, role de admin, auto-remoção proibida, membership do alvo, e finalmente deleção via `serviceClient` (service_role). Segue exatamente o mesmo padrão e funções auxiliares (`authenticate`, `isValidUUID`, `serviceClient`) do arquivo `app/api/groups/[id]/route.ts`. Retorna `{ removed: true, group_id, user_id }` em sucesso. Palpites e scores do membro removido permanecem como registro histórico.

### Frontend (Next.js/React)
- `components/bolao/RemoveMemberButton.tsx` — componente client com 4 estados (idle/confirming/loading/error). Em idle exibe botão `[REMOVER]` com borda `color-error`, 11px, uppercase. Ao clicar, abre modal de confirmação com overlay rgba(10,14,26,0.85), caixa bordada em `color-error`, título em `color-error` uppercase bold, nome do membro em bold, linha de reversibilidade em `color-muted`. Estado loading trava o botão "CONFIRMAR REMOÇÃO" → "REMOVENDO..." com opacity 0.6. Estado error exibe mensagem inline dentro do modal (modal não fecha); botão CANCELAR volta para idle. Em sucesso fecha modal e chama `onRemoved()`. Modal tem `role="dialog"`, `aria-modal="true"` e `aria-labelledby="remove-member-modal-title"`.
- `components/bolao/MembersList.tsx` — client component que mantém estado interno `members` iniciado com `initialMembers`. Para cada membro renderiza: nome à esquerda com `overflow: hidden; textOverflow: ellipsis` (compatível mobile), badge de papel e botão de remoção agrupados à direita via `flexShrink: 0`. Renderiza `<RemoveMemberButton>` somente quando `isAdmin && member.userId !== currentUserId`. Callback `onRemoved` filtra o membro do estado local imediatamente (atualização otimista — sem reload de página).
- `app/(dashboard)/grupos/[id]/page.tsx` — importado `MembersList` e substituído o bloco `<div>` com `map()` da seção PARTICIPANTES pelo componente `<MembersList groupId={id} initialMembers={members} currentUserId={user.id} isAdmin={isAdmin} />`. Label e contagem de participantes permanecem no Server Component.

### Banco de Dados
- Nenhuma migration necessária. O schema de `group_members` e as funções auxiliares (`is_group_member`, `is_group_admin`) existem desde as features `grupos` e `convites-nominais`. A deleção é via service_role que ignora RLS — nenhuma policy de DELETE para `authenticated` foi adicionada.

---

## Decisões técnicas

- **Estado error mantém o modal aberto**: permite tentar novamente ou cancelar manualmente sem perder o contexto, seguindo o mesmo padrão do `DeleteGroupButton`.
- **Atualização otimista no cliente**: após `onRemoved()`, o membro é removido do estado local imediatamente sem novo fetch ou reload. Reduz latência percebida e evita refetch desnecessário.
- **Dupla defesa na auto-remoção**: frontend não renderiza o botão ao lado da própria linha do admin; backend rejeita com 403 se `caller.id === userId`. Nenhuma das duas defesas depende da outra.
- **`whiteSpace: 'nowrap'` no botão e `overflow: hidden` no nome**: garante que a linha de membro não quebre em telas estreitas — o nome trunca com ellipsis, enquanto o badge e o botão mantêm posição fixa à direita.
- **Erro pré-existente em `group-switcher.tsx`**: o erro de lint `react-hooks/immutability` em `document.cookie` já existia na branch main antes desta feature — todos os arquivos desta feature passam no lint sem nenhuma ocorrência.

---

## Pontos de atenção para o Revisor

- Verificar que o endpoint retorna os 6 status HTTP corretos (200, 400, 401, 403×3, 404, 422, 500) conforme a spec e que as mensagens de erro estão descritivas.
- Confirmar que o admin não vê botão de remoção ao lado da própria linha (condicional `member.userId !== currentUserId` em `MembersList`).
- Confirmar que membros não-admin não veem nenhum botão de remoção (prop `isAdmin={isAdmin}` passada do Server Component).
- Verificar que o modal tem acessibilidade completa: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` aponta para `remove-member-modal-title`.
- Checar comportamento mobile: nome longo trunca com ellipsis, badge + botão permanecem visíveis na mesma linha sem quebra de layout.
- Confirmar que após remoção a lista atualiza sem reload de página (estado local em `MembersList`).
- Validar que palpites e scores do membro removido permanecem no banco (a deleção só afeta `group_members`, não há cascade para `predictions` ou `scores` quando se remove apenas um membro).

---

## Commits realizados

```
5a0f26c feat(remove-member): integra MembersList em /grupos/[id]/page.tsx
99a85a2 feat(remove-member): cria MembersList client component com atualização otimista
ce74dc3 feat(remove-member): cria componente RemoveMemberButton com modal de confirmação
bb4ff88 feat(remove-member): cria handler DELETE /api/groups/[id]/members/[userId]
f0f7e10 chore(remove-member): adiciona plano de implementação
```

---

## Correções Fix 1

**Data:** 2026-06-17

### Problema corrigido

- `components/bolao/RemoveMemberButton.tsx` (linha 224) — label do botão de confirmação no estado `error` alterado de "CONFIRMAR REMOÇÃO" para "TENTAR NOVAMENTE". A expressão condicional agora cobre os três estados: `loading` → "REMOVENDO...", `error` → "TENTAR NOVAMENTE", demais → "CONFIRMAR REMOÇÃO".

### Commit

```
2919631 fix(remove-member): exibe label 'TENTAR NOVAMENTE' no botão de confirmação quando estado é error
```
