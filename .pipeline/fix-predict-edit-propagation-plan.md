# Plano de Implementação: Corrigir Propagação de Palpites no Modo de Edição

**Slug:** fix-predict-edit-propagation
**Branch:** feature/fix-predict-edit-propagation
**Data:** 2026-06-18
**Spec:** .pipeline/fix-predict-edit-propagation-spec.md

## Tarefas

- [ ] 1. Remover bifurcação `isEditMode / else` no bloco `if (res.ok)` do `handleSubmit` em `components/bolao/PredictionForm.tsx`, unificando criação e edição no estado `'propagating'`
