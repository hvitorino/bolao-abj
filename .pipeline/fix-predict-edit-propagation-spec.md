# Spec: Corrigir Propagação de Palpites no Modo de Edição

**Slug:** fix-predict-edit-propagation
**Data:** 2026-06-18
**Status:** spec

---

## Objetivo

Após salvar um palpite no modo de edição (`isEditMode === true`), exibir o `PropagatePrompt` com as opções "ESTE GRUPO" / "TODOS OS GRUPOS" — exatamente o mesmo fluxo que já existe no modo de criação. Atualmente o modo de edição ignora o estado `'propagating'` e notifica o pai diretamente, pulando a tela de propagação.

---

## Histórias de Usuário

- Como participante do bolão, quero que após editar um palpite eu veja as opções de propagar para outros grupos, para aplicar minha correção em todos os bolões em que participo de uma vez.
- Como participante do bolão, quero que se eu escolher "ESTE GRUPO" após editar, apenas o grupo ativo seja atualizado, sem afetar meus palpites nos outros grupos.
- Como participante do bolão, quero que o fluxo de criação de palpite continue funcionando exatamente como antes, sem nenhuma regressão.

---

## Modelo de Dados

Nenhuma alteração de schema, migration ou endpoint. O `POST /api/predictions/broadcast` já existe e suporta tanto criação quanto edição via UPSERT idempotente.

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma alteração de backend. O endpoint `POST /api/predictions/broadcast` já é compatível:

- Aceita `{ game_id, home_score, away_score }`.
- Itera por todos os grupos do usuário e faz UPSERT (funciona para criar ou sobrescrever palpite existente).
- Respeita deadline de cada grupo individualmente.
- Retorna `{ updated_count: N, results: [...] }`.

A única preocupação é que o UPSERT no endpoint de broadcast também vai gravar no grupo ativo (que já foi atualizado pelo PATCH anterior). Isso é idempotente — sobrescreve com os mesmos valores — e é o mesmo comportamento documentado na decisão técnica #1 do changelog da feature `predict-all-groups`.

---

## Frontend — Componentes React

### PredictionForm

**Arquivo:** `components/bolao/PredictionForm.tsx`

**Problema atual (linha 214–220):**

```typescript
if (isEditMode) {
  // Modo edição: comportamento original — notifica o pai diretamente
  setStatus('success')
  onSuccess?.(updatedPrediction)
} else {
  // Modo criação: vai para 'propagating' para perguntar se propaga
  setStatus('propagating')
}
```

**Correção:**

Remover a bifurcação `isEditMode / else`. Após qualquer submit bem-sucedido (criação ou edição), sempre ir para `status = 'propagating'`. O callback `onSuccess` é chamado dentro dos handlers `onChooseSingle`/`onChooseAll` do `PropagatePrompt` — que já existem e estão corretos.

O bloco `if (res.ok)` no `handleSubmit` passa a ser:

```typescript
if (res.ok) {
  const updatedPrediction = data as Prediction
  setSubmittedPrediction(updatedPrediction)
  // Sempre vai para 'propagating' — criação e edição
  setStatus('propagating')
}
```

**Estados internos afetados:**

- `'propagating'`: agora também é atingido via modo edição. O guard `if (status === 'propagating' && submittedPrediction)` (linha 85) já renderiza o `PropagatePrompt` corretamente — sem nenhuma mudança nesse bloco.

**Impacto no `onCancelEdit`:**

No modo edição, o botão "CANCELAR" chama `onCancelEdit` diretamente (sem envio de form). Esse fluxo não é afetado pela mudança — o cancelamento ocorre antes do submit.

**Impacto no `PredictionDisplay` pós-propagação em modo edição:**

Após o usuário escolher "ESTE GRUPO" ou "TODOS OS GRUPOS" no `PropagatePrompt`, os handlers existentes fazem:

```typescript
onChooseSingle={() => {
  setStatus('success')
  onSuccess?.(submittedPrediction)
}}
onChooseAll={() => {
  setStatus('success')
  onSuccess?.(submittedPrediction)
}}
```

Quando `onSuccess` é chamado, o `GameCard` pai recebe a prediction atualizada e fecha o formulário de edição (exibindo `PredictionDisplay` no nível do `GameCard`). O `PredictionForm` em si vai para `status = 'success'` e `isEditMode = true` com `submittedPrediction` preenchido — mas nesse ponto o componente está prestes a ser desmontado pelo `GameCard`, então não há inconsistência visual.

**Verificação de regressão no `PredictionDisplay` interno:**

A condição de exibição do display interno (linha 109):

```typescript
if (
  submittedPrediction &&
  !isEditMode &&
  (status === 'idle' || status === 'success')
)
```

