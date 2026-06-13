# Spec: Palpites (Predictions)

**Slug:** predictions
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Permitir que cada participante registre seu palpite de placar (dois inteiros: casa × visitante) para cada jogo da Copa 2026. O palpite é bloqueado automaticamente 5 minutos antes do início da partida — tanto no frontend (inputs desabilitados) quanto no backend (validação do deadline). Palpites já enviados são exibidos em destaque visual. Não é possível criar ou alterar palpite após o prazo.

---

## Histórias de Usuário

- Como participante, quero registrar meu palpite de placar para um jogo antes do início, para competir com os demais no bolão
- Como participante, quero ver meu palpite já enviado diretamente no card do jogo, para confirmar que foi registrado corretamente
- Como participante, quero ser impedido de alterar meu palpite após o deadline, para garantir a integridade do bolão
- Como participante, quero ver um contador regressivo quando faltam menos de 2h para o jogo, para saber quando meu prazo encerra
- Como participante, quero receber feedback visual imediato após enviar o palpite (sucesso ou erro)

---

## Modelo de Dados

### Tabela `predictions`

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

**Arquivo:** `db/migrations/20260613_create_predictions.sql`

```sql
-- Cria tabela predictions
CREATE TABLE IF NOT EXISTS predictions (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id      uuid         NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  home_score   int          NOT NULL CHECK (home_score >= 0),
  away_score   int          NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz  DEFAULT now(),
  UNIQUE(user_id, game_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_game_id ON predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_game ON predictions(user_id, game_id);

-- Habilita RLS
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Policy: usuário vê apenas seus próprios palpites
CREATE POLICY "predictions_select_own"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: usuário só pode inserir palpite para si mesmo
CREATE POLICY "predictions_insert_own"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: usuário NÃO pode atualizar palpites (imutável após envio)
-- (sem UPDATE policy — operação bloqueada por padrão com RLS)

-- Policy: usuário não pode deletar seus palpites
-- (sem DELETE policy)
```

**Nota RLS:** Não existe política UPDATE propositalmente. Palpites são imutáveis — uma vez enviados, não podem ser alterados. Isso é reforçado tanto no RLS quanto na validação do backend (deadline).

---

## Backend — Endpoints Ruby/Sinatra

### POST /api/predictions

**Arquivo:** `api/predictions.rb`
**Autenticação:** requerida (JWT Supabase via `Authorization: Bearer <token>`)

**Método:** POST

**Body (JSON):**
```json
{
  "game_id": "uuid",
  "home_score": 2,
  "away_score": 1
}
```

**Validações (na ordem):**
1. Header `Authorization: Bearer <token>` presente e válido — se ausente/inválido: 401
2. `game_id` presente e UUID válido — se ausente/inválido: 422
3. `home_score` e `away_score` presentes, inteiros, >= 0 — se ausente/inválido: 422
4. Jogo existe no banco — se não encontrado: 404
5. `match_date - now() > 5 minutos` — se deadline expirado: 422 com `{ "error": "deadline_expired", "message": "Prazo encerrado. Não é possível registrar palpite após 5 minutos antes do início." }`
6. Já existe palpite para esse (user_id, game_id) — se existe: 422 com `{ "error": "already_submitted", "message": "Você já enviou um palpite para este jogo." }`

**Resposta de sucesso (201):**
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

**Erros possíveis:**
- 401: token ausente ou inválido
- 404: jogo não encontrado
- 422: dados inválidos (detalhe no campo `error` e `message`)
- 500: erro interno

**Implementação de autenticação JWT:**

```ruby
require 'net/http'
require 'json'

def authenticate(env)
  auth_header = env['HTTP_AUTHORIZATION']
  return nil unless auth_header&.start_with?('Bearer ')
  token = auth_header.sub('Bearer ', '')

  # Verificar JWT via Supabase Admin API (getUser)
  uri = URI("#{ENV['SUPABASE_URL']}/auth/v1/user")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  req = Net::HTTP::Get.new(uri)
  req['Authorization'] = "Bearer #{token}"
  req['apikey'] = ENV['SUPABASE_ANON_KEY']
  res = http.request(req)
  return nil unless res.code == '200'

  JSON.parse(res.body)
end
```

