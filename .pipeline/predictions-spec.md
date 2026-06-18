# Spec: Palpites (Predictions) — v2

**Slug:** predictions
**Data:** 2026-06-13
**Status:** spec
**Revisão:** v2 — adiciona UPSERT (edição antes do deadline) e rota `/meus-palpites`

---

## Objetivo

Permitir que cada participante registre **e edite** seu palpite de placar (dois inteiros: casa × visitante) para cada jogo da Copa 2026, enquanto o deadline não expirar. O deadline é 5 minutos antes do início da partida — bloqueio aplicado tanto no frontend (inputs desabilitados) quanto no backend (validação server-side). Palpites já enviados são exibidos com destaque visual. Após o deadline, não é possível criar ou alterar palpite. A rota `/meus-palpites` exibe o histórico completo do usuário.

### Estado atual (v1 — já implementado e aprovado)

A implementação v1 está **aprovada e em produção** nos seguintes arquivos:
- `api/predictions.rb` — POST (INSERT apenas) e GET
- `components/bolao/PredictionForm.tsx` — formulário com countdown
- `components/bolao/PredictionDisplay.tsx` — exibição de palpite enviado
- `components/games/GameCard.tsx` — integração com PredictionForm/Display
- `components/games/GameList.tsx` — repasse de predictions
- `app/(dashboard)/jogos/page.tsx` — busca predictions server-side
- `app/(dashboard)/meus-palpites/page.tsx` — histórico de palpites
- `lib/types/prediction.ts` — tipo TypeScript
- `db/migrations/20260613_create_predictions.sql` — tabela, índices, RLS (SELECT + INSERT)

### Delta v2 — o que precisa mudar

| Componente | O que muda |
|---|---|
| `api/predictions.rb` | POST passa a ser UPSERT: se palpite existe e deadline não passou → UPDATE; se não existe → INSERT |
| `components/bolao/PredictionForm.tsx` | Quando `initialPrediction` existe e deadline não passou → exibir form pré-preenchido para edição; botão "ALTERAR PALPITE" |
| `db/migrations/` | Nova migration adicionando RLS UPDATE policy na tabela `predictions` |

**Tudo o mais permanece como está — não alterar.**

---

## Histórias de Usuário

- Como participante, quero registrar meu palpite de placar para um jogo antes do deadline, para competir com os demais no bolão
- Como participante, quero **alterar** meu palpite já enviado enquanto o deadline não expirou, para corrigir um erro de digitação ou mudar de opinião
- Como participante, quero ver meu palpite confirmado diretamente no card do jogo, para saber que foi registrado corretamente
- Como participante, quero ser impedido de criar ou alterar palpite após o deadline, para garantir a integridade do bolão
- Como participante, quero ver um countdown regressivo quando faltam menos de 2h para o jogo, para saber quando meu prazo encerra
- Como participante, quero acessar `/meus-palpites` para ver todos os meus palpites com resultado e pontuação

---

## Modelo de Dados

### Tabela `predictions` (sem alteração de schema)

```sql
predictions (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id      uuid         NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_score   int          NOT NULL CHECK (home_score >= 0),
  away_score   int          NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz  DEFAULT now(),
  UNIQUE(user_id, game_id)
)
```

### Migrations necessárias

#### Nova migration: `db/migrations/20260613_predictions_update_policy.sql`

```sql
-- Migration: Adiciona política UPDATE para palpites (necessário para UPSERT v2)
-- Data: 2026-06-13
-- Feature: predictions v2

-- Policy: usuário autenticado pode atualizar apenas seus próprios palpites
-- Nota: a validação de deadline é responsabilidade do backend Ruby (não RLS)
CREATE POLICY "predictions_update_own"
  ON predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Nota:** A imutabilidade pós-deadline é garantida pelo backend Ruby (validação de `match_date - 5min`), não pelo RLS. O RLS apenas garante que o usuário não acesse dados de outros participantes.

---

## Backend — Endpoints Ruby/Sinatra

### POST /api/predictions (UPSERT)

**Arquivo:** `api/predictions.rb`
**Autenticação:** requerida (JWT Supabase via `Authorization: Bearer <token>`)
**Sem alteração na assinatura HTTP** — mesmo endpoint, mesma URL, mesma interface de request/response para o frontend.

**Body (JSON):**
```json
{
  "game_id": "uuid",
  "home_score": 2,
  "away_score": 1
}
```

**Fluxo de validações (na ordem — inalterado até o passo 5):**
1. Header `Authorization: Bearer <token>` presente e válido — se ausente/inválido: 401
2. `game_id` presente e UUID válido — se ausente/inválido: 422
3. `home_score` e `away_score` presentes, inteiros Ruby, >= 0 — se inválido: 422
4. Jogo existe no banco — se não encontrado: 404
5. `now() < match_date - 5 minutos` — se deadline expirado: 422 com `{ "error": "deadline_expired" }`

**Passo 6 — UPSERT (alteração v2):**

```
6a. Verificar se já existe palpite para (user_id, game_id)
    — se NÃO existe → INSERT → retornar 201 com palpite criado
    — se EXISTE → PATCH (UPDATE) → retornar 200 com palpite atualizado
