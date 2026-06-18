# Changelog: Palpite para Todos os Grupos

**Slug:** predict-all-groups
**Branch:** feature/predict-all-groups
**Data:** 2026-06-18
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handler)

- `app/api/predictions/broadcast/route.ts` — `POST /api/predictions/broadcast`: endpoint dedicado à propagação do palpite para múltiplos grupos.
  - Autenticação JWT via `auth.getUser()` com o anon client (mesmo padrão dos outros endpoints de predictions).
  - Valida `game_id` (UUID), `home_score` e `away_score` (inteiros >= 0) — retorna `422 invalid_params` se inválidos.
  - Busca o jogo e verifica deadline global (match_date - 5min); se expirado, retorna `422 deadline_expired` imediatamente, sem iterar pelos grupos.
  - Busca todos os grupos do usuário via `group_members JOIN groups` (inclui o nome do grupo para o sumário).
  - Para cada grupo: verifica se o jogo ainda está `pending` e dentro do prazo, depois faz UPSERT em `predictions` com `ON CONFLICT (user_id, game_id, group_id) DO UPDATE` (idempotente — funciona tanto para criar quanto para atualizar palpites existentes).
  - Retorna `{ updated_count: N, results: [...] }` com `status: 'saved' | 'deadline_expired'` por grupo.
  - Erros possíveis: `401` (sem autenticação), `404` (jogo não encontrado), `422` (deadline global ou params inválidos), `500` (erro de banco).
  - Falhas de UPSERT em grupos individuais não abortam o loop — o grupo é marcado como `deadline_expired` e o loop continua nos demais.

### Frontend (Next.js/React)

- `components/bolao/PropagatePrompt.tsx` — componente novo de decisão pós-palpite:
  - Quatro estados internos: `idle` (exibe dois botões), `loading` (requisição em andamento), `done` (feedback de resultado com contagem), `error` (mensagem de falha).
  - Estado `idle`: botão "ESTE GRUPO" (`bg: color-border`, `color: color-text`) e botão "TODOS OS GRUPOS" (`bg: color-primary`, `color: color-bg`), lado a lado com `flex-wrap` para empilhamento em telas estreitas (< 360px).
  - Estado `loading`: mensagem "Salvando em outros grupos..." em `color-muted`.
  - Estado `done`: "✓ PALPITE SALVO EM N GRUPOS" em `color-win`; se houver grupos ignorados por deadline expirado, exibe contagem em `color-muted`.
  - Estado `error`: "✗ Erro ao propagar. Palpite salvo apenas neste grupo." em `color-error`.
  - Auto-fechamento: `done` chama `onChooseAll()` após 2s; `error` chama `onChooseSingle()` após 2s (fallback gracioso).
  - Obtém o JWT via `supabase.auth.getSession()` no cliente para a chamada ao endpoint de broadcast.
  - Design segue DESIGN.md: JetBrains Mono, paleta brasileira, sem border-radius, sem ícones SVG.

- `components/bolao/PredictionForm.tsx` — modificado:
  - `FormStatus` ampliado: `'idle' | 'loading' | 'success' | 'propagating' | 'error'`.
  - No modo **criação** (sem `onCancelEdit`): após submit bem-sucedido, vai para `status = 'propagating'` em vez de chamar `onSuccess?.(prediction)` diretamente. O `PropagatePrompt` é renderizado no lugar do formulário.
  - `onChooseSingle` e `onChooseAll` do `PropagatePrompt`: ambos setam `status = 'success'` e chamam `onSuccess?.(submittedPrediction)` para notificar o `GameCard`.
  - No modo **edição** (com `onCancelEdit`): comportamento inalterado — sem prompt de propagação, `onSuccess` chamado diretamente.
  - Condição de exibição do `PredictionDisplay` ajustada: `submittedPrediction && !isEditMode && (status === 'idle' || status === 'success')` — garante que palpites pré-existentes (carregados com `initialPrediction`) continuem exibindo o display no estado `idle`, e que o display apareça após `success` (pós-propagação).
  - **Regressão zero**: props e comportamento externo do componente são idênticos — sem mudança de interface para o `GameCard`.

---

## Decisões técnicas

