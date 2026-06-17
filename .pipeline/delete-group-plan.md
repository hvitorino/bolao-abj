# Plano de Implementação: Exclusão de Grupo pelo Admin

**Slug:** delete-group
**Branch:** feature/delete-group
**Data:** 2026-06-17
**Spec:** .pipeline/delete-group-spec.md

## Tarefas

- [ ] 1. Adicionar handler `DELETE` em `app/api/groups/[id]/route.ts` com verificação de UUID, existência do grupo, membership e role de admin, executando o delete via serviceClient (cascade cuida das tabelas filhas)
- [ ] 2. Criar componente `components/bolao/DeleteGroupButton.tsx` com os estados idle/confirming/loading/error, modal de confirmação com layout e estilos conforme spec (cor-error, JetBrains Mono, uppercase, sem border-radius, sem sombras)
- [ ] 3. Modificar `app/(dashboard)/grupos/[id]/page.tsx` para importar `DeleteGroupButton` e renderizar a seção "ZONA DE PERIGO" condicionada a `isAdmin`, posicionada após a lista de participantes e antes do link de voltar
