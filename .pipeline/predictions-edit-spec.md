# Spec: Edição de Palpites

**Slug:** predictions-edit
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Permitir que o usuário edite um palpite já criado, desde que faltem mais de 5 minutos para o início do jogo. A feature reutiliza a lógica de deadline existente, adiciona uma política UPDATE no RLS da tabela `predictions`, um endpoint `PATCH /api/predictions/:id` no backend Ruby e modifica `PredictionDisplay` para exibir um botão "EDITAR" que reabre o `PredictionForm` com valores pré-preenchidos.

---

## Histórias de Usuário

- Como participante do bolão, quero poder corrigir meu palpite antes do início do jogo para não ficar preso a um placar que errei ao digitar
- Como participante, quero que o botão de edição só apareça quando ainda há tempo para alterar o palpite, para entender claramente as regras
- Como participante, quero ver o palpite atualizado imediatamente na tela após a edição, sem precisar recarregar a página
- Como participante, quero receber uma mensagem de erro clara caso tente editar após o deadline

---

## Modelo de Dados

### Tabelas modificadas

Nenhuma coluna nova. A tabela `predictions` já tem a estrutura necessária:

```sql
predictions (
  id           uuid        PK,
  user_id      uuid        FK profiles,
  game_id      uuid        FK games,
  home_score   int         NOT NULL CHECK (home_score >= 0),
  away_score   int         NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, game_id)
)
```

O campo `submitted_at` será atualizado no `PATCH` para refletir o horário da última edição.

### Migrations necessárias

#### `db/migrations/20260614_predictions_update_policy.sql`

```sql
-- Migration: Adiciona política UPDATE para edição de palpites
-- Data: 2026-06-14
-- Feature: predictions-edit

-- Policy: usuário autenticado atualiza apenas seus próprios palpites
CREATE POLICY "predictions_update_own"
  ON predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Nota: o deadline (5 minutos antes do jogo) é validado no backend Ruby — não no RLS. O RLS garante apenas que o usuário só edita seus próprios registros. A validação de negócio fica no endpoint.

---

## Backend — Endpoints Ruby/Sinatra

### PATCH /api/predictions/:id

**Arquivo:** `api/predictions.rb` (adicionar ao arquivo existente — o Sinatra já lida com múltiplos métodos/rotas no mesmo arquivo)

**Autenticação:** requerida (Bearer JWT Supabase)

**Parâmetros de rota:**
- `:id` — UUID do palpite a editar

**Body (JSON):**
```json
{
  "home_score": 2,
  "away_score": 1
}
```

**Validações em cascata (na ordem abaixo):**

1. **Autenticação JWT** — extrair `user_id` via `GET /auth/v1/user` com o Bearer token. Falha → 401 `{"error":"unauthorized","message":"Token inválido ou expirado"}`

2. **Existência do palpite** — buscar `predictions` pelo `:id` com `service_role`. Não encontrado → 404 `{"error":"not_found","message":"Palpite não encontrado"}`

3. **Ownership** — verificar se `prediction.user_id == authenticated_user_id`. Diferente → 403 `{"error":"forbidden","message":"Você não pode editar o palpite de outro participante"}`

4. **Deadline** — buscar o jogo via `prediction.game_id`, verificar `match_date`. Se `Time.now >= Time.parse(match_date) - 5*60` → 422 `{"error":"deadline_expired","message":"Prazo encerrado. Não é possível editar o palpite."}`

5. **Validação dos campos** — ambos `home_score` e `away_score` devem ser inteiros `>= 0`. Falha → 422 `{"error":"invalid_scores","message":"Placares devem ser números inteiros não negativos"}`

6. **UPDATE no banco** — `PATCH /rest/v1/predictions?id=eq.:id` com `service_role`. Incluir `submitted_at: Time.now.iso8601` para registrar horário da última edição.

**Resposta de sucesso (200):**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "game_id": "uuid",
  "home_score": 2,
  "away_score": 1,
  "submitted_at": "2026-06-14T14:52:00Z"
}
```

**Erros possíveis:**
- 401: não autenticado ou token inválido
- 403: palpite pertence a outro usuário
- 404: palpite não encontrado
- 422: deadline expirado ou placares inválidos
- 500: erro interno (falha na query ao Supabase)

**Implementação Ruby (pseudocódigo):**

```ruby
patch '/api/predictions/:id' do
  content_type :json
  cors_headers

  # 1. Autenticar JWT
  token = extract_bearer_token(request)
  user = authenticate_user(token)          # GET /auth/v1/user — 401 se falhar

  # 2. Buscar palpite
  prediction = fetch_prediction(params[:id]) # 404 se não existir

  # 3. Verificar ownership
  halt 403, {error:'forbidden',...}.to_json  if prediction['user_id'] != user['id']

  # 4. Verificar deadline
  game = fetch_game(prediction['game_id'])
  deadline = Time.parse(game['match_date']) - 5 * 60
  halt 422, {error:'deadline_expired',...}.to_json if Time.now >= deadline

  # 5. Validar body
  body = JSON.parse(request.body.read)
  home = body['home_score']
  away = body['away_score']
  halt 422, {error:'invalid_scores',...}.to_json unless home.is_a?(Integer) && away.is_a?(Integer) && home >= 0 && away >= 0

  # 6. UPDATE
  result = supabase_patch("/rest/v1/predictions?id=eq.#{params[:id]}",
    { home_score: home, away_score: away, submitted_at: Time.now.iso8601 })
  result.first.to_json
end
```

