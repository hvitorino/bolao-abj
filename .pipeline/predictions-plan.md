# Plano de Implementação: Palpites (Predictions)

**Slug:** predictions
**Branch:** feature/predictions
**Data:** 2026-06-13
**Spec:** .pipeline/predictions-spec.md

## Tarefas

- [ ] 1. Criar migration SQL para tabela `predictions` com UNIQUE(user_id, game_id) e RLS
- [ ] 2. Criar arquivo `lib/types/prediction.ts` com interface TypeScript `Prediction`
- [ ] 3. Criar endpoint Ruby `api/predictions.rb` com POST (submissão com deadline) e GET (leitura)
- [ ] 4. Criar componente `PredictionDisplay.tsx` — exibe palpite já enviado com design Elifoot
- [ ] 5. Criar componente `PredictionForm.tsx` — formulário inline com inputs LED, countdown e submissão
- [ ] 6. Modificar `GameCard.tsx` — aceitar prop `prediction`, tornar Client Component, integrar área de palpite
- [ ] 7. Modificar `app/(dashboard)/jogos/page.tsx` — buscar predictions do usuário e passar para GameCard
