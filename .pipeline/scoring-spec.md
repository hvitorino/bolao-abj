# Spec: Pontuação (Scoring)

**Slug:** scoring
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Calcular e exibir em tempo real a pontuação de cada participante por jogo, com o breakdown dos bônus conquistados, atualizando automaticamente quando um jogo é encerrado. O cálculo ocorre via trigger/function no Postgres — sem dependência de chamada manual — e é transmitido aos clientes via Supabase Realtime.

---

## Histórias de Usuário

- Como participante, quero ver minha pontuação em cada jogo encerrado para saber quantos pontos conquistei
- Como participante, quero ver o breakdown dos bônus (vencedor, placar exato, goleada, etc.) para entender por que recebi cada ponto
- Como participante, quero que a pontuação apareça automaticamente quando o jogo encerrar sem precisar recarregar a página
- Como participante, quero acessar `/meus-palpites` para ver todos os meus palpites com placar real e pontuação de forma consolidada

---

## Modelo de Dados

### Tabela `scores`

```sql
scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id       uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  prediction_id uuid NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  points        int  NOT NULL DEFAULT 0,
  breakdown     jsonb NOT NULL DEFAULT '{}',
  -- breakdown shape: {"winner":3,"exact":5,"winner_score":0,"diff":0,"loser_score":0,"goleada":0}
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prediction_id)  -- um score por palpite
)
```

**RLS:**
- `SELECT`: usuário autenticado pode ler apenas seus próprios scores (`user_id = auth.uid()`)
- Sem `INSERT`/`UPDATE`/`DELETE` via RLS — essas operações são feitas exclusivamente pela function Postgres com `SECURITY DEFINER` ou via `service_role`

**Índices:**
- `CREATE INDEX idx_scores_user_id ON scores(user_id)`
- `CREATE INDEX idx_scores_game_id ON scores(game_id)`
- `CREATE INDEX idx_scores_user_game ON scores(user_id, game_id)`

---

### Função Postgres: `calculate_scores_for_game(game_id uuid)`

Calcula e upserta scores para todos os palpites de um jogo. Chamada pelo trigger quando `status` muda para `'finished'`.

