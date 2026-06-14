# Plano de Implementação: Correção — Visibilidade Temporal dos Palpites

**Slug:** fix-prediction-visibility
**Branch:** feature/fix-prediction-visibility
**Data:** 2026-06-14
**Spec:** .pipeline/fix-prediction-visibility-spec.md

## Tarefas

- [ ] 1. Criar migration em `supabase/migrations/` e espelho em `db/migrations/` para restringir leitura de `predictions` a palpites próprios ou jogos já iniciados/finalizados
- [ ] 2. Ajustar `components/bolao/GameParticipantsList.tsx` para renderizar `OCULTO` para outros participantes quando `gameStatus === 'pending'`
- [ ] 3. Revisar `app/(dashboard)/jogos/page.tsx` e `components/games/GameCard.tsx` para garantir que não existe bypass da regra temporal
- [ ] 4. Executar `npm run lint` e `npm run build`
- [ ] 5. Documentar implementação, validação e revisão em `.pipeline/fix-prediction-visibility-changelog.md`
