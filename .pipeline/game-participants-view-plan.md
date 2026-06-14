# Plano de Implementação: Palpites e Pontuação dos Participantes por Jogo

**Slug:** game-participants-view
**Branch:** feature/game-participants-view
**Data:** 2026-06-14
**Spec:** .pipeline/game-participants-view-spec.md

## Tarefas

- [ ] 1. Criar tipo auxiliar `ParticipantEntry` em `lib/types/participant.ts`
- [ ] 2. Criar componente Server Component `components/bolao/GameParticipantsList.tsx`
- [ ] 3. Estender `app/(dashboard)/jogos/page.tsx` para buscar todos os perfis, todos os palpites e todos os scores do dia em paralelo, montando `participantsByGameId`
- [ ] 4. Modificar `components/games/GameList.tsx` para aceitar e repassar `participantsByGameId` ao `GameCard`
- [ ] 5. Modificar `components/games/GameCard.tsx` para aceitar `participants` e renderizar `<GameParticipantsList>` ao final da área de palpite
- [ ] 6. Verificar/documentar políticas RLS do Supabase para leitura de `predictions`, `scores` e `profiles` por qualquer usuário autenticado
