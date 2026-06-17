# Fix 1: Remover Participante do Grupo

**Slug:** remove-member
**Data:** 2026-06-17
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Label do botão de confirmação não muda para "TENTAR NOVAMENTE" no estado de erro
**Arquivo:** `components/bolao/RemoveMemberButton.tsx` (linha 224)
**Severidade:** menor
**Descrição:** A spec define explicitamente que no estado `error` o botão de confirmação deve exibir o label "TENTAR NOVAMENTE" (spec linha 125: "botão 'TENTAR NOVAMENTE' reinicia o fetch"). A implementação atual mantém o label "CONFIRMAR REMOÇÃO" em todos os estados não-loading, incluindo `error`. O comportamento funcional está correto (clicar no botão chama `handleConfirm` e reexecuta o fetch), mas o label visível ao usuário não corresponde ao especificado. O critério de aceite da spec é violado.
**Correção esperada:** No botão de confirmação (`type="button"` que chama `handleConfirm`), alterar o `children` condicional de:
```tsx
{isLoading ? 'REMOVENDO...' : 'CONFIRMAR REMOÇÃO'}
```
para:
```tsx
{isLoading ? 'REMOVENDO...' : state === 'error' ? 'TENTAR NOVAMENTE' : 'CONFIRMAR REMOÇÃO'}
```
Isso garante que o label reflita corretamente o estado visual: `confirming` → "CONFIRMAR REMOÇÃO", `loading` → "REMOVENDO...", `error` → "TENTAR NOVAMENTE".

---

## Itens OK (não precisam ser revisados novamente)

- Endpoint `DELETE /api/groups/[id]/members/[userId]/route.ts`: todos os 9 status HTTP (200, 400, 401, 403×3, 404, 422, 500×4) implementados corretamente com mensagens descritivas em português.
- Autenticação JWT via Bearer token validada com `anonClient.auth.getUser(jwt)` — correto.
- Uso de `serviceClient` (service_role) para todas as operações de escrita — sem RLS bypass indevido, defesa primária no Route Handler.
- Dupla defesa de auto-remoção: frontend não renderiza botão na linha do próprio admin (`member.userId !== currentUserId`), backend rejeita com 403 (`caller.id === userId`).
- `MembersList.tsx`: atualização otimista via `setMembers(prev => prev.filter(...))` após `onRemoved()` — sem reload de página.
- Props do `MembersList` passadas corretamente de `page.tsx`: `groupId`, `initialMembers`, `currentUserId`, `isAdmin`.
- Design: JetBrains Mono em todos os elementos, paleta `color-error`/`color-muted`/`color-text`/`color-bg`/`color-surface`, overlay correto (`rgba(10,14,26,0.85)`), bordas simples 1px, sem SVGs decorativos.
- Símbolo `✗` no estado de erro: permitido explicitamente pelo DESIGN.md.
- Acessibilidade do modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="remove-member-modal-title"` — correto.
- Layout mobile: nome com `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap; flexShrink: 1; minWidth: 0` e badge+botão com `flexShrink: 0` — correto.
- `npm run build` sem erros — correto.
- Lint nos arquivos da feature sem erros — o erro de lint em `group-switcher.tsx` é pré-existente na main e não pertence a esta feature.
- Nenhuma migration necessária — confirmado que schema de `group_members` já existe e deleção via service_role dispensa policy de DELETE para `authenticated`.
- Commits em português com prefixos corretos (`feat`, `chore`) na branch `feature/remove-member`.