```sql
CREATE OR REPLACE FUNCTION calculate_scores_for_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game        games%ROWTYPE;
  v_pred        predictions%ROWTYPE;
  v_winner_pts  int;
  v_exact_pts   int;
  v_ws_pts      int;
  v_diff_pts    int;
  v_loser_pts   int;
  v_goleada_pts int;
  v_total       int;
  v_breakdown   jsonb;
  v_real_diff   int;
  v_pred_diff   int;
  v_real_winner text;  -- 'home' | 'away' | 'draw'
  v_pred_winner text;  -- 'home' | 'away' | 'draw'
BEGIN
  -- Busca o jogo
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.home_score IS NULL OR v_game.away_score IS NULL THEN
    RETURN;
  END IF;

  -- Determina vencedor real
  IF v_game.home_score > v_game.away_score THEN
    v_real_winner := 'home';
  ELSIF v_game.away_score > v_game.home_score THEN
    v_real_winner := 'away';
  ELSE
    v_real_winner := 'draw';
  END IF;

  -- Itera sobre todos os palpites do jogo
  FOR v_pred IN SELECT * FROM predictions WHERE game_id = p_game_id LOOP
    v_winner_pts  := 0;
    v_exact_pts   := 0;
    v_ws_pts      := 0;
    v_diff_pts    := 0;
    v_loser_pts   := 0;
    v_goleada_pts := 0;

    -- Determina vencedor do palpite
    IF v_pred.home_score > v_pred.away_score THEN
      v_pred_winner := 'home';
    ELSIF v_pred.away_score > v_pred.home_score THEN
      v_pred_winner := 'away';
    ELSE
      v_pred_winner := 'draw';
    END IF;

    -- Regra 1: acertou vencedor (ou empate) → +3
    IF v_pred_winner = v_real_winner THEN
      v_winner_pts := 3;

      -- Regra 2: placar exato → +5 (mutuamente exclusivo com regra 3)
      IF v_pred.home_score = v_game.home_score AND v_pred.away_score = v_game.away_score THEN
        v_exact_pts := 5;
      ELSE
        -- Regra 3: somente placar do vencedor → +3 (não aplica em empate)
        IF v_real_winner != 'draw' THEN
          IF v_real_winner = 'home' AND v_pred.home_score = v_game.home_score THEN
            v_ws_pts := 3;
          ELSIF v_real_winner = 'away' AND v_pred.away_score = v_game.away_score THEN
            v_ws_pts := 3;
          END IF;
        END IF;

        -- Regra 4: diferença de gols correta E acertou vencedor (não exato) → +2
        -- Não aplica em empate (diff=0 seria qualquer empate, coberto por exact)
        IF v_real_winner != 'draw' THEN
          v_real_diff := ABS(v_game.home_score - v_game.away_score);
          v_pred_diff := ABS(v_pred.home_score - v_pred.away_score);
          IF v_pred_diff = v_real_diff THEN
            v_diff_pts := 2;
          END IF;
        END IF;
      END IF;

      -- Regra 6: goleada (vencedor fez >=3 gols E acertou vencedor) → +1
      IF (v_real_winner = 'home' AND v_game.home_score >= 3) OR
         (v_real_winner = 'away' AND v_game.away_score >= 3) THEN
        v_goleada_pts := 1;
      END IF;

    ELSE
      -- Não acertou vencedor
      -- Regra 5: somente placar do perdedor → +1
      IF v_real_winner = 'home' THEN
        -- Vencedor foi home; perdedor foi away
        IF v_pred.away_score = v_game.away_score THEN
          v_loser_pts := 1;
        END IF;
      ELSIF v_real_winner = 'away' THEN
        -- Vencedor foi away; perdedor foi home
        IF v_pred.home_score = v_game.home_score THEN
          v_loser_pts := 1;
        END IF;
      END IF;
      -- Em empate sem acerto: não há "perdedor", regra 5 não se aplica
    END IF;

    v_total := v_winner_pts + v_exact_pts + v_ws_pts + v_diff_pts + v_loser_pts + v_goleada_pts;

    v_breakdown := jsonb_build_object(
      'winner',       v_winner_pts,
      'exact',        v_exact_pts,
      'winner_score', v_ws_pts,
      'diff',         v_diff_pts,
      'loser_score',  v_loser_pts,
      'goleada',      v_goleada_pts
    );

    -- Upsert: cria ou atualiza o score
    INSERT INTO scores (user_id, game_id, prediction_id, points, breakdown, calculated_at)
    VALUES (v_pred.user_id, p_game_id, v_pred.id, v_total, v_breakdown, now())
    ON CONFLICT (prediction_id) DO UPDATE
      SET points        = EXCLUDED.points,
          breakdown     = EXCLUDED.breakdown,
          calculated_at = EXCLUDED.calculated_at;

  END LOOP;
END;
$$;
```

---

### Trigger Postgres: dispara ao mudar status para `finished`

```sql
CREATE OR REPLACE FUNCTION trigger_calculate_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Apenas quando status muda para 'finished' e há placar
  IF NEW.status = 'finished'
     AND (OLD.status IS DISTINCT FROM 'finished')
     AND NEW.home_score IS NOT NULL
     AND NEW.away_score IS NOT NULL
  THEN
    PERFORM calculate_scores_for_game(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_finished
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_scores();
```

---

## Backend — Endpoints Ruby/Sinatra

### POST /api/scores/calculate

Endpoint de acionamento manual (fallback), chamado pelo endpoint admin após mudar status para `finished`. Útil para recálculo em caso de erro ou ajuste de placar.

**Autenticação:** `X-Admin-Secret` header (mesmo padrão do endpoint admin PATCH games)

**Body (JSON):**
```json
{ "game_id": "uuid" }
```

**Resposta de sucesso (200):**
```json
{ "message": "Pontuações calculadas com sucesso", "game_id": "uuid" }
```

