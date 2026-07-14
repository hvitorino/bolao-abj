# Plano de Implementação: Unificação do placar real e palpite no card de jogo

**Slug:** unify-score-prediction-card
**Branch:** feature/unify-score-prediction-card
**Data:** 2026-07-14
**Spec:** .pipeline/unify-score-prediction-card-spec.md

## Tarefas

- [ ] 1. Simplificar `components/bolao/PredictionDisplay.tsx`: remover `homeTeamCode`/`awayTeamCode`/`onEditRequest` das props, remover bandeiras e caixa/borda, renderizar linha compacta única (placar + badge de pontos opcional + indicador de expansão), manter `submittedAt` abaixo, manter acessibilidade (`role="button"`, `tabIndex`, `onKeyDown`) quando `isExpandable`.
- [ ] 2. Atualizar `components/bolao/PredictionForm.tsx` (linhas ~117-125): remover `homeTeamCode`/`awayTeamCode` da chamada a `PredictionDisplay` para bater com a nova assinatura.
- [ ] 3. Atualizar `components/games/GameCardView.tsx`: remover `homeTeamCode`/`awayTeamCode`/`onEditRequest` das chamadas a `PredictionDisplay`; adicionar faixa fina "EDITAR PALPITE" (novo elemento) exibida somente quando `canEdit`; substituir o bloco "SEM PALPITE" (estado 6) por linha simples sem borda/bandeiras.
- [ ] 4. Rodar `grep -r "PredictionDisplay"` para confirmar que todos os call sites foram atualizados.
- [ ] 5. Rodar `npm run lint` e `npm run build` e corrigir erros introduzidos pela mudança.
- [ ] 6. Escrever changelog e commitar.
