# Changelog: Corrigir Propagação de Palpites no Modo de Edição

**Slug:** fix-predict-edit-propagation
**Branch:** feature/fix-predict-edit-propagation
**Data:** 2026-06-18
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/PredictionForm.tsx` — Removida a bifurcação `if (isEditMode) { setStatus('success'); onSuccess?.(updatedPrediction) } else { setStatus('propagating') }` dentro do bloco `if (res.ok)` do `handleSubmit`. Agora, após qualquer submit bem-sucedido (criação ou edição), o status vai diretamente para `'propagating'`, exibindo o `PropagatePrompt` com as opções "ESTE GRUPO" / "TODOS OS GRUPOS".

### Backend (Ruby/Sinatra)

Nenhuma alteração. O endpoint `POST /api/predictions/broadcast` já suporta UPSERT idempotente e funciona igualmente para criação e edição.

### Banco de Dados

Nenhuma alteração de schema, migration ou RLS policies.

---

## Decisões técnicas

A correção é intencionalmente cirúrgica: 9 linhas removidas e 2 mantidas. O `PropagatePrompt` já era agnóstico ao modo (criação vs. edição) e os handlers `onChooseSingle`/`onChooseAll` já chamavam `onSuccess` corretamente. O único ponto de falha era a bifurcação prematura que impedia o estado `'propagating'` de ser atingido no modo de edição.

A guarda `!isEditMode` na condição de exibição do `PredictionDisplay` interno permanece correta: no modo edição, após `onSuccess` ser chamado via `PropagatePrompt`, o `GameCard` pai desmonta o `PredictionForm`, então o display interno nunca é exibido durante o fluxo de edição.

---

## Pontos de atenção para o Revisor

1. Verificar que a condição de exibição do `PredictionDisplay` interno (linha 109) permanece inalterada e continua correta com `!isEditMode`.
2. Verificar que o botão "CANCELAR" no modo edição (que chama `onCancelEdit` antes do submit) não é afetado.
3. Verificar que o modo de criação continua funcionando sem regressão — o caminho já passava pelo `setStatus('propagating')`.
4. Os 2 erros de lint preexistentes (`group-switcher.tsx` e `GroupChatWidget.tsx`) não foram introduzidos por esta mudança — confirmado via `git stash` antes e depois.

---

## Commits realizados

```
4279b62 feat(fix-predict-edit-propagation): exibe PropagatePrompt após salvar palpite no modo de edição
0936235 chore(fix-predict-edit-propagation): adiciona plano de implementação
```