**Erros possíveis:**
- 401: `X-Admin-Secret` ausente ou inválido
- 400: `game_id` ausente ou formato inválido
- 404: jogo não encontrado
- 422: jogo ainda não encerrado (`status != 'finished'`) ou sem placar
- 500: erro Supabase

**Implementação:** Chama a função `calculate_scores_for_game` via Supabase RPC (`POST /rest/v1/rpc/calculate_scores_for_game`).

---

## Frontend — Componentes React

### `ScoreDisplay`

**Arquivo:** `components/bolao/ScoreDisplay.tsx`

**Props:**
```typescript
interface ScoreDisplayProps {
  points: number
  breakdown: ScoreBreakdown
  predictionHomeScore: number
  predictionAwayScore: number
  gameHomeScore: number
  gameAwayScore: number
  homeTeamCode: string
  awayTeamCode: string
}

interface ScoreBreakdown {
  winner: number       // 0 ou 3
  exact: number        // 0 ou 5
  winner_score: number // 0 ou 3
  diff: number         // 0 ou 2
  loser_score: number  // 0 ou 1
  goleada: number      // 0 ou 1
}
```

**Design (estilo DESIGN.md — Pontuação por Jogo):**
```
┌──────────────────────────────────────────────────────┐
│  BRA 3×1 ARG  ·  SEU PALPITE: 3×1  ·  +8 PTS       │
│  ─────────────────────────────────────────────────── │
│  ✓ Acertou o vencedor        +3                      │
│  ✓ Placar exato              +5                      │
│  ─────────────────────────────────────────────────── │
│  TOTAL                        8 pontos               │
└──────────────────────────────────────────────────────┘
```

- Borda: `color-primary`
- Cabeçalho: `color-text` (placar real) + `color-accent` (pontuação total)
- Linhas de breakdown com `✓` em `color-win` (se points > 0) ou sem linha (se points == 0)
- Linha `TOTAL` em `color-text`, pontuação em `color-accent`
- Separadores com `border-top: 1px solid var(--color-border)`
- Itens sem pontuação (0) não são exibidos — apenas itens conquistados

**Comportamento:** Componente puramente visual (sem estado). Recebe dados já calculados.

---

### `useScoreRealtime`

**Arquivo:** `lib/hooks/useScoreRealtime.ts`

**Assinatura:**
```typescript
function useScoreRealtime(
  gameId: string,
  userId: string,
  initialScore: Score | null
): Score | null
```

**Comportamento:**
- Mantém `scoreState` em `useState<Score | null>(initialScore)`
- No `useEffect`, cria subscription para tabela `scores`, evento `INSERT` e `UPDATE`, filtro `game_id=eq.${gameId}`
- Ao receber evento: se `payload.new.user_id === userId`, atualiza `scoreState`
- Cleanup: `supabase.removeChannel(channel)` no retorno do `useEffect`
- Dependência do `useEffect`: `[gameId, userId]`

**Configuração Supabase necessária (manual):**
```sql
ALTER TABLE scores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
```

---

### Modificação: `GameCard.tsx`

**Mudanças necessárias:**
- Adicionar prop `score?: Score | null` à interface `GameCardProps`
- Importar `useScoreRealtime` e `ScoreDisplay`
- No body do componente: `const liveScore = useScoreRealtime(game.id, /* userId precisa ser passado */, score ?? null)`
- Na área de palpite, quando `isFinished` e há palpite: renderizar `PredictionDisplay` acima e `ScoreDisplay` abaixo
- O `userId` deve ser recebido via prop (passado da página server component)

**Props atualizadas:**
```typescript
interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  userId?: string  // necessário para filtrar Realtime por usuário
}
```

---

### Página `/meus-palpites`

**Arquivo:** `app/(dashboard)/meus-palpites/page.tsx`