**Variáveis de ambiente necessárias:**
- `SUPABASE_URL` — URL do projeto Supabase (sem `/` trailing)
- `SUPABASE_ANON_KEY` — chave anon pública
- `SUPABASE_SERVICE_ROLE_KEY` — chave service_role (para operações admin)

### GET /api/predictions

**Arquivo:** `api/predictions.rb` (mesmo arquivo, método GET)
**Autenticação:** requerida

**Query params:**
- `game_id` (obrigatório): UUID do jogo

**Resposta de sucesso (200) — palpite encontrado:**
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

**Resposta de sucesso (200) — sem palpite:**
```json
null
```

**Erros:**
- 401: não autenticado
- 400: `game_id` ausente

**Nota de implementação:** A leitura de palpites no frontend será feita preferencialmente via Supabase client direto (aproveitando o RLS), não via essa rota. A rota GET existe como fallback e para consistência da API.

---

## Frontend — Componentes React

### PredictionForm

**Arquivo:** `components/bolao/PredictionForm.tsx`
**Tipo:** Client Component (`"use client"`)

**Props:**
```typescript
interface PredictionFormProps {
  gameId: string
  homeTeamCode: string
  awayTeamCode: string
  matchDate: string      // ISO 8601
  initialPrediction?: {  // palpite já enviado (se existir)
    id: string
    home_score: number
    away_score: number
    submitted_at: string
  } | null
}
```

**Estados internos:**
- `homeScore: string` — valor do input placar casa (inicia com string vazia ou palpite existente)
- `awayScore: string` — valor do input placar visitante
- `status: 'idle' | 'loading' | 'success' | 'error'`
- `errorMessage: string | null`
- `isDeadlinePassed: boolean` — calculado no mount e atualizado a cada segundo

**Comportamento:**

1. **Cálculo de deadline:** No `useEffect` com intervalo de 1s, calcular `deadlinePassed = (new Date(matchDate).getTime() - Date.now()) <= 5 * 60 * 1000`
2. **Estado "palpite já enviado":** Se `initialPrediction` existe, renderizar `PredictionDisplay` em vez do formulário
3. **Estado "deadline expirado":** Inputs desabilitados, botão desabilitado, mensagem "✗ PRAZO ENCERRADO"
4. **Submissão:** Chamar `POST /api/predictions` com `Authorization: Bearer <token>` (token obtido do Supabase client browser)
5. **Sucesso:** Exibir `PredictionDisplay` com os dados retornados (sem reload da página)
6. **Erro `already_submitted`:** Mensagem "Você já enviou um palpite para este jogo"
7. **Erro `deadline_expired`:** Mensagem "Prazo encerrado"
8. **Countdown:** Quando `0 < minutesRemaining < 120`, exibir "⏱ FECHA EM Xh Ymin" (ex: "⏱ FECHA EM 1h 47min")
9. **Quando < 30min:** Mudar cor do countdown para `color-error`

**Design (referência DESIGN.md — Card de Palpite):**
```
┌──────────────────────────────────────────────────────┐
│  SEU PALPITE                                         │
│  ─────────────────────────────────────────────────── │
│    BRA  [ 2 ]  ×  [ 1 ]  ARG                        │
│                                                      │
│  ⏱ FECHA EM 1h 47min                                │
│  [   CONFIRMAR PALPITE   ]                           │
└──────────────────────────────────────────────────────┘
```

**Estilos dos inputs:**
- `width: 48px`, `text-align: center`, `font-size: 20px`, `font-weight: bold`
- `background: var(--color-bg)`, `border: 2px solid var(--color-accent)`, `color: var(--color-accent)`
- `font-family: JetBrains Mono`, sem arrows de number input (`-moz-appearance: textfield`)
- Input desabilitado: `border-color: var(--color-muted)`, `color: var(--color-muted)`, `opacity: 0.6`

