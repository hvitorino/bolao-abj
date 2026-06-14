# Plano de Implementação: Edição de Palpites

**Slug:** predictions-edit
**Branch:** feature/predictions-edit
**Data:** 2026-06-14
**Spec:** .pipeline/predictions-edit-spec.md

## Tarefas

- [ ] 1. Criar migration SQL `20260614_predictions_update_policy.sql` com política RLS UPDATE `predictions_update_own`
- [ ] 2. Adicionar endpoint `PATCH /api/predictions/[id]` como Next.js Route Handler em `app/api/predictions/[id]/route.ts`
- [ ] 3. Modificar `PredictionDisplay.tsx` — adicionar props `predictionId`, `matchDate`, `onEditRequest` e botão "✎ EDITAR PALPITE" ghost
- [ ] 4. Modificar `PredictionForm.tsx` — adicionar props `onCancelEdit` e `onSuccess`, detectar modo edição via `initialPrediction`, usar `PATCH` no submit, rótulo "SALVAR ALTERAÇÃO"
- [ ] 5. Modificar `GameCard.tsx` — adicionar estado `isEditing`, coordenar transição display↔form e atualizar prediction local após edição bem-sucedida
