# Plano de Implementação: Remover Participante do Grupo

**Slug:** remove-member
**Branch:** feature/remove-member
**Data:** 2026-06-17
**Spec:** .pipeline/remove-member-spec.md

## Tarefas

- [ ] 1. Criar `app/api/groups/[id]/members/[userId]/route.ts` — handler `DELETE` com autenticação JWT, validação de UUIDs, verificação de grupo/membership/role/self-remove e deleção via serviceClient
- [ ] 2. Criar `components/bolao/RemoveMemberButton.tsx` — componente client com 4 estados (idle/confirming/loading/error), modal de confirmação acessível com overlay, chamada ao endpoint DELETE e callback `onRemoved`
- [ ] 3. Criar `components/bolao/MembersList.tsx` — client component com estado interno de membros, renderização condicional de `RemoveMemberButton` por linha (apenas admin, não para si mesmo), atualização otimista após remoção
- [ ] 4. Atualizar `app/(dashboard)/grupos/[id]/page.tsx` — substituir bloco `<div>` da seção PARTICIPANTES pelo componente `<MembersList>` passando as props necessárias (`initialMembers`, `currentUserId`, `isAdmin`, `groupId`)