**Estilos do botão CONFIRMAR:**
- `background: var(--color-primary)`, `color: var(--color-bg)`, `font-weight: bold`
- `text-transform: uppercase`, `letter-spacing: 0.1em`, `border: none`
- `width: 100%`, `padding: 0.5rem`, `cursor: pointer`
- Desabilitado: `opacity: 0.5`, `cursor: not-allowed`

**Estilos do countdown:**
- Normal (>30min): `color: var(--color-muted)`
- Urgente (≤30min): `color: var(--color-error)`

### PredictionDisplay

**Arquivo:** `components/bolao/PredictionDisplay.tsx`
**Tipo:** Server Component (puro display, sem interatividade)

**Props:**
```typescript
interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  submittedAt?: string  // para exibir horário de envio
}
```

**Comportamento:** Exibe o palpite já enviado de forma visual distinta e imutável.

**Design:**
```
┌──────────────────────────────────────────────────────┐
│  ✓ SEU PALPITE                                       │
│  ─────────────────────────────────────────────────── │
│      BRA    2  ×  1    ARG                           │
│  enviado às 14:53 BRT                                │
└──────────────────────────────────────────────────────┘
```

**Estilos:**
- Container: `border: 1px solid var(--color-primary)`, `background: var(--color-surface)`
- Título "✓ SEU PALPITE": `color: var(--color-win)`, `font-size: 11px`, `text-transform: uppercase`
- Placar: `color: var(--color-accent)`, `font-size: 20px`, `font-weight: bold`
- Horário de envio: `color: var(--color-muted)`, `font-size: 10px`

### Modificação do GameCard

**Arquivo:** `components/games/GameCard.tsx`

O `GameCard` precisa se tornar um Client Component para integrar o `PredictionForm`, pois este último requer interatividade. Alternativa: manter `GameCard` como Server Component e tornar apenas a área de palpite um Client Component separado.

**Abordagem recomendada:** Criar `GameCardWithPrediction.tsx` como Client Component que:
1. Recebe o `game` completo como prop
2. Recebe o `initialPrediction` (se existir) como prop
3. Renderiza o `GameCard` original (Server Component inline) + `PredictionForm` abaixo

**Ou:** Modificar `GameCard.tsx` diretamente para aceitar props adicionais e renderizar a área de palpite condicionalmente. Neste caso:
- Adicionar `"use client"` ao topo
- Adicionar prop `prediction?: PredictionData | null`
- Adicionar seção de palpite no footer/abaixo do card

**Abordagem escolhida para a spec:** Estender `GameCard.tsx` para aceitar props de palpite. O componente se torna Client Component. A página `/jogos` (Server Component) busca os palpites do usuário e os passa para cada `GameCard`.

**Novas props de GameCard:**
```typescript
interface GameCardProps {
  game: Game
  prediction?: {
    id: string
    home_score: number
    away_score: number
    submitted_at: string
  } | null
}
```

**Comportamento adicional:**
- Se `game.status === 'pending'`: exibir `PredictionForm` abaixo do footer de status
- Se `game.status === 'live' || 'finished'`: exibir `PredictionDisplay` (se prediction existe) ou "SEM PALPITE" em `color-muted`
- Separador visual `border-top: 1px dashed var(--color-border)` entre a área do jogo e a área de palpite

---

## Tipos TypeScript

**Arquivo:** `lib/types/prediction.ts`

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

### Cálculo do Deadline

```
deadline = match_date - 5 minutos
agora = now() (UTC)

isDeadlinePassed = agora >= deadline
```

**No frontend (JavaScript):**
```javascript
const deadline = new Date(matchDate).getTime() - (5 * 60 * 1000) // 5min em ms
const isDeadlinePassed = Date.now() >= deadline
const minutesRemaining = Math.floor((deadline - Date.now()) / 60000)
```

**No backend (Ruby):**
```ruby
match_date = Time.parse(game['match_date']) # UTC
deadline = match_date - (5 * 60) # 5 minutos em segundos
if Time.now.utc >= deadline
  # deadline expirado
end
```

### Imutabilidade do Palpite

