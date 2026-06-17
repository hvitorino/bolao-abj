# Plano de Implementação: Distinção entre Palpite Oculto e Pendente

**Slug:** prediction-visibility
**Branch:** feature/prediction-visibility
**Data:** 2026-06-17
**Spec:** .pipeline/prediction-visibility-spec.md

## Tarefas

- [ ] 1. Criar `lib/supabase/service-server.ts` com cliente service_role reutilizável
- [ ] 2. Adicionar campo `hasPrediction: boolean` em `lib/types/participant.ts`
- [ ] 3. Adicionar query de existência de palpites com service_role em `app/(dashboard)/jogos/page.tsx` e popular `hasPrediction` nos `ParticipantEntry`
- [ ] 4. Atualizar `components/bolao/GameParticipantsList.tsx` para distinguir `OCULTO` (color-muted) de `PENDENTE` (color-error) usando `hasPrediction`
- [ ] 5. Verificar TypeScript e lint sem erros (`npm run lint && npm run build`)
