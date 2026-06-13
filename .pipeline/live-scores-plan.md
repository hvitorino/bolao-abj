# Plano de Implementação: Live Scores

**Slug:** live-scores
**Branch:** feature/live-scores
**Data:** 2026-06-13
**Spec:** .pipeline/live-scores-spec.md

## Tarefas

- [ ] 1. Criar hook `lib/hooks/useGameRealtime.ts` com subscription Supabase Realtime e cleanup
- [ ] 2. Modificar `components/games/GameCard.tsx` para usar o hook `useGameRealtime` e renderizar estado em tempo real
- [ ] 3. Verificar/confirmar animação `blink` em `app/globals.css` (já existe, confirmar que está correta conforme DESIGN.md)
- [ ] 4. Criar endpoint Ruby `api/admin/games/[id].rb` com PATCH, validação de ADMIN_SECRET e atualização via Supabase service_role
- [ ] 5. Escrever `.pipeline/live-scores-changelog.md` e fazer commit final
