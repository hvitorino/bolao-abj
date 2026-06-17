# Plano de Implementação: Distinção entre Palpite Oculto e Pendente

**Slug:** prediction-visibility
**Branch:** feature/prediction-visibility
**Data:** 2026-06-17
**Spec:** .pipeline/prediction-visibility-spec.md

## Tarefas

- [x] 1. Criar `lib/supabase/service-server.ts` com cliente service_role reutilizável
- [x] 2. Adicionar campo `hasPrediction: boolean` em `lib/types/participant.ts`
- [x] 3. Adicionar query de existência de palpites com service_role em `app/(dashboard)/jogos/page.tsx` e popular `hasPrediction` nos `ParticipantEntry`
- [x] 4. Atualizar `components/bolao/GameParticipantsList.tsx` para distinguir `OCULTO` (color-muted) de `PENDENTE` (color-error) usando `hasPrediction`
- [x] 5. Verificar TypeScript e lint sem erros (`npm run lint && npm run build`)
