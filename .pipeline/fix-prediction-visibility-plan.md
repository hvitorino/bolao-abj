# Plano de Implementação: Correção — Visibilidade Temporal dos Palpites

**Slug:** fix-prediction-visibility
**Branch:** feature/fix-prediction-visibility
**Data:** 2026-06-14
**Spec:** .pipeline/fix-prediction-visibility-spec.md

## Tarefas

- [x] 1. Criar migration em `supabase/migrations/` e espelho em `db/migrations/` para restringir leitura de `predictions` a palpites próprios ou jogos já iniciados/finalizados
- [x] 2. Ajustar `components/bolao/GameParticipantsList.tsx` para renderizar `OCULTO` para outros participantes quando `gameStatus === 'pending'`
- [x] 3. Revisar `app/(dashboard)/jogos/page.tsx` e `components/games/GameCard.tsx` para garantir que não existe bypass da regra temporal
- [x] 4. Executar `npm run lint` e `npm run build`
- [x] 5. Documentar implementação, validação e revisão em `.pipeline/fix-prediction-visibility-changelog.md`
