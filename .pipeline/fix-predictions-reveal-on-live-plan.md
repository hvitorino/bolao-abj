# Plano de Implementação: Correção — Revelação de Palpites ao Vivo

**Slug:** fix-predictions-reveal-on-live
**Branch:** feature/fix-predictions-reveal-on-live
**Data:** 2026-06-17
**Spec:** .pipeline/fix-predictions-reveal-on-live-spec.md

## Tarefas

- [x] 1. Criar Route Handler `app/api/participants-predictions/route.ts` — endpoint GET autenticado que retorna `user_id, game_id, home_score, away_score` de `predictions` filtrado por `game_id` e `group_id`, usando RLS para controle de visibilidade
- [x] 2. Criar hook `lib/hooks/useParticipantsRealtime.ts` — gerencia estado de `ParticipantEntry[]` com fetch imediato no mount (jogo já live) e subscrição Realtime para detectar transição `pending → live`
- [x] 3. Modificar `components/games/GameCard.tsx` — substituir uso direto da prop `participants` pelo retorno do hook `useParticipantsRealtime`, passando `liveParticipants` para `GameParticipantsList`
- [x] 4. Verificar lint e build — rodar `npm run lint` e `npm run build` para garantir que nenhum erro novo foi introduzido
