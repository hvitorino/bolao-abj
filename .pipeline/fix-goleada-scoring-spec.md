# Spec: Correção da Regra de Goleada na Pontuação

**Slug:** fix-goleada-scoring
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Corrigir a lógica de goleada em três camadas (TypeScript, Postgres e documentação) para que o bônus de +1 por goleada seja concedido somente quando três condições simultâneas forem satisfeitas:

1. O palpite acertou o vencedor.
2. No palpite, o vencedor marcou **4 ou mais gols** (>= 4).
3. A diferença de gols no resultado real é de **4 ou mais gols** (>= 4).

A regra atual em todas as camadas usa `>= 3`, o que está incorreto.

---

## Histórias de Usuário

- Como participante, quero que o bônus de goleada seja concedido apenas quando meu palpite previu uma goleada expressiva (4+ gols de vantagem) e o jogo real terminou com essa mesma amplitude, para que a pontuação reflita previsões mais precisas e difíceis.
- Como administrador, quero que a lógica de pontuação em TypeScript e Postgres seja idêntica, para que o preview de pontos no frontend corresponda ao cálculo definitivo do banco de dados.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma tabela nova. A tabela `scores` e seu campo `breakdown` (`goleada`) permanecem inalterados em estrutura. Somente a lógica de cálculo muda.

### Migrations necessárias

Uma migration SQL para substituir a função `calculate_scores_for_game` no Postgres com a regra corrigida.

**Arquivo:** `supabase/migrations/20260614000003_fix_goleada_scoring.sql`

Conteúdo da migration:

```sql
-- Migration: corrige regra de goleada na função calculate_scores_for_game
--
-- Regra anterior (incorreta): vencedor fez >= 3 gols no resultado real
-- Regra correta: acertou vencedor E vencedor no palpite >= 4 gols E diferença real >= 4 gols

CREATE OR REPLACE FUNCTION calculate_scores_for_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game         games%ROWTYPE;
  v_pred         predictions%ROWTYPE;
  v_winner_pts   int;
  v_exact_pts    int;
  v_ws_pts       int;
  v_diff_pts     int;
  v_loser_pts    int;
  v_goleada_pts  int;
  v_total        int;
  v_breakdown    jsonb;
  v_real_diff    int;
  v_pred_diff    int;
  v_real_winner  text;
  v_pred_winner  text;
  v_pred_winner_score int;  -- gols do vencedor no palpite
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.home_score IS NULL OR v_game.away_score IS NULL THEN
    RETURN;
  END IF;

  IF v_game.home_score > v_game.away_score THEN
    v_real_winner := 'home';
  ELSIF v_game.away_score > v_game.home_score THEN
    v_real_winner := 'away';
  ELSE
    v_real_winner := 'draw';
  END IF;

  -- Diferença de gols no resultado real (usada para goleada)
  v_real_diff := ABS(v_game.home_score - v_game.away_score);

  FOR v_pred IN SELECT * FROM predictions WHERE game_id = p_game_id LOOP
    v_winner_pts  := 0;
    v_exact_pts   := 0;
    v_ws_pts      := 0;
    v_diff_pts    := 0;
    v_loser_pts   := 0;
    v_goleada_pts := 0;

    IF v_pred.home_score > v_pred.away_score THEN
      v_pred_winner := 'home';
      v_pred_winner_score := v_pred.home_score;
    ELSIF v_pred.away_score > v_pred.home_score THEN
      v_pred_winner := 'away';
      v_pred_winner_score := v_pred.away_score;
    ELSE
      v_pred_winner := 'draw';
      v_pred_winner_score := 0;
    END IF;

    IF v_pred_winner = v_real_winner THEN
      v_winner_pts := 3;

      IF v_pred.home_score = v_game.home_score AND v_pred.away_score = v_game.away_score THEN
        v_exact_pts := 5;
      ELSE
        IF v_real_winner = 'home' AND v_pred.home_score = v_game.home_score THEN
          v_ws_pts := 3;
        ELSIF v_real_winner = 'away' AND v_pred.away_score = v_game.away_score THEN
          v_ws_pts := 3;
        END IF;

        IF v_real_winner != 'draw' THEN
          v_pred_diff := ABS(v_pred.home_score - v_pred.away_score);
          IF v_pred_diff = v_real_diff THEN
            v_diff_pts := 2;
          END IF;
        END IF;
      END IF;

      -- Regra de goleada corrigida:
      -- acertou vencedor E vencedor no palpite >= 4 gols E diferença real >= 4 gols
      IF v_real_winner != 'draw'
         AND v_pred_winner_score >= 4
         AND v_real_diff >= 4
      THEN
        v_goleada_pts := 1;
      END IF;

    ELSE
      IF v_real_winner = 'home' THEN
        IF v_pred.away_score = v_game.away_score THEN
          v_loser_pts := 1;
        END IF;
      ELSIF v_real_winner = 'away' THEN
        IF v_pred.home_score = v_game.home_score THEN
          v_loser_pts := 1;
        END IF;
      END IF;
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

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. O endpoint existente `POST /api/scores/calculate` (`api/scores/calculate.rb`) chama a função Postgres `calculate_scores_for_game` via RPC — ele não contém lógica de pontuação própria e, portanto, não precisa ser alterado. A correção na função Postgres é suficiente para o backend.

---

## Frontend — Componentes React

Nenhum componente novo. A correção é exclusivamente em `lib/scoring.ts`.

### calculateScore (lib/scoring.ts)

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/lib/scoring.ts`

