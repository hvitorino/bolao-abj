# Changelog: Edição de Palpites

**Slug:** predictions-edit
**Branch:** feature/predictions-edit
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js Route Handler)

- `app/api/predictions/[id]/route.ts` — Endpoint `PATCH /api/predictions/:id` com validações em cascata na ordem correta:
  1. Autenticação JWT via `auth.getUser(jwt)` com o anon client do Supabase
  2. Validação de UUID do parâmetro `:id`
  3. Busca do palpite existente (service_role) — 404 se não encontrado
  4. Verificação de ownership — 403 se `prediction.user_id !== user.id`
  5. Busca do jogo e verificação de deadline (5 min antes de `match_date`) — 422 `deadline_expired` se expirado
  6. Validação do body (`home_score` e `away_score` inteiros >= 0) — 422 `invalid_scores` se inválido
  7. UPDATE no banco com `submitted_at` atualizado para o momento da edição
  - Resposta 200 com o palpite atualizado (`id, user_id, game_id, home_score, away_score, submitted_at`)
  - Segue exatamente o mesmo padrão de autenticação do `GET`/`POST` em `app/api/predictions/route.ts`

### Frontend (Next.js/React)

- `components/bolao/PredictionDisplay.tsx` — Adicionadas props `predictionId?`, `matchDate?` e `onEditRequest?`:
  - Calcula `isDeadlinePassed` localmente: `Date.now() >= new Date(matchDate).getTime() - 5*60*1000`
  - Botão "✎ EDITAR PALPITE" visível somente quando `onEditRequest != null && matchDate != null && !isDeadlinePassed`
  - Estilo ghost: borda `color-primary`, fundo transparente com hover invertido (bg `color-primary`, texto `color-bg`) via `onMouseEnter`/`onMouseLeave`
  - Componente agora requer `"use client"` para o estado `isHoveringEdit`
  - Retrocompatível: quando chamado sem as novas props, comportamento idêntico ao anterior (sem botão EDITAR)

- `components/bolao/PredictionForm.tsx` — Adicionadas props `onCancelEdit?` e `onSuccess?`:
  - Detecção de modo edição: `isEditMode = initialPrediction != null && onCancelEdit != null`
  - No modo edição: `submittedPrediction` inicia como `null` (não pula para o display automaticamente) e exibe o formulário pré-preenchido com os valores do `initialPrediction`
  - Submit no modo edição usa `PATCH /api/predictions/:id` em vez de `POST /api/predictions`
  - Erros específicos mapeados: `deadline_expired` → mensagem PT-BR; `forbidden` → "Acesso negado."
  - Botão CTA: "SALVAR ALTERAÇÃO" em modo edição vs "CONFIRMAR PALPITE" em modo criação
  - Botão "CANCELAR" abaixo do CTA (somente modo edição, somente antes do deadline) — chama `onCancelEdit()`
  - Ao concluir com sucesso, chama `onSuccess(updatedPrediction)` para notificar o pai
  - Título do painel: "EDITAR PALPITE" em modo edição vs "SEU PALPITE" em modo criação

- `components/games/GameCard.tsx` — Adicionados estado `isEditing: boolean` e `currentPrediction: Prediction | null`:
  - `currentPrediction` inicializa com a prop `prediction` e atualiza após criação ou edição bem-sucedida (sem reload de página)
  - Lógica para `isPending` separada em 3 ramos exclusivos:
    1. `isEditing && currentPrediction` → `PredictionForm` em modo edição (com `onCancelEdit` e `onSuccess`)
    2. `currentPrediction && !isEditing` → `PredictionDisplay` com `matchDate` e `onEditRequest` (mostra botão EDITAR)
    3. `!currentPrediction && !isEditing` → `PredictionForm` em modo criação puro
  - Jogos `live`/`finished` continuam usando `PredictionDisplay` sem `matchDate`/`onEditRequest` — botão EDITAR nunca aparece
  - `handleEditSuccess(updated)`: atualiza `currentPrediction` e reseta `isEditing = false`

### Banco de Dados