Uma vez enviado, o palpite não pode ser alterado. Isso é garantido por:
1. **RLS:** Sem política UPDATE na tabela `predictions`
2. **Backend:** Verificação de palpite existente antes de inserir (retorna 422 `already_submitted`)
3. **Frontend:** Após `initialPrediction` estar preenchido, o formulário é substituído por `PredictionDisplay`

### Busca de Palpites na Página /jogos

A página `/jogos` (Server Component) deve buscar os palpites do usuário para os jogos do dia atual antes de renderizar:

```typescript
// Em app/(dashboard)/jogos/page.tsx
const { data: predictions } = await supabase
  .from('predictions')
  .select('id, game_id, home_score, away_score, submitted_at')
  .eq('user_id', user.id)
  .in('game_id', gameIds)

// Mapear predictions por game_id para acesso O(1)
const predictionsByGameId = Object.fromEntries(
  (predictions ?? []).map(p => [p.game_id, p])
)
```

Então passar `prediction={predictionsByGameId[game.id] ?? null}` para cada `GameCard`.

### Exibição do Countdown

Exibir somente quando `0 < minutesRemaining < 120` (menos de 2h):

```
minutesRemaining = 137 → não exibe countdown
minutesRemaining = 119 → "⏱ FECHA EM 1h 59min"
minutesRemaining = 60  → "⏱ FECHA EM 1h 0min"
minutesRemaining = 47  → "⏱ FECHA EM 47min"
minutesRemaining = 0   → deadline expirado (não exibe countdown)
minutesRemaining < 30  → countdown em color-error
```

Lógica de formatação:
```javascript
function formatCountdown(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `⏱ FECHA EM ${h}h ${m}min`
  }
  return `⏱ FECHA EM ${minutes}min`
}
```

---

## Proteção de Rotas

Todas as funcionalidades de palpite estão dentro de `app/(dashboard)/`, que já é protegido pelo `app/(dashboard)/layout.tsx` existente (verifica `supabase.auth.getUser()` e redireciona para `/login`).

O endpoint `/api/predictions` em Ruby verifica o JWT do Supabase no header `Authorization`. Sem token válido, retorna 401.

---

## Integração Supabase Realtime

Não é necessária para esta feature. Os palpites são privados por usuário (RLS). Não há componente compartilhado que precise de atualização em tempo real para palpites — isso será relevante na feature `scoring`.

---

## Critérios de Aceite

- [ ] Na página `/jogos`, cada `GameCard` exibe a área de palpite
- [ ] Para jogos `pending` sem palpite enviado: formulário com dois inputs numéricos e botão "CONFIRMAR PALPITE"
- [ ] Para jogos `pending` com palpite enviado: exibe "✓ SEU PALPITE: X × Y" em destaque (não é possível alterar)
- [ ] Para jogos `live` ou `finished` com palpite: exibe o palpite enviado
- [ ] Para jogos `live` ou `finished` sem palpite: exibe "SEM PALPITE" em `color-muted`
- [ ] Formulário bloqueado (inputs + botão desabilitados) quando `match_date - now() <= 5 minutos`
- [ ] Countdown "⏱ FECHA EM Xh Ymin" visível quando faltam menos de 2h para o jogo
- [ ] Countdown muda para `color-error` quando faltam menos de 30min
- [ ] Backend valida deadline (5min) e rejeita palpites tardios com 422
- [ ] Backend rejeita palpite duplicado com 422 `already_submitted`
- [ ] Backend valida autenticação JWT — retorna 401 sem token
- [ ] Feedback visual imediato: spinner de loading no botão durante envio, mensagem de sucesso/erro após
- [ ] RLS habilitado na tabela `predictions` — usuário vê apenas seus próprios palpites
- [ ] Palpite enviado exibido em borda `color-primary`, placar em `color-accent`
- [ ] Design segue DESIGN.md: fonte monospace, paleta brasileira, estilo Elifoot
- [ ] Interface 100% em português brasileiro
- [ ] Funciona em mobile (coluna única, inputs adaptados)
- [ ] Migration SQL em `db/migrations/20260613_create_predictions.sql`
