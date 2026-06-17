# Changelog: Exclusão de Grupo pelo Admin

**Slug:** delete-group
**Branch:** feature/delete-group
**Data:** 2026-06-17
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handler)
- `app/api/groups/[id]/route.ts` — adicionado handler `DELETE` ao arquivo existente. Segue a mesma estrutura e funções auxiliares já presentes (`authenticate`, `isValidUUID`, `serviceClient`). A lógica verifica em sequência: autenticação JWT, validade do UUID, existência do grupo, membership do usuário e role de admin. O delete via `serviceClient` (service_role) aciona o ON DELETE CASCADE do banco para limpar `group_members`, `predictions`, `scores` e `group_invites` automaticamente. Retorna `{ deleted: true, group_id }` em sucesso.

### Frontend (Next.js/React)
- `components/bolao/DeleteGroupButton.tsx` — componente client com 4 estados internos (idle/confirming/loading/error). Exibe o botão "EXCLUIR GRUPO" em `color-error` no estado idle. Ao clicar, abre modal sobreposto com overlay escuro (rgba 85%), contêiner com borda `color-error`, cabeçalho uppercase bold, corpo com nome do grupo em `color-accent`, lista de consequências com ✗ em `color-error` e ✓ em `color-win`, botões "CANCELAR" e "CONFIRMAR EXCLUSÃO" no rodapé. Em loading o botão vira "EXCLUINDO..." desabilitado com opacidade 0.6. Em erro exibe mensagem inline dentro do modal e reabilita o botão. Em sucesso redireciona para `/grupos` via `router.push`.
- `app/(dashboard)/grupos/[id]/page.tsx` — importado `DeleteGroupButton` e adicionado bloco "ZONA DE PERIGO" condicionado a `isAdmin`, posicionado após a lista de participantes e antes do link "← VOLTAR PARA MEUS GRUPOS". Container com `border: 1px solid var(--color-error)` e label uppercase em `color-error`.

### Banco de Dados
- Nenhuma migration necessária. O ON DELETE CASCADE já existe nas FKs de `group_members`, `predictions`, `scores` e `group_invites` desde as features `grupos` e `convites-nominais`.
- Nenhuma policy de RLS adicionada. O handler usa `serviceClient` (service_role) que ignora RLS por padrão no Supabase; a verificação de admin é feita explicitamente no código do Route Handler.

---

## Decisões técnicas

- **Estado `error` mantém o modal aberto** em vez de fechar: permite ao usuário tentar novamente ou cancelar manualmente, evitando perda do contexto de confirmação numa falha transitória de rede.
- **Sem policy RLS de DELETE para `authenticated`**: o service_role já ignora RLS; adicionar uma policy permissiva aumentaria a superfície de ataque sem benefício. O comportamento está documentado com comentário no código do Route Handler.
- **Cookie `bolao_active_group` não é limpo pelo servidor**: conforme a regra de negócio 4 da spec, o `resolveActiveGroup()` já existente cuida do fallback caso o grupo ativo seja excluído — o cookie órfão é auto-curado na próxima navegação para `/grupos`.
- **`router.push('/grupos')` em vez de `router.refresh()`**: após a exclusão o grupo não existe mais, então qualquer refresh na rota `/grupos/[id]` resultaria em 404. O push leva o usuário diretamente para a lista.

---

## Pontos de atenção para o Revisor

- Confirmar que o handler `DELETE` trata corretamente os dois casos de 403 (membro não-admin vs. não-membro) com mensagens distintas conforme a spec.
- Verificar que a prop `groupName` chega corretamente do Server Component para o `DeleteGroupButton` (passada como `group.name` que é carregado via Supabase antes da renderização).
- Validar que a seção "ZONA DE PERIGO" não é visível para membros não-admin em nenhuma circunstância (a condicional `{isAdmin && (...)}` envolve todo o bloco).
- Checar se o modal é acessível: tem `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o título.
- Confirmar que o design segue DESIGN.md: sem `border-radius`, sem `box-shadow`, fonte JetBrains Mono, uppercase, dark only.
- Verificar responsividade do modal em mobile com `flex-wrap: wrap` nos botões do rodapé e `max-width: 420px` com `padding: 1rem` no overlay.

---

## Commits realizados

```
311aa17 feat(delete-group): adiciona seção zona de perigo em /grupos/[id] para admin
9840088 feat(delete-group): cria componente DeleteGroupButton com modal de confirmação
6d0a248 feat(delete-group): adiciona handler DELETE em /api/groups/[id] com verificação de admin
2552e9e chore(delete-group): adiciona plano de implementação
```