**Tipo:** Server Component assíncrono (busca dados no servidor)

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  MEUS PALPITES                                       │
│  X palpites · Y pontos no total                      │
├─────────────────────┬──────────┬────────┬────────────┤
│  JOGO               │ PALPITE  │RESULTADO│  PONTOS   │
├─────────────────────┼──────────┼─────────┼───────────┤
│  BRA × ARG          │  3 × 1   │  3 × 1  │  +8 PTS   │
│  GRP A · 14 JUN     │          │ENCERRADO│  ✓ exato  │
├─────────────────────┼──────────┼─────────┼───────────┤
│  ESP × FRA          │  1 × 0   │  2 × 0  │  +6 PTS   │
│  GRP B · 15 JUN     │          │ENCERRADO│  ✓ venc.  │
└─────────────────────┴──────────┴─────────┴───────────┘
```

**Lógica:**
1. `supabase.auth.getUser()` — redireciona para `/login` se não autenticado
2. Busca todos os palpites do usuário: `SELECT * FROM predictions WHERE user_id = userId ORDER BY submitted_at DESC`
3. Busca os jogos correspondentes: `SELECT * FROM games WHERE id IN (game_ids)`
4. Busca os scores correspondentes: `SELECT * FROM scores WHERE user_id = userId AND game_id IN (game_ids)`
5. Monta estrutura `PredictionWithDetails[]` para renderização

**Design:**
- Cabeçalho: "MEUS PALPITES" em `color-primary`, uppercase, bold
- Subtítulo: "X palpites · Y pontos no total" em `color-muted`
- Tabela com bordas `color-border`
- Coluna PONTOS: valor em `color-accent` se > 0, `color-muted` se 0, "PENDENTE" em `color-muted` se jogo não encerrado
- Jogo sem palpite não aparece nesta página
- Estado vazio: "NENHUM PALPITE REGISTRADO" em `color-muted`

---

## Tipos TypeScript

### `lib/types/score.ts`

```typescript
export interface ScoreBreakdown {
  winner: number
  exact: number
  winner_score: number
  diff: number
  loser_score: number
  goleada: number
}

export interface Score {
  id: string
  user_id: string
  game_id: string
  prediction_id: string
  points: number
  breakdown: ScoreBreakdown
  calculated_at: string // ISO 8601
}
```

---

## Lib TypeScript: `lib/scoring.ts`

Espelha a lógica Postgres em TypeScript para uso no frontend (ex: preview de pontuação). Útil para testes e para exibição client-side sem depender do banco.

```typescript
export function calculateScore(
  game: { home_score: number; away_score: number },
  prediction: { home_score: number; away_score: number }
): { points: number; breakdown: ScoreBreakdown }
```

**Regras (implementar com precisão):**

```
1. Determinar vencedor real: home_score > away_score → 'home'; < → 'away'; = → 'draw'
2. Determinar vencedor palpite: mesma lógica

3. winner_points = pred_winner === real_winner ? 3 : 0

4. Se winner_points > 0:
   a. exact_points = pred_home === game_home && pred_away === game_away ? 5 : 0
   b. Se exact_points == 0 e real_winner != 'draw':
      winner_score_points = (real_winner='home' e pred_home=game_home) || 
                             (real_winner='away' e pred_away=game_away) ? 3 : 0
   c. Se exact_points == 0 e real_winner != 'draw':
      diff_points = |pred_home - pred_away| === |game_home - game_away| ? 2 : 0
   d. goleada_points = (real_winner='home' e game_home>=3) || 
                        (real_winner='away' e game_away>=3) ? 1 : 0

5. Se winner_points == 0 e real_winner != 'draw':
   loser_score_points = (real_winner='home' e pred_away=game_away) ||
                         (real_winner='away' e pred_home=game_home) ? 1 : 0

Total = winner_points + exact_points + winner_score_points + diff_points + 
        loser_score_points + goleada_points