```

**Implementação do UPDATE no Ruby:**

```ruby
# Verificar existência
res = supabase_request(
  :get,
  '/predictions',
  params: "user_id=eq.#{user_id}&game_id=eq.#{game_id}&select=id",
  use_service_role: true
)
existing = JSON.parse(res.body) rescue []

if existing && existing.length > 0
  # UPDATE — PATCH no Supabase REST
  res = supabase_request(
    :patch,
    "/predictions",
    params: "user_id=eq.#{user_id}&game_id=eq.#{game_id}",
    body: {
      home_score:   home_score,
      away_score:   away_score,
      submitted_at: now.iso8601
    },
    use_service_role: true
  )
  # ... tratar resposta, retornar 200
else
  # INSERT — comportamento v1 inalterado
  res = supabase_request(
    :post,
    '/predictions',
    body: { user_id:, game_id:, home_score:, away_score:, submitted_at: now.iso8601 },
    use_service_role: true
  )
  # ... tratar resposta, retornar 201
end
```

**Nota sobre `supabase_request` com `:patch`:** O helper existente usa `case method` para criar o objeto Net::HTTP. Adicionar `when :patch then Net::HTTP::Patch.new(uri)` ao `case` statement.

**Resposta de sucesso — INSERT (201):**
```json
{
  "id": "uuid",
  "game_id": "uuid",
  "user_id": "uuid",
  "home_score": 2,
  "away_score": 1,
  "submitted_at": "2026-06-13T12:00:00Z"
}
```

**Resposta de sucesso — UPDATE (200):**
```json
{
  "id": "uuid",
  "game_id": "uuid",
  "user_id": "uuid",
  "home_score": 3,
  "away_score": 0,
  "submitted_at": "2026-06-13T12:05:00Z"
}
```

**Erros possíveis:**
- 401: token ausente ou inválido
- 404: jogo não encontrado
- 422 `invalid_params`: dados inválidos
- 422 `deadline_expired`: `now() >= match_date - 5min`
- 500: erro interno

**O erro `already_submitted` (422) é removido na v2.** Re-envio antes do deadline é permitido e resulta em UPDATE.

### GET /api/predictions?game_id=UUID

**Sem alteração.** Mantém comportamento v1.

---

## Frontend — Componentes React

### PredictionForm (alteração v2)

**Arquivo:** `components/bolao/PredictionForm.tsx`
**Tipo:** Client Component (`"use client"`)

**Props (inalteradas):**
```typescript
interface PredictionFormProps {
  gameId: string
  homeTeamCode: string
  awayTeamCode: string
  matchDate: string      // ISO 8601
  initialPrediction?: Prediction | null
}
```

**Máquina de estados de renderização (v2):**

| Condição | O que renderizar |
|---|---|
| `submittedPrediction` existe E deadline **não** passou | Formulário pré-preenchido (modo edição) |
| `submittedPrediction` existe E deadline **passou** | `<PredictionDisplay>` (somente leitura) |
| `submittedPrediction` é null E deadline **não** passou | Formulário vazio (modo criação) |
| `submittedPrediction` é null E deadline **passou** | Inputs desabilitados + "✗ PRAZO ENCERRADO" |

**Comportamento no modo edição (novo em v2):**
- Inputs iniciam pré-preenchidos com `initialPrediction.home_score` e `initialPrediction.away_score` — já está no código v1 (`useState` com `String(initialPrediction.home_score)`)
- Título muda de "SEU PALPITE" para "✎ ALTERAR PALPITE" quando `submittedPrediction != null && !isDeadlinePassed`
- Botão de submit exibe "ALTERAR PALPITE" no modo edição e "CONFIRMAR PALPITE" no modo criação
- Após UPDATE bem-sucedido (200): atualizar `submittedPrediction` com os novos dados retornados — o formulário **não** some; permanece em modo de edição até o deadline expirar

**Mudança crítica no `handleSubmit`:**

Na v1, o formulário trata `already_submitted` como erro. Na v2, o backend não retorna mais esse erro (UPSERT). O frontend deve:
- `res.status === 201` → INSERT confirmado → atualizar `submittedPrediction`
- `res.status === 200` → UPDATE confirmado → atualizar `submittedPrediction`
- Ambos resultam em feedback "✓ PALPITE REGISTRADO" ou "✓ PALPITE ATUALIZADO" conforme o caso

**Remoção da early return (mudança central):**

```typescript
// v1 — REMOVER esta lógica:
if (submittedPrediction) {
  return <PredictionDisplay ... />
}

