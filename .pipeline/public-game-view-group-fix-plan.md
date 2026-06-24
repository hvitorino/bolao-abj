# Plano de Implementação: Correção — Contexto de Grupo na Página Pública de Jogo

**Slug:** public-game-view-group-fix
**Branch:** feature/public-game-view-group-fix
**Data:** 2026-06-24
**Spec:** .pipeline/public-game-view-group-fix-spec.md

## Tarefas

- [ ] 1. Corrigir `handleCopyLink` em `components/games/GameCard.tsx` para incluir `?grupo=${groupId}` na URL copiada
- [ ] 2. Adicionar `searchParams` como prop em `app/jogos/[gameId]/publico/page.tsx` e renderizar tela de erro quando `grupo` está ausente
- [ ] 3. Substituir query de perfis em `page.tsx` por busca filtrada via `group_members` quando `groupId` está presente
- [ ] 4. Adicionar filtro `group_id` nas queries de `predictions` e `scores` em `page.tsx`
- [ ] 5. Passar prop `groupId` para `PublicGameClient` em `page.tsx`
- [ ] 6. Adicionar prop `groupId: string` à interface e ao componente `PublicGameClient.tsx` e repassar para `PublicParticipantsList`
- [ ] 7. Adicionar prop `groupId: string` à interface e ao componente `PublicParticipantsList.tsx` e usar no nome do canal Realtime
