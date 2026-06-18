# Plano de Implementação: Chat do Grupo

**Slug:** group-chat
**Branch:** feature/group-chat
**Data:** 2026-06-18
**Spec:** .pipeline/group-chat-spec.md

## Tarefas

- [ ] 1. Criar migration `supabase/migrations/20260618000001_create_group_messages.sql` com tabela `group_messages`, índices, RLS e publicação no Realtime
- [ ] 2. Implementar componente `components/bolao/GroupChatWidget.tsx` (Client Component) com estados, Realtime, envio e UI completa
- [ ] 3. Integrar `<GroupChatWidget>` no `app/(dashboard)/layout.tsx` abaixo do `<main>`, com renderização condicional por `activeGroup`
