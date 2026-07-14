# Changelog: Unificação do placar real e palpite no card de jogo

**Slug:** unify-score-prediction-card
**Branch:** feature/unify-score-prediction-card
**Data:** 2026-07-14
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/PredictionDisplay.tsx` — componente simplificado para renderizar apenas a linha compacta do palpite (placar + badge de pontos opcional + indicador ▾/▲ de expansão), sem bandeiras, sem caixa/borda própria e sem botão de editar embutido. Props `homeTeamCode`, `awayTeamCode` e `onEditRequest` foram removidas da interface `PredictionDisplayProps`. Acessibilidade preservada: `role="button"`, `tabIndex`, `onClick`, `onKeyDown` (Enter/Espaço) quando `isExpandable && onToggle`.
- `components/bolao/PredictionForm.tsx` — atualizado o call site interno de `PredictionDisplay` (ramo `submittedPrediction && !isEditMode`) removendo `homeTeamCode`/`awayTeamCode` para bater com a nova assinatura do componente. Nenhuma mudança de comportamento do formulário em si.
- `components/games/GameCardView.tsx` — seção "Área de palpite" reestruturada conforme a máquina de estados da spec:
  - Estado 2 (pendente, com palpite, dentro do prazo): `PredictionDisplay` (linha compacta) + faixa fina "✎ EDITAR PALPITE" abaixo, controlada por `canEdit`, que dispara `setIsEditing(true)`.
  - Estado 3 (pendente, com palpite, prazo encerrado): apenas `PredictionDisplay`, sem a faixa de editar.
  - Estado 5 (live/finished, com palpite): `PredictionDisplay` expansível (mesma lógica de `isScoreExpanded`/`ScoreDisplay` já existente, inalterada).
  - Estado 6 (live/finished, sem palpite): bloco antigo com borda + bandeiras apagadas substituído por uma linha simples "SEM PALPITE · +0 PTS" em `color-muted`, sem borda/caixa.
  - Seção "Placar" (bandeiras + nomes + placar real) permanece inalterada.

### Backend (Ruby/Sinatra)

Nenhuma mudança — feature puramente visual/composição de componentes React.

### Banco de Dados

Nenhuma mudança.

---

## Decisões técnicas

- Todos os call sites de `PredictionDisplay` foram localizados via `grep -rln "PredictionDisplay" --include="*.tsx"` antes da alteração: apenas `PredictionForm.tsx` e `GameCardView.tsx` o utilizam (confirmado, nenhum `GameAnaliseDrawer` ou outro consumidor direto).
- A faixa "EDITAR PALPITE" foi implementada diretamente em `GameCardView.tsx` (não em `PredictionDisplay.tsx`), como pedido na spec, mantendo o componente de exibição puramente apresentacional.
- Layout da linha de `PredictionDisplay`: badge de pontos com `marginLeft: 'auto'` para ficar à direita quando presente; o rótulo "enviado às HH:MM BRT" aparece à direita quando não há badge de pontos (estado pendente), e à direita do badge quando ambos coexistem (não ocorre na prática, já que `submittedAt` e `points` não aparecem juntos nos estados atuais, mas o layout foi feito defensivo).
- Estado 6 ("SEM PALPITE · +0 PTS") ficou alinhado à esquerda, consistente com o alinhamento à esquerda adotado pela nova linha de `PredictionDisplay` (placar começa à esquerda do bloco).

---

## Pontos de atenção para o Revisor

- Verificar visualmente os 6 estados da "Área de palpite" descritos na spec, em especial a transição suave do `ScoreDisplay` ao expandir/colapsar a linha de palpite (estado 5) — lógica de `grid-template-rows` inalterada.
- Confirmar que a faixa "EDITAR PALPITE" aparece somente quando `canEdit` é `true` (estado 2) e desaparece quando o prazo expira (estado 3), sem exigir refresh da página (o `canEdit` é recalculado a cada render a partir de `Date.now()`, mas não há timer que force re-render periódico nesta parte do componente — esse comportamento já existia antes da mudança e não foi alterado).
- `npm run lint` no repositório completo apresenta um grande número de erros/warnings pré-existentes não relacionados a esta feature (hooks com `setState` em efeitos, `any` em outros arquivos, etc.). Rodei `npx eslint` isolado nos três arquivos alterados: apenas 1 warning pré-existente (`ScoreBreakdown` importado e não usado em `GameCardView.tsx`, presente também na `main` antes desta mudança) — nenhum erro novo introduzido.
- `npm run build` executado com sucesso, sem erros de tipo nos arquivos alterados.
- Testar em mobile (~360px) para confirmar que a linha de palpite e a faixa "EDITAR PALPITE" não causam overflow horizontal.

---

## Commits realizados

```
df6a4de feat(unify-score-prediction-card): unifica placar real e palpite no card de jogo
54a088d refactor(unify-score-prediction-card): simplifica PredictionDisplay para linha compacta sem bandeiras
87da2f3 chore(unify-score-prediction-card): adiciona plano de implementação
```