**Alteração:** Substituir o bloco da Regra 6 (goleada).

**Lógica atual (incorreta):**

```typescript
// Regra 6: goleada (aplica mesmo quando placar exato)
if (
  (realWinner === 'home' && game.home_score >= 3) ||
  (realWinner === 'away' && game.away_score >= 3)
) {
  goleada_points = 1
}
```

**Lógica correta:**

```typescript
// Regra 6: goleada
// Condições simultâneas:
//   1. acertou vencedor (já garantido por estar dentro do bloco predWinner === realWinner)
//   2. vencedor no palpite marcou >= 4 gols
//   3. diferença de gols no resultado real >= 4
// Não aplica em empate (não há vencedor)
if (realWinner !== 'draw') {
  const predWinnerScore =
    realWinner === 'home' ? prediction.home_score : prediction.away_score
  const realGoalDiff = Math.abs(game.home_score - game.away_score)
  if (predWinnerScore >= 4 && realGoalDiff >= 4) {
    goleada_points = 1
  }
}
```

**Atualização do comentário de cabeçalho no arquivo:**

Substituir a linha:

```
 *   goleada_points     = +1 se vencedor fez >=3 gols E acertou o vencedor
```

Por:

```
 *   goleada_points     = +1 se acertou vencedor E vencedor no palpite >=4 gols E diferença real >=4 gols
```

---

## Regras de Negócio

### Regra de Goleada — Definição Correta

O bônus de goleada (+1) aplica-se somente quando **todas as três condições** são verdadeiras simultaneamente:

| # | Condição | Operador |
|---|----------|----------|
| 1 | O palpite acertou o vencedor (ou empate) | `predWinner === realWinner` |
| 2 | O vencedor no palpite marcou >= 4 gols | `predWinnerScore >= 4` |
| 3 | A diferença de gols no resultado real >= 4 | `realGoalDiff >= 4` |

**Empate não tem goleada:** Se o resultado real for empate (`realWinner === 'draw'`), o bônus de goleada nunca aplica, independente dos placares.

**O bônus é cumulativo:** Pode combinar com exact (+5), winner_score (+3) e diff (+2) — não há exclusividade.

### Tabela de Exemplos

| Resultado Real | Palpite | Goleada? | Motivo |
|----------------|---------|----------|--------|
| 7×1 (diff=6) | 3×0 (pred_winner=3) | NÃO | pred_winner_score=3 < 4 |
| 7×1 (diff=6) | 4×0 (pred_winner=4) | SIM | pred_winner_score=4 >= 4 e diff=6 >= 4 |
| 7×1 (diff=6) | 4×1 (pred_winner=4) | SIM | pred_winner_score=4 >= 4 e diff=6 >= 4 |
| 3×0 (diff=3) | 4×0 (pred_winner=4) | NÃO | diff_real=3 < 4 |
| 4×0 (diff=4) | 3×0 (pred_winner=3) | NÃO | pred_winner_score=3 < 4 |
| 4×0 (diff=4) | 4×0 (pred_winner=4) | SIM | pred_winner_score=4 >= 4 e diff=4 >= 4 |
| 2×2 (empate) | 4×0 (qualquer) | NÃO | realWinner='draw', regra não aplica |

### Alinhamento TypeScript ↔ Postgres

As duas implementações devem ser **logicamente idênticas**. Pseudocódigo canônico:

```
goleada = (
  acertou_vencedor
  AND real_winner != 'draw'
  AND pred_winner_score >= 4
  AND real_goal_diff >= 4
)
```

---

## Documentação a Atualizar

### CLAUDE.md

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/CLAUDE.md`

Substituir a linha da tabela de pontuação:

```
| Goleada — vencedor fez 3+ gols e usuário acertou o vencedor | +1 |
```

Por:

```
| Goleada — acertou vencedor, vencedor no palpite fez 4+ gols e diferença real >= 4 gols | +1 |
```

---

## Critérios de Aceite

- [ ] `lib/scoring.ts`: bloco da goleada usa `predWinnerScore >= 4 && realGoalDiff >= 4` em vez de `game.home_score >= 3 || game.away_score >= 3`
- [ ] `lib/scoring.ts`: comentário de cabeçalho atualizado para descrever a regra correta
- [ ] `supabase/migrations/20260614000003_fix_goleada_scoring.sql`: criada com `CREATE OR REPLACE FUNCTION calculate_scores_for_game` com a nova condição `v_pred_winner_score >= 4 AND v_real_diff >= 4`
- [ ] Caso de teste: resultado 7×1, palpite 3×0 → `goleada_points = 0` (pred_winner_score=3 < 4)
- [ ] Caso de teste: resultado 7×1, palpite 4×0 → `goleada_points = 1` (pred_winner_score=4 >= 4, real_diff=6 >= 4)
- [ ] Caso de teste: resultado 3×0, palpite 4×0 → `goleada_points = 0` (real_diff=3 < 4)
- [ ] Caso de teste: resultado 4×0, palpite 4×0 → `goleada_points = 1` (pred_winner_score=4 >= 4, real_diff=4 >= 4)
- [ ] Caso de teste: empate 2×2, palpite 4×0 → `goleada_points = 0` (realWinner='draw')
- [ ] `CLAUDE.md` atualizado com a nova definição da regra de goleada
- [ ] Nenhuma outra regra de pontuação foi alterada (winner, exact, winner_score, diff, loser_score permanecem intactos)
- [ ] O arquivo `api/scores/calculate.rb` não foi modificado (não contém lógica de pontuação própria)