- `db/migrations/20260614_predictions_update_policy.sql` — Política RLS UPDATE `predictions_update_own`:
  ```sql
  CREATE POLICY "predictions_update_own"
    ON predictions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```
  - Garante que usuários autenticados só podem atualizar seus próprios registros
  - Complementa a validação de deadline no backend (que não pode ser feita via RLS)
  - A migration deve ser executada manualmente no Supabase SQL Editor

---

## Decisões técnicas

1. **Next.js Route Handler em vez de Ruby/Sinatra:** A spec menciona Ruby/Sinatra, mas o projeto já migrou os endpoints de predictions para Next.js Route Handlers (conforme changelogs anteriores e o estado atual de `app/api/predictions/route.ts`). O `PATCH` segue o mesmo padrão.

2. **`isEditMode` baseado em `onCancelEdit` (não só `initialPrediction`):** `initialPrediction` pode ser passado tanto no modo normal (para pré-preencher inputs ao criar) quanto no modo edição. Usar `onCancelEdit != null` como discriminador garante que o formulário só entra em modo edição quando explicitamente ativado pelo botão EDITAR, evitando que a presença de um palpite existente acidentalmente ative o PATCH.

3. **`currentPrediction` como estado local no GameCard:** Converte a prop `prediction` em estado local para permitir atualização imediata após criação ou edição sem prop drilling de callback até a página pai (Server Component). A página `/jogos` não precisa ser alterada.

4. **Três ramos exclusivos no `isPending` do GameCard:** A lógica anterior do `PredictionForm` internamente alternava entre formulário e display. Com a edição, a responsabilidade de mostrar o display com botão EDITAR precisa estar no `GameCard` (para poder passar `onEditRequest`). Os três ramos eliminam qualquer ambiguidade de estado.

5. **`PredictionDisplay` como `"use client"`:** Necessário apenas para o `useState(isHoveringEdit)` do botão ghost. Alternativa seria CSS puro (`:hover`), mas inline styles não suportam pseudo-classes — e adicionar uma classe CSS global para este caso específico polui o globals.css. O `useState` é a solução mais localizada.

---

## Pontos de atenção para o Revisor

1. **Migration não executada automaticamente:** A política RLS `predictions_update_own` precisa ser aplicada manualmente no Supabase SQL Editor antes da feature funcionar com segurança a nível de banco.

2. **Verificação de deadline dupla no modo edição:** O frontend calcula o deadline no `PredictionDisplay` (para mostrar/ocultar o botão) e no `PredictionForm` (countdown e `isDeadlinePassed`). O backend re-valida definitivamente. Três camadas de proteção são intencionais.

3. **`PredictionForm` no modo criação com `initialPrediction={null}` explícito:** O GameCard passa `initialPrediction={null}` para o formulário de criação para garantir que TypeScript entenda que é modo criação, sem depender do valor default da prop.

4. **Botão CANCELAR só aparece antes do deadline:** Se o deadline expirar enquanto o formulário de edição está aberto, o botão CANCELAR some junto com o botão SALVAR (pois `isDeadlinePassed` passa a ser `true`). O usuário não fica preso — pode recarregar a página. Seria possível sempre exibir CANCELAR independente do deadline, mas a spec não exige isso.

5. **`submitted_at` atualizado para "editado às":** O `PredictionDisplay` exibe "enviado às HH:MM BRT" tanto para palpites criados quanto editados. A spec menciona "editado às" mas não há campo separado de `updated_at` na tabela. O comportamento atual é consistente: `submitted_at` reflete o último envio (seja criação ou edição).

---

## Commits realizados

```
464449e feat(predictions-edit): modifica GameCard com estado isEditing e coordenação display/form/edição
03c33d6 feat(predictions-edit): modifica PredictionForm com modo edição, PATCH, botão CANCELAR e SALVAR ALTERAÇÃO
3cab8bd feat(predictions-edit): modifica PredictionDisplay com botão EDITAR ghost e verificação de deadline
6489707 feat(predictions-edit): adiciona endpoint PATCH /api/predictions/[id] com validações em cascata
5a5b1d6 feat(predictions-edit): adiciona migration SQL com política RLS UPDATE predictions_update_own
a6994df chore(predictions-edit): adiciona plano de implementação
```