// v2 — substituir por:
if (submittedPrediction && isDeadlinePassed) {
  return <PredictionDisplay ... />
}
// Se submittedPrediction existe mas deadline NÃO passou → continua renderizando o formulário
```

**Feedback de sucesso após edição:**
```
✓ PALPITE ATUALIZADO  (em color-win, exibido por 3 segundos acima do botão)
```

**Design do modo edição — Card de Palpite (DESIGN.md):**
```
┌──────────────────────────────────────────────────────┐
│  ✎ ALTERAR PALPITE                                   │
│  ─────────────────────────────────────────────────── │
│    BRA  [ 2 ]  ×  [ 1 ]  ARG                        │
│                                                      │
│  ⏱ FECHA EM 47min                                   │
│  [   ALTERAR PALPITE   ]                             │
└──────────────────────────────────────────────────────┘
```

- Título "✎ ALTERAR PALPITE": `color: var(--color-accent)`, `font-size: 10px`, uppercase
- Container: `border: 1px solid var(--color-accent)` (em vez de `color-border`) para indicar modo edição
- Demais estilos idênticos ao modo criação

**Estados internos — sem alteração de estrutura:**
- `homeScore: string`, `awayScore: string`
- `status: 'idle' | 'loading' | 'success' | 'error'`
- `errorMessage: string | null`
- `submittedPrediction: Prediction | null`
- `minutesRemaining: number`
- Novo: `successMessage: string | null` — para feedback temporário de "PALPITE ATUALIZADO"

### PredictionDisplay (sem alteração)

**Arquivo:** `components/bolao/PredictionDisplay.tsx` — manter exatamente como está.

### GameCard (sem alteração)

**Arquivo:** `components/games/GameCard.tsx` — manter exatamente como está.
O `GameCard` já passa `initialPrediction={prediction}` para `PredictionForm` — comportamento correto.

### GameList (sem alteração)

**Arquivo:** `components/games/GameList.tsx` — manter exatamente como está.

### Página /jogos (sem alteração)

**Arquivo:** `app/(dashboard)/jogos/page.tsx` — manter exatamente como está.

### Página /meus-palpites (sem alteração)

**Arquivo:** `app/(dashboard)/meus-palpites/page.tsx` — já implementada, manter como está.

---

## Tipos TypeScript

**Arquivo:** `lib/types/prediction.ts` — sem alteração.

```typescript
export interface Prediction {
  id: string
  user_id: string
  game_id: string
  home_score: number
  away_score: number
  submitted_at: string
}
```

---

## Regras de Negócio

### Cálculo do Deadline (inalterado)

```
deadline = match_date - 5 minutos
agora = now() (UTC)
isDeadlinePassed = agora >= deadline
```

**No frontend (JavaScript):**
```javascript
const deadline = new Date(matchDate).getTime() - (5 * 60 * 1000)
const isDeadlinePassed = Date.now() >= deadline
const minutesRemaining = Math.floor((deadline - Date.now()) / 60000)
```

**No backend (Ruby):**
```ruby
match_date = Time.parse(game['match_date']).utc
deadline   = match_date - (5 * 60)
now        = Time.now.utc
if now >= deadline
  # rejeitar com 422 deadline_expired
