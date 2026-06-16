# Plano de Implementação: Convites Nominais para Grupos

**Slug:** convites-nominais
**Branch:** feature/convites-nominais
**Data:** 2026-06-16
**Spec:** .pipeline/convites-nominais-spec.md

## Tarefas

- [x] 1. Criar migration `supabase/migrations/20260616120000_create_group_invites.sql` (tabela `group_invites`, índices, índice único parcial, RLS, função `is_group_admin`, função `search_users_to_invite`, policy de SELECT) e espelhar em `db/migrations/20260616_create_group_invites.sql`
- [x] 2. Criar tipos TypeScript em `lib/types/group-invite.ts` (`GroupInviteStatus`, `GroupInviteSent`, `PendingInviteReceived`, `UserSearchResult`)
- [x] 3. Implementar `GET /api/groups/[id]/invites/search-users` (busca de usuários a convidar, autorização admin)
- [x] 4. Implementar `POST /api/groups/[id]/invites` (criação de convite nominal, idempotência already_member/already_pending, tratamento de corrida 23505)
- [x] 5. Implementar `GET /api/groups/[id]/invites` (lista de convites enviados, autorização admin)
- [x] 6. Implementar `GET /api/invites/pending` (convites pendentes do usuário autenticado)
- [x] 7. Implementar `POST /api/invites/[id]/accept` e `POST /api/invites/[id]/decline`
- [x] 8. Criar `components/bolao/InviteUserSearch.tsx` (busca com debounce + botão convidar)
- [x] 9. Criar `components/bolao/PendingInvitesList.tsx` (lista de convites recebidos com aceitar/recusar)
- [x] 10. Atualizar `app/(dashboard)/layout.tsx` com badge de convites pendentes no header
- [x] 11. Atualizar `app/(dashboard)/grupos/page.tsx` com seção "Convites Recebidos" acima de "Meus Grupos"
- [x] 12. Atualizar `app/(dashboard)/grupos/[id]/page.tsx` com seção "Convidar Participante" (somente admin) e lista "Convites Enviados"
- [x] 13. Rodar `npm run lint` e `npm run build`, corrigir o que for necessário
- [x] 14. Escrever changelog e finalizar