```

**Notas de casos-limite:**
- Empate exato (ex: 1×1 palpitado e 1×1 real): winner=3 + exact=5 = 8 pts
- Empate sem acerto: todos os pontos = 0
- Goleada + placar exato: winner=3 + exact=5 + goleada=1 = 9 pts (não aplica winner_score nem diff, pois exact>0)
- winner_score e diff_points são independentes entre si (podem somar se ambos acertarem)

---

## Regras de Negócio

### Regras de pontuação (implementar com precisão)

| Regra | Condição | Pontos |
|-------|----------|--------|
| `winner_points` | Acertou o vencedor (ou empate) | +3 |
| `exact_points` | Placar exato (home E away corretos) | +5 |
| `winner_score_points` | Acertou SOMENTE o placar do vencedor (não o exato, não empate) | +3 |
| `diff_points` | Acertou a diferença E acertou o vencedor (não exato, não empate) | +2 |
| `loser_score_points` | Acertou SOMENTE o placar do perdedor (não acertou vencedor, não empate) | +1 |
| `goleada_points` | Vencedor fez >=3 gols E acertou o vencedor | +1 |

**Exclusividades:**
- `exact_points` e `winner_score_points` são mutuamente exclusivos (se exato, winner_score=0)
- `exact_points` e `diff_points` são mutuamente exclusivos (se exato, diff=0)
- `loser_score_points` só aplica se NÃO acertou o vencedor
- Em empate sem acerto: `loser_score_points` não aplica (não há "perdedor" em empate)
- `winner_score_points` e `diff_points` NÃO se excluem mutuamente entre si

### Recálculo

Se o placar for corrigido pelo admin (PATCH com novo placar em jogo já `finished`), o endpoint `POST /api/scores/calculate` deve ser chamado manualmente para recalcular. O trigger só dispara quando `status` muda de não-finished para `finished`.

---

## Proteção de Rotas

- `/meus-palpites` — requer autenticação (middleware já cobre todo o `(dashboard)`)
- `POST /api/scores/calculate` — requer `X-Admin-Secret` (admin only)

---

## Integração Supabase Realtime

**Tabela:** `scores`
**Evento:** `INSERT` e `UPDATE`
**Canal:** `score-${gameId}-${userId}`
**Filtro:** `game_id=eq.${gameId}` (filtragem adicional por `user_id` feita no callback JS)
**O que fazer ao receber evento:** Se `payload.new.user_id === userId`, atualizar `scoreState` com `payload.new`

**Configuração manual necessária no Supabase:**
```sql
ALTER TABLE scores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
```

---

## Migration SQL

**Arquivo:** `db/migrations/20260613_create_scores.sql`

Conteúdo:
1. Criação da tabela `scores` com constraints e índices
2. Função `calculate_scores_for_game(p_game_id uuid)`
3. Função `trigger_calculate_scores()`
4. Trigger `on_game_finished` na tabela `games`
5. RLS policies:
   - `SELECT`: `auth.uid() = user_id`
   - Sem INSERT/UPDATE/DELETE via RLS (operações via SECURITY DEFINER)
6. Configuração Realtime (comentada — executar separadamente):
   ```sql
   -- ALTER TABLE scores REPLICA IDENTITY FULL;
   -- ALTER PUBLICATION supabase_realtime ADD TABLE scores;
   ```

---

## Critérios de Aceite

- [ ] Quando um jogo muda para `status = 'finished'`, os scores são calculados automaticamente via trigger Postgres
- [ ] `ScoreDisplay` exibe breakdown correto: apenas itens com pontos > 0 são mostrados
- [ ] `GameCard` com jogo `finished` e palpite exibe `ScoreDisplay` abaixo do `PredictionDisplay`
- [ ] Pontuação atualiza em tempo real via Supabase Realtime (hook `useScoreRealtime`)
- [ ] Página `/meus-palpites` lista todos os palpites com placar real e pontuação
- [ ] Casos-limite testados mentalmente: empate exato, goleada+exato, acerto só perdedor
- [ ] `lib/scoring.ts` espelha a lógica Postgres corretamente
- [ ] `POST /api/scores/calculate` permite recálculo manual via admin
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (coluna única)
- [ ] Interface 100% em português brasileiro