end
```

### Regra de UPSERT (nova em v2)

```
Recebeu POST /api/predictions com game_id X, user_id Y:
  1. Deadline ainda não expirou? → continua
  2. Já existe predictions WHERE user_id=Y AND game_id=X?
     SIM → UPDATE predictions SET home_score=?, away_score=?, submitted_at=now() WHERE user_id=Y AND game_id=X
           → retornar 200 com palpite atualizado
     NÃO → INSERT predictions (user_id, game_id, home_score, away_score, submitted_at)
           → retornar 201 com palpite criado
```

### Exibição do Countdown (inalterado)

```
minutesRemaining > 120  → não exibe countdown
120 >= minutes > 30     → "⏱ FECHA EM Xh Ymin" em color-muted
30 >= minutes > 0       → "⏱ FECHA EM Xmin" em color-error (bold)
minutes <= 0            → "✗ PRAZO ENCERRADO" em color-error
```

### Busca de Palpites para Edição

Quando o usuário acessa `/jogos`, a página Server Component já busca `predictionsByGameId` e repassa para cada `GameCard` via `initialPrediction`. O `PredictionForm` recebe o palpite existente e, se o deadline não passou, exibe o formulário pré-preenchido para edição.

**Não há nova query necessária** — o mecanismo já existe; apenas o `PredictionForm` precisa mudar seu comportamento de renderização.

---

## Proteção de Rotas

Sem alteração. Todas as rotas estão dentro de `app/(dashboard)/` que já verifica autenticação via `app/(dashboard)/layout.tsx`. O endpoint `/api/predictions` valida o JWT Supabase no header `Authorization`.

---

## Integração Supabase Realtime

Não aplicável para esta feature. Palpites são privados por usuário (RLS).

---

## Critérios de Aceite

### Funcionalidade existente (manter)
- [ ] Na página `/jogos`, cada `GameCard` exibe a área de palpite
- [ ] Para jogos `pending` sem palpite: formulário com dois inputs e botão "CONFIRMAR PALPITE"
- [ ] Formulário bloqueado (inputs + botão desabilitados) quando `match_date - now() <= 5 minutos`
- [ ] Countdown "⏱ FECHA EM Xh Ymin" visível quando faltam menos de 2h para o jogo
- [ ] Countdown muda para `color-error` quando faltam menos de 30min
- [ ] Backend valida deadline (5min) server-side e rejeita com 422 `deadline_expired`
- [ ] Backend valida autenticação JWT — retorna 401 sem token válido
- [ ] Para jogos `live`/`finished` com palpite: exibe `PredictionDisplay`
- [ ] Para jogos `live`/`finished` sem palpite: exibe "SEM PALPITE" em `color-muted`
- [ ] Rota `/meus-palpites` exibe tabela de todos os palpites com jogo, palpite, resultado e pontos
- [ ] RLS habilitado: usuário vê apenas seus próprios palpites

### Funcionalidade nova v2 (implementar)
- [ ] Para jogos `pending` com palpite enviado E deadline não expirado: formulário pré-preenchido com os valores atuais
- [ ] Título do formulário em modo edição: "✎ ALTERAR PALPITE" em `color-accent`
- [ ] Borda do container em modo edição: `color-accent` (em vez de `color-border`)
- [ ] Botão de submit em modo edição: "ALTERAR PALPITE"
- [ ] Submit em modo edição chama o mesmo `POST /api/predictions` — backend faz UPSERT
- [ ] Backend retorna 200 para UPDATE (palpite existente atualizado) e 201 para INSERT (palpite novo)
- [ ] Após UPDATE bem-sucedido: `submittedPrediction` é atualizado com os novos valores; formulário permanece editável
- [ ] Feedback visual "✓ PALPITE ATUALIZADO" após edição bem-sucedida (temporário, ~3s, em `color-win`)
- [ ] Para jogos `pending` com palpite enviado E deadline **expirado**: exibe `PredictionDisplay` (somente leitura)
- [ ] Migration `20260613_predictions_update_policy.sql` criada com RLS UPDATE policy
- [ ] Backend adiciona `when :patch then Net::HTTP::Patch.new(uri)` ao helper `supabase_request`
- [ ] Erro `already_submitted` removido do backend e do handler de erro no frontend

### Design e qualidade
- [ ] Design segue DESIGN.md: fonte monospace, paleta brasileira, estilo Elifoot
- [ ] Interface 100% em português brasileiro
- [ ] Funciona em mobile (coluna única, inputs 48px adaptados)
- [ ] `npx tsc --noEmit` sem erros
- [ ] Sem imports não utilizados (evitar repetir bug do `useCallback`)