**CORS:** O handler `options '/api/predictions/:id'` deve ser adicionado para preflight, seguindo o padrão já existente no arquivo.

---

## Frontend — Componentes React

### PredictionDisplay (modificado)

**Arquivo:** `components/bolao/PredictionDisplay.tsx`

**Novas props:**
```typescript
interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  submittedAt?: string        // ISO 8601 — existente
  // NOVAS:
  predictionId?: string       // UUID — necessário para o PATCH
  matchDate?: string          // ISO 8601 — para verificar deadline no frontend
  onEditRequest?: () => void  // Callback chamado ao clicar em "EDITAR"
}
```

**Comportamento:**

- Calcular `isDeadlinePassed` localmente: `new Date(matchDate).getTime() - 5 * 60 * 1000 <= Date.now()`
- Se `!isDeadlinePassed && onEditRequest != null`: exibir botão "✎ EDITAR PALPITE" abaixo do placar
- Se `isDeadlinePassed` ou `onEditRequest == null`: não exibir o botão (comportamento de display puro, compatível com uso em `live`/`finished`)
- O botão chama `onEditRequest()` — sem lógica de fetch aqui; o estado é gerenciado pelo pai

**Estilo do botão EDITAR:**
```
┌────────────────────────────┐
│  ✎ EDITAR PALPITE          │
└────────────────────────────┘
```
- `border: 1px solid var(--color-primary)`
- `color: var(--color-primary)`
- `backgroundColor: transparent` (ghost button, diferente do CTA de confirmar)
- `width: 100%`
- `fontSize: 11px`, `fontWeight: bold`, `textTransform: uppercase`, `letterSpacing: 0.1em`
- `fontFamily: JetBrains Mono`
- `marginTop: 0.5rem`, `padding: 0.35rem`
- `cursor: pointer`
- Hover: `backgroundColor: var(--color-primary)`, `color: var(--color-bg)` (via CSS class ou inline com `onMouseEnter`/`onMouseLeave`)

### PredictionForm (modificado)

**Arquivo:** `components/bolao/PredictionForm.tsx`

**Nova prop:**
```typescript
interface PredictionFormProps {
  gameId: string
  homeTeamCode: string
  awayTeamCode: string
  matchDate: string
  initialPrediction?: Prediction | null  // existente
  // NOVA:
  onCancelEdit?: () => void  // Se presente, exibir botão "CANCELAR" no modo edição
}
```

**Mudanças na lógica de submissão:**

O `PredictionForm` atualmente exibe `PredictionDisplay` quando `submittedPrediction != null`. A edição acontece quando o usuário clica em "EDITAR" no `PredictionDisplay`, o que faz o estado pai resetar para o formulário. O `PredictionForm` precisa saber se está em **modo criação** ou **modo edição** para escolher o método HTTP correto.

**Detecção do modo:**
- Se `initialPrediction != null` E o formulário está sendo exibido (não está mostrando o Display), significa que está no **modo edição**
- Internamente, adicionar `const isEditMode = initialPrediction != null`
- `isEditMode` → usar `PATCH /api/predictions/${initialPrediction.id}`, método `PATCH`
- `!isEditMode` → usar `POST /api/predictions`, método `POST` (comportamento atual)

**Botão de cancelar no modo edição:**
- Se `onCancelEdit` está presente e `isEditMode`, exibir link/botão "CANCELAR" abaixo do botão de confirmar
- Estilo: `color: var(--color-muted)`, `fontSize: 11px`, sem border, cursor pointer, uppercase
- Chamar `onCancelEdit()` ao clicar

**Mensagem de erro específica para edição:**
- Se o servidor retornar `error: 'deadline_expired'` → `'Prazo encerrado. Não é possível editar o palpite.'`
- Se retornar `error: 'forbidden'` → `'Acesso negado.'`

**Estado do botão CTA no modo edição:**
- Label: `SALVAR ALTERAÇÃO` (em vez de `CONFIRMAR PALPITE`)
- Comportamento de loading/disabled igual ao modo criação

### GameCard (modificado)

**Arquivo:** `components/games/GameCard.tsx`

**Mudanças necessárias:**
- Adicionar estado local `isEditing: boolean` (inicializado como `false`)
- Quando `isEditing === false` e há `prediction`:
  - Renderizar `PredictionDisplay` passando `predictionId`, `matchDate`, `onEditRequest={() => setIsEditing(true)}`
