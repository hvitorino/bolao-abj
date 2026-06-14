# Plano de Implementação: Correção — Exibição e Atualização de Placar em Tempo Real

**Slug:** fix-live-scores-display
**Branch:** feature/fix-live-scores-display
**Data:** 2026-06-14
**Spec:** .pipeline/fix-live-scores-display-spec.md

## Tarefas

- [ ] 1. Adicionar migration SQL com política RLS de leitura para tabela `scores` (garante que usuário autenticado pode receber eventos Realtime do próprio score)
- [ ] 2. Corrigir `lib/hooks/useGameRealtime.ts` — adicionar guarda defensiva em `payload.new` para não sobrescrever o estado quando o payload chega incompleto
- [ ] 3. Corrigir `lib/hooks/useScoreRealtime.ts` — adicionar early return no `useEffect` quando `userId` está vazio, evitando subscription sem userId válido
- [ ] 4. Verificar `lib/scoring.ts` — confirmar que não há verificações falsy em `home_score` ou `away_score` (Causa 4 da spec); documentar resultado
- [ ] 5. Verificar `components/bolao/GameParticipantsList.tsx` — confirmar que não há alterações necessárias (conforme spec: somente leitura, sem Realtime neste componente)
