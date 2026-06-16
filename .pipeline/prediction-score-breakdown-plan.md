# Plano de Implementação: Detalhamento da Pontuação no Palpite

**Slug:** prediction-score-breakdown
**Branch:** feature/prediction-score-breakdown
**Data:** 2026-06-16
**Spec:** .pipeline/prediction-score-breakdown-spec.md

## Tarefas

- [ ] 1. Adicionar campo `breakdown: ScoreBreakdown | null` à interface `ParticipantEntry` em `lib/types/participant.ts`
- [ ] 2. Atualizar `app/(dashboard)/jogos/page.tsx` para indexar `breakdown` junto de `points` em `scoreByUserGame` e propagar `breakdown` em `participantsByGameId`
- [ ] 3. Criar componente `components/bolao/PredictionBreakdown.tsx` (apresentação pura do breakdown, reaproveitando `BREAKDOWN_LABELS`)
- [ ] 4. Adicionar `'use client'` e estado `expandedUserId` em `components/bolao/GameParticipantsList.tsx`; tornar linhas elegíveis clicáveis (mouse + teclado) com indicador `▾`/`▴`
- [ ] 5. Integrar `PredictionBreakdown` na linha expandida de `GameParticipantsList` via `Fragment` + `<tr><td colSpan>`
- [ ] 6. Rodar `npm run lint` e `npm run build`; ajustar eventuais erros
- [ ] 7. Escrever changelog da feature