1. **Broadcast inclui o grupo ativo:** conforme a spec (regra de negócio #3), o endpoint itera sobre todos os grupos do usuário, incluindo o ativo. O UPSERT é idempotente — o palpite já salvo no grupo ativo é sobrescrito com os mesmos valores, sem duplicação. Isso simplifica o endpoint (sem precisar saber qual é o grupo ativo) e garante consistência.

2. **Discriminação modo criação vs edição para exibir PropagatePrompt:** a propagação só faz sentido na criação (primeiro palpite para aquele jogo naquele grupo). Edições são intencionalmente locais — o usuário escolheu editar um palpite específico e não esperaria que mudasse em outros grupos automaticamente. O discriminador `isEditMode` (baseado em `onCancelEdit != null`) foi reutilizado do código existente.

3. **`onChooseSingle` e `onChooseAll` com comportamento idêntico no `PredictionForm`:** ambos chamam `onSuccess?.(submittedPrediction)` — a diferença é que o `PropagatePrompt` faz a chamada de broadcast antes de invocar `onChooseAll`. Do ponto de vista do `PredictionForm`, ambos os caminhos resultam na exibição do `PredictionDisplay`. Isso simplifica o estado do formulário.

4. **Erros de UPSERT por grupo não abortam o loop:** em vez de falhar toda a operação, o endpoint marca o grupo com problema como `deadline_expired` no sumário. Isso é conservador (o palpite no grupo ativo já foi salvo com sucesso antes do broadcast), e o usuário recebe feedback sobre quantos grupos foram atualizados.

5. **`flex: '1 1 120px'` nos botões do `PropagatePrompt`:** permite que os botões fiquem lado a lado em telas normais e empilhem automaticamente em telas muito estreitas (< ~260px) sem media query, usando apenas `flexWrap: 'wrap'`. Isso cobre o requisito mobile < 360px da spec sem adicionar CSS global.

6. **Type cast do join `group_members.groups`:** o Supabase retorna a relação `groups` como array ao fazer `select('group_id, groups(id, name)')`. O código usa `Array.isArray(groupRaw)` para normalizar, evitando o erro TS2352 de conversão incompatível.

---

## Pontos de atenção para o Revisor

1. **Comportamento de regressão no `PredictionDisplay` existente:** a condição `(status === 'idle' || status === 'success')` para exibir o display quando há `submittedPrediction` é nova. Verificar se cobre todos os casos: (a) palpite pré-existente ao abrir o card (`idle`), (b) palpite recém-criado após propagação (`success`), (c) não exibir durante `propagating` (correto — o `PropagatePrompt` ocupa o lugar).

2. **UPSERT vs INSERT no endpoint original:** o `POST /api/predictions` usa `INSERT` e rejeita duplicatas com `422 already_submitted`. O `POST /api/predictions/broadcast` usa `UPSERT` — se o usuário já tiver palpite em outros grupos, ele é atualizado silenciosamente. Esse comportamento está alinhado com a spec (regra #2), mas é diferente do comportamento do endpoint principal.

3. **O grupo ativo recebe UPSERT idempotente no broadcast:** o palpite do grupo ativo já foi salvo pelo fluxo normal antes do `PropagatePrompt` aparecer. O broadcast vai sobrescrever com os mesmos valores — sem perda de dados, mas gera uma escrita desnecessária no banco para o grupo ativo. A spec é explícita sobre isso (regra #3).

4. **`npm run lint` retorna 2 erros e 5 warnings pre-existentes**, nenhum introduzido por esta feature. Confirmado via `git stash` + lint antes das nossas mudanças: saída idêntica. Os arquivos com erros são `group-switcher.tsx` e `GroupChatWidget.tsx` (features anteriores).

5. **`npm run build` passa sem erros**, incluindo a rota `/api/predictions/broadcast` listada como dinâmica (`ƒ`).

---

---

## Correções Fix 1

### Problema corrigido

**Botões do PropagatePrompt não empilhavam em telas < 360px**

- **Arquivo:** `components/bolao/PropagatePrompt.tsx`
- **Causa:** Os botões usavam `flex: '1 1 120px'`. Com gap de 8px, dois botões de 120px = 248px de conteúdo — cabem lado a lado em qualquer container >= 248px. Num viewport de 360px com ~24px de padding externo, o container mede ~336px, então os botões nunca empilhavam.
- **Correção:** Substituído `flex: '1 1 120px'` por `flex: '1 1 45%'` + `minWidth: '120px'` nos dois botões. Com `flexWrap: 'wrap'`, cada botão ocupa 45% do container. Em containers menores que ~267px (viewport < 360px com paddings externos), os botões empilham verticalmente, cobrindo o critério da spec.

---

## Commits realizados

```
02079f6 fix(predict-all-groups): corrige empilhamento dos botões do PropagatePrompt em telas < 360px
3aa9ec0 feat(predict-all-groups): modifica PredictionForm para estado propagating e integra PropagatePrompt
36e0da2 feat(predict-all-groups): adiciona componente PropagatePrompt
0504ab5 feat(predict-all-groups): adiciona endpoint POST /api/predictions/broadcast
9590b4b chore(predict-all-groups): adiciona plano de implementação
```