- `!isEditMode` garante que o display interno não aparece durante edição — essa guarda continua correta.
- No modo edição, após `onSuccess` o componente é desmontado pelo pai — o display interno nunca chega a ser exibido durante o fluxo de edição.

Nenhuma mudança nessa condição é necessária.

---

### PropagatePrompt

**Arquivo:** `components/bolao/PropagatePrompt.tsx`

Nenhuma alteração. O componente já é agnóstico ao modo (criação vs. edição) — ele recebe `gameId`, `homeScore`, `awayScore` e os callbacks `onChooseSingle`/`onChooseAll`. O broadcast para todos os grupos via UPSERT funciona igualmente para edição.

---

## Regras de Negócio

1. **Propagação em edição é opt-in:** O usuário vê o prompt e escolhe explicitamente. Não há propagação automática.

2. **"ESTE GRUPO" em edição:** Fecha o prompt sem fazer broadcast. O PATCH já atualizou apenas o grupo ativo — comportamento correto.

3. **"TODOS OS GRUPOS" em edição:** Chama `POST /api/predictions/broadcast` com os novos scores. O UPSERT sobrescreve o palpite nos demais grupos (incluindo o grupo ativo de forma idempotente, já que o PATCH já o atualizou). Apenas grupos com deadline ativo recebem a atualização.

4. **Deadline por grupo:** O endpoint de broadcast já verifica o deadline individualmente para cada grupo. Um grupo com deadline expirado é marcado como `deadline_expired` no retorno e ignorado — comportamento idêntico ao fluxo de criação.

5. **Autorização:** O PATCH `/api/predictions/:id` já valida que o `prediction.user_id` pertence ao usuário autenticado. O broadcast reitera a autenticação JWT. Nenhum usuário consegue editar palpites de terceiros.

6. **Regressão zero no modo criação:** O fluxo de criação não é afetado — a remoção do branch `isEditMode` no `handleSubmit` unifica o comportamento, e o caminho de criação já passava pelo `setStatus('propagating')`.

---

## Proteção de Rotas

Nenhuma alteração. O `PredictionForm` é usado dentro de rotas já protegidas do dashboard (`/jogos`, `/meus-palpites`).

---

## Integração Supabase Realtime

Nenhuma alteração. O fluxo de propagação é via fetch HTTP (`POST /api/predictions/broadcast`) — não usa Realtime diretamente.

---

## Critérios de Aceite

- [ ] No modo de edição, após clicar em "SALVAR ALTERAÇÃO" e receber resposta 200, o formulário é substituído pelo `PropagatePrompt` com os botões "ESTE GRUPO" e "TODOS OS GRUPOS"
- [ ] Escolhendo "ESTE GRUPO" no modo edição: o prompt fecha, o `GameCard` retorna ao estado de exibição do palpite atualizado (via `onSuccess`), sem broadcast
- [ ] Escolhendo "TODOS OS GRUPOS" no modo edição: `POST /api/predictions/broadcast` é chamado com os scores atualizados; após 2s de feedback de sucesso (`done`), `onSuccess` é chamado e o `GameCard` retorna ao estado de exibição
- [ ] Em caso de erro no broadcast durante edição: após 2s o prompt fecha via `onChooseSingle()`, e `onSuccess` é chamado (o palpite do grupo ativo já foi salvo com sucesso pelo PATCH)
- [ ] No modo de criação, o comportamento é idêntico ao atual — sem regressão
- [ ] Palpites pré-existentes exibidos no `PredictionDisplay` (status `idle` com `initialPrediction`) continuam aparecendo normalmente
- [ ] O botão "CANCELAR" no modo edição continua funcionando antes de qualquer submit
- [ ] `npm run lint` passa sem erros ou warnings novos introduzidos por esta mudança
- [ ] `npm run build` passa sem erros
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot) — sem alteração visual, pois o `PropagatePrompt` já está implementado
- [ ] Funciona em mobile (coluna única; botões empilham em telas < 360px conforme fix-1 do changelog de `predict-all-groups`)

---

## Diff esperado

A mudança é mínima e cirúrgica. Apenas `components/bolao/PredictionForm.tsx` é modificado.

O bloco dentro de `if (res.ok)` em `handleSubmit` passa de:

```typescript
const updatedPrediction = data as Prediction
setSubmittedPrediction(updatedPrediction)

if (isEditMode) {
  setStatus('success')
  onSuccess?.(updatedPrediction)
} else {
  setStatus('propagating')
}
```

para:

```typescript
const updatedPrediction = data as Prediction
setSubmittedPrediction(updatedPrediction)
setStatus('propagating')
```

Nenhum outro arquivo precisa ser alterado.