- Quando `isEditing === true`:
  - Renderizar `PredictionForm` com `initialPrediction={prediction}` e `onCancelEdit={() => setIsEditing(false)}`
  - Após submit bem-sucedido no `PredictionForm`, o componente já atualiza `submittedPrediction` internamente. O `GameCard` deve reagir à conclusão voltando ao estado de display.

**Problema de sincronização de estado após edição bem-sucedida:**

O `PredictionForm` atualmente gerencia `submittedPrediction` internamente e retorna ao display automaticamente. No modo edição, o `GameCard` também precisa saber que a edição terminou para voltar ao estado `isEditing = false`. 

Solução: adicionar prop `onSuccess?: (updated: Prediction) => void` ao `PredictionForm`. Quando o PATCH retorna sucesso, além de atualizar `submittedPrediction`, chama `onSuccess(updatedPrediction)`. O `GameCard` usa isso para:
1. Atualizar a prop local de prediction (se necessário)
2. Chamar `setIsEditing(false)`

**Passagem de dados:**
O `GameCard` já recebe `prediction?: Prediction | null` como prop. Transformar isso em estado local `useState<Prediction | null>(prediction ?? null)` para poder atualizar após edição bem-sucedida sem reload.

---

## Regras de Negócio

### Deadline de edição

A regra é **idêntica** à de criação:

```
deadline = match_date - 5 minutos

SE now() >= deadline:
  → bloquear edição (frontend desabilita o botão; backend retorna 422)
SE now() < deadline:
  → permitir edição
```

Esta verificação deve ocorrer:
1. **Frontend (display):** calcular ao renderizar `PredictionDisplay` para decidir se exibe o botão "EDITAR"
2. **Frontend (form):** o countdown regressivo já existente no `PredictionForm` também cobre o modo edição automaticamente
3. **Backend:** validação definitiva no `PATCH /api/predictions/:id` antes do UPDATE

### Atualização de `submitted_at`

Ao editar, `submitted_at` é atualizado para o momento da edição. Isso reflete o horário do último envio exibido no `PredictionDisplay` ("editado às 14:55 BRT").

### Status do jogo

O botão "EDITAR" só deve aparecer quando o jogo tem `status === 'pending'`. Jogos `live` ou `finished` nunca permitem edição, independentemente do deadline calculado. O `GameCard` já controla isso — a área de palpite para jogos `live`/`finished` usa `PredictionDisplay` sem `onEditRequest`.

### Constraint UNIQUE

O `PATCH` não viola o `UNIQUE(user_id, game_id)` porque é um UPDATE no registro existente, não um INSERT.

---

## Proteção de Rotas

Nenhuma rota nova. O endpoint `PATCH /api/predictions/:id` segue o mesmo padrão de autenticação JWT já implementado no `POST` e `GET` de `api/predictions.rb`.

---

## Integração Supabase Realtime

Esta feature não adiciona integração Realtime. A atualização do palpite no frontend é feita de forma otimista/síncrona após o retorno do PATCH com 200. Não é necessário observar a tabela `predictions` em tempo real para esta feature.

---

## Critérios de Aceite

- [ ] Usuário com palpite existente vê botão "✎ EDITAR PALPITE" no `PredictionDisplay` quando faltam mais de 5 minutos para o início do jogo
- [ ] Botão "EDITAR" NÃO aparece quando deadline já passou (mesmo que o jogo ainda seja `pending` por algum atraso)
- [ ] Ao clicar em "EDITAR", o formulário reabre com os placares anteriores pré-preenchidos nos inputs
- [ ] Ao clicar em "CANCELAR", o formulário fecha e o `PredictionDisplay` original volta a ser exibido sem modificação
- [ ] Ao salvar a edição, o palpite exibido atualiza imediatamente (sem reload de página) com os novos valores
- [ ] O horário exibido ("editado às HH:MM BRT") reflete o `submitted_at` atualizado retornado pelo PATCH
- [ ] Endpoint `PATCH /api/predictions/:id` retorna 401 sem token JWT válido
- [ ] Endpoint retorna 403 se o `id` pertence a outro usuário
- [ ] Endpoint retorna 404 se o `id` não existe
- [ ] Endpoint retorna 422 com `error: 'deadline_expired'` se a edição ocorrer após o deadline
- [ ] Endpoint retorna 422 com `error: 'invalid_scores'` se os placares não forem inteiros >= 0
- [ ] Migration `20260614_predictions_update_policy.sql` cria política `predictions_update_own` no RLS
- [ ] Política RLS impede UPDATE em registros de outro usuário mesmo com service_role desativado
- [ ] Design segue DESIGN.md: botão "EDITAR" ghost (border color-primary), botão "SALVAR" bg color-primary, fonte monospace, uppercase
- [ ] Funciona em mobile (coluna única, botão full-width)
- [ ] Jogo `live` ou `finished` nunca exibe botão "EDITAR", mesmo que `PredictionDisplay` receba `matchDate`
