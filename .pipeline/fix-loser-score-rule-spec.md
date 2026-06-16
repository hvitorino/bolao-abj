# Spec: Correção da Regra "Somente Placar do Perdedor"

**Slug:** fix-loser-score-rule
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Inverter a condição de concessão do bônus "Somente placar do perdedor" (+1 pt) em todas as camadas do sistema (TypeScript, Postgres, documentação e conteúdo educativo).

**Regra atual (incorreta):** o bônus é concedido quando o usuário ERROU o vencedor mas acertou o placar de quem perdeu.

**Regra corrigida:** o bônus só pode ser concedido quando o usuário **também acertou o vencedor** do jogo — no mesmo padrão já usado pela regra "Diferença de gols correta (acertou vencedor)". Ou seja, a condição de acerto do vencedor passa a ser pré-requisito, não impeditivo.

Esta é uma correção de regra de negócio (não um bug isolado de UI), com impacto em código TS, SQL (migration nova), documentação (`CLAUDE.md`) e conteúdo educativo (página `/como-pontuar`).

---

## Histórias de Usuário

- Como participante do bolão, quero que o bônus de "placar do perdedor" só seja concedido quando eu efetivamente acertei quem ganhou o jogo, para que a pontuação recompense acertos coerentes (acertar o vencedor E parte do placar) em vez de premiar quem errou completamente o resultado.
- Como administrador do bolão, quero que a lógica de pontuação em TypeScript e Postgres permaneça idêntica após a correção, para que o preview de pontos no frontend corresponda ao cálculo definitivo do banco de dados.
- Como participante lendo a página `/como-pontuar`, quero que o exemplo da regra "Somente placar do perdedor" reflita meramente a regra real vigente, sem contradizer a tabela de pontuação.

---

## Diagnóstico confirmado (validado nesta spec)

Foi confirmado por leitura direta do código e por simulação exaustiva em Python (espelhando `calculateScore()`) que:

1. `lib/scoring.ts` e a função Postgres `calculate_scores_for_game` (versão vigente: `supabase/migrations/20260615120500_group_scoped_scoring_trigger.sql`) implementam HOJE a regra antiga, de forma consistente entre si.
2. **`db/migrations/` é um espelho incompleto e desatualizado** — faltam ao menos 11 arquivos presentes em `supabase/migrations/`, incluindo justamente `20260614000003_fix_goleada_scoring.sql` (precedente direto desta correção). A skill `supabase-migration` (`.claude/skills/supabase-migration/SKILL.md`) referencia `db/migrations/*.sql` como fonte, mas isso está obsoleto frente ao estado real do projeto: **a fonte de verdade é `supabase/migrations/`** (é onde a função vigente está definida por último, e é para onde a spec precedente de `fix-goleada-scoring` escreveu sua correção). Esta spec usa `supabase/migrations/` como destino da nova migration; a cópia para `db/migrations/` é OPCIONAL e não bloqueia a conclusão da feature (ver seção "Migrations necessárias" abaixo).
3. Por simulação exaustiva (todos os placares de 0 a 7 em ambos os lados, ambas as equipes), confirmou-se matematicamente que, dentro do branch "acertou vencedor, não é placar exato, não é empate":
   - `winner_score` (placar do vencedor bate) e o novo `loser_score` (placar do perdedor bate) são **mutuamente exclusivos por construção matemática** — nunca ocorrem juntos nesse branch. Motivo: se ambos os placares (vencedor e perdedor) batem simultaneamente, isso já é placar exato (que está em outro branch).
   - `diff` (diferença de gols bate) e o novo `loser_score` também são **mutuamente exclusivos por construção matemática**. Prova: se `loser_score` bate (o placar do lado perdedor é igual ao real) e `diff` bate (a diferença de gols do palpite é igual à real), então o placar do lado vencedor no palpite é necessariamente `placar_perdedor_real + diferença_real`, que é exatamente igual ao placar real do vencedor — ou seja, força `exact`, contradizendo a premissa de não ser exact.
   - Logo, dentro desse branch, **no máximo um** entre `winner_score`, `diff`, `loser_score` pode ser positivo por palpite. Eles não competem entre si por uma regra explícita de prioridade — a exclusão já está garantida pela aritmética.
4. **Impacto em cascata confirmado por simulação:** com a regra nova, dois exemplos hoje existentes na página `/como-pontuar` mudam de total porque o cenário escolhido para ilustrar outra regra (Exemplo 1 e Exemplo 6) também satisfaz, incidentalmente, a condição nova de `loser_score`:
   - **EXEMPLO_1** (real BRA 2×0 MEX, palpite 1×0): acertou vencedor, e o placar do perdedor (MEX, away=0) bate. Hoje (regra antiga) `loser_score=0` porque acertou o vencedor. Com a regra nova, `loser_score=+1`. Total sobe de **3 para 4 pontos**.
   - **EXEMPLO_6** (real BRA 5×0 MEX, palpite 4×0): mesma situação — away=0 bate em ambos. Total sobe de **4 para 5 pontos**.
   - Esses dois exemplos precisam ter seus breakdowns, totais e — se necessário — os próprios placares ajustados nesta feature para continuarem isolando corretamente as regras que pretendem ilustrar (acerto do vencedor isolado, e goleada isolada), sem o ruído do novo bônus de `loser_score`. Ver seção 5 abaixo.
   - **EXEMPLO_2, EXEMPLO_3, EXEMPLO_4 e EXEMPLO_BONUS_EMPATE não mudam** (confirmado por simulação) — nenhuma ação neles.
5. `MAX_POINTS = 9` em `components/bolao/ScoringRulesTable.tsx` **permanece correto e não muda** — confirmado por busca exaustiva de todos os placares possíveis (0 a 7 em cada lado): o máximo teórico continua sendo 9, via placar exato + goleada (ex.: real 0×4, palpite 0×4 → `winner(3) + exact(5) + goleada(1) = 9`). O comentário acima da constante (`// Caminho exact: ... // Caminho winner_score+diff: ...`) permanece tecnicamente correto porque descreve dois caminhos que já não envolvem `loser_score` — nenhuma alteração necessária nesse comentário.

---

## Tabela-verdade da nova condição (TypeScript e SQL devem implementar exatamente isto)

Pré-condição para qualquer pontuação de `loser_score`: **não houve empate** (`realWinner != 'draw'`).

| `predWinner == realWinner` | `placar exato?` | `placar do PERDEDOR bate?` | `loser_score_points` |
|---|---|---|---|
| Não | — | — (irrelevante) | **0** (regra nova: exige acerto do vencedor) |
| Sim | Sim (exact) | — (irrelevante, sempre vai bater também por definição de exact) | **0** (coberto por `exact_points=+5`, mutuamente exclusivo) |
| Sim | Não | Não | 0 |
| Sim | Não | Sim | **+1** |
| Empate (`realWinner == 'draw'`) | — | — | **0** (não existe "perdedor" em empate) |

Pseudocódigo de referência (mesma estrutura para TS e SQL):

```
se predWinner == realWinner:
    winner_points = 3
    se placar_exato:
        exact_points = 5
    senão:
        se realWinner != draw:
            se realWinner == 'home' e pred.home == real.home:
                winner_score_points = 3
            senão se realWinner == 'away' e pred.away == real.away:
                winner_score_points = 3

            se pred_diff == real_diff:
                diff_points = 2

            // NOVA CONDIÇÃO — antes vivia no branch `senão` (predWinner != realWinner)
            se realWinner == 'home' e pred.away == real.away:
                loser_score_points = 1
            senão se realWinner == 'away' e pred.home == real.home:
                loser_score_points = 1
    // goleada (já existente, sem mudanças) avaliada aqui dentro, independente de exact
senão:
    // nada mais — loser_score NÃO é mais avaliado aqui
    winner_points = 0
```

---

## Modelo de Dados

Nenhuma tabela nova, nenhuma coluna nova, nenhuma mudança de RLS. A estrutura de `scores.breakdown` (chave `loser_score` dentro do jsonb) permanece idêntica — só a lógica que decide seu valor muda.

### Migrations necessárias

Uma migration SQL **nova** (não editar migrations já aplicadas) substituindo `calculate_scores_for_game` via `CREATE OR REPLACE FUNCTION`, seguindo o mesmo padrão usado em `supabase/migrations/20260614000003_fix_goleada_scoring.sql` e em `supabase/migrations/20260615120500_group_scoped_scoring_trigger.sql` (que é a versão vigente — copie a função a partir dela, preservando 100% das demais regras, incluindo a coluna `group_id` introduzida pela feature `grupos`).

**Arquivo:** `supabase/migrations/20260616130000_fix_loser_score_rule.sql`

(Timestamp escolhido por ser posterior ao mais recente em `supabase/migrations/`, que é `20260616120000_create_group_invites.sql`, seguindo o padrão `YYYYMMDDHHMMSS_descricao.sql` do projeto.)

**Conteúdo esperado da migration** (baseado na função vigente em `20260615120500_group_scoped_scoring_trigger.sql`, com a única mudança sendo mover o bloco de `v_loser_pts` para dentro do `IF v_pred_winner = v_real_winner THEN`, ao lado de `v_ws_pts` e `v_diff_pts`, e ajustar sua condição):

```sql
-- Migration: corrige a regra "Somente placar do perdedor" em
-- calculate_scores_for_game.
--
-- Regra anterior (incorreta): +1 pt quando o usuário ERROU o vencedor mas
-- acertou o placar de quem perdeu.
-- Regra corrigida: +1 pt somente quando o usuário ACERTOU o vencedor E
-- acertou o placar do perdedor E o placar não é exato (mutuamente exclusivo
-- com exact_points, e também com winner_score_points/diff_points por
-- construção matemática — nunca ocorrem simultaneamente).
--
-- Esta função é copiada linha a linha da versão vigente em
-- 20260615120500_group_scoped_scoring_trigger.sql (scoping por group_id já
-- presente). A ÚNICA mudança real é mover a atribuição de v_loser_pts para
-- dentro do bloco "IF v_pred_winner = v_real_winner", ao lado de v_ws_pts e
-- v_diff_pts, com a condição invertida. Nenhuma outra regra do CLAUDE.md
-- (vencedor, exato, placar do vencedor, diferença de gols, goleada) foi
-- alterada.

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

        -- REGRA CORRIGIDA: "somente placar do perdedor" agora exige acerto
        -- do vencedor (já garantido por estarmos dentro deste IF) E não ser
        -- placar exato (já garantido pelo ELSE acima).
        IF v_real_winner = 'home' AND v_pred.away_score = v_game.away_score THEN
          v_loser_pts := 1;
        ELSIF v_real_winner = 'away' AND v_pred.home_score = v_game.home_score THEN
          v_loser_pts := 1;
        END IF;
      END IF;

      -- Regra de goleada (inalterada):
      -- acertou vencedor E vencedor no palpite >= 4 gols E diferença real >= 4 gols
      IF v_real_winner != 'draw'
         AND v_pred_winner_score >= 4
         AND v_real_diff >= 4
      THEN
        v_goleada_pts := 1;
      END IF;

    END IF;
    -- Removido o ramo ELSE que concedia v_loser_pts quando o vencedor era
    -- errado — essa era a regra antiga e incorreta. Quando
    -- v_pred_winner != v_real_winner, todos os pontos permanecem 0
    -- (inicializados no início do loop).

    v_total := v_winner_pts + v_exact_pts + v_ws_pts + v_diff_pts + v_loser_pts + v_goleada_pts;

    v_breakdown := jsonb_build_object(
      'winner',       v_winner_pts,
      'exact',        v_exact_pts,
      'winner_score', v_ws_pts,
      'diff',         v_diff_pts,
      'loser_score',  v_loser_pts,
      'goleada',      v_goleada_pts
    );

    INSERT INTO scores (user_id, game_id, group_id, prediction_id, points, breakdown, calculated_at)
    VALUES (v_pred.user_id, p_game_id, v_pred.group_id, v_pred.id, v_total, v_breakdown, now())
    ON CONFLICT (prediction_id) DO UPDATE
      SET points        = EXCLUDED.points,
          breakdown     = EXCLUDED.breakdown,
          group_id      = EXCLUDED.group_id,
          calculated_at = EXCLUDED.calculated_at;

  END LOOP;
END;
$$;

-- trigger_calculate_scores() e o trigger on_game_finished não mudam.
```

**Importante — recálculo de scores já existentes:** esta migration só substitui a função (`CREATE OR REPLACE FUNCTION`). Ela NÃO recalcula automaticamente `scores` já gravados para jogos já finalizados antes da correção. Se já houver jogos `finished` com `scores` calculados pela regra antiga no ambiente de produção, o Programador deve, ao final da migration, adicionar um comando que dispare o recálculo para todos os jogos finalizados, por exemplo:
```sql
DO $$
DECLARE
  g RECORD;
BEGIN
  FOR g IN SELECT id FROM games WHERE status = 'finished' LOOP
    PERFORM calculate_scores_for_game(g.id);
  END LOOP;
END;
$$;
```
Inclua este bloco ao final do arquivo da migration, depois da definição da função, para garantir que nenhum score historicamente errado pela regra antiga permaneça incorreto após a correção.

### Aplicação da migration

Conforme a skill `supabase-migration` (`.claude/skills/supabase-migration/SKILL.md`), a aplicação é feita via Supabase CLI usando `SUPABASE_DB_URL` (de `.env.local`):
```bash
supabase db query --db-url "$SUPABASE_DB_URL" -o table -f supabase/migrations/20260616130000_fix_loser_score_rule.sql
```
Nota: a skill documenta o caminho `db/migrations/*.sql`, mas isso está desatualizado frente ao estado real do projeto (ver "Diagnóstico confirmado", item 2) — a fonte de verdade é `supabase/migrations/`. **O Programador deve apenas escrever a migration em `supabase/migrations/`** (seguindo o padrão observado nas specs/changelogs anteriores, ex. `fix-goleada-scoring`) e registrar no changelog que ela está pronta para aplicação; a APLICAÇÃO efetiva no banco de produção (rodar o comando acima) fica para quando o usuário ou um passo posterior do pipeline explicitamente acionar a skill `supabase-migration` — não é responsabilidade do Programador executar isso de forma não solicitada nesta tarefa, a menos que o Revisor/usuário peça explicitamente. Caso o Programador opte por também copiar o arquivo para `db/migrations/20260616_fix_loser_score_rule.sql` (mantendo consistência com o padrão de alguns changelogs anteriores que mencionam "espelhada em `supabase/migrations/` e `db/migrations/`"), isso é OPCIONAL e não bloqueia a aceitação da feature.

---

## Frontend — `lib/scoring.ts`

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/lib/scoring.ts`

### Comentário no topo do arquivo (linhas 7–21 hoje)

Reescrever integralmente para refletir a regra nova. Texto sugerido (o Programador pode ajustar redação, mas o conteúdo técnico abaixo é obrigatório):

```typescript
/**
 * lib/scoring.ts
 *
 * Lógica de pontuação do Bolão da Copa.
 * Espelha a função Postgres `calculate_scores_for_game` para uso no frontend.
 *
 * Regras (de CLAUDE.md):
 *   winner_points      = +3 se acertou o vencedor (ou empate)
 *   exact_points       = +5 se placar exato (home E away corretos)
 *   winner_score_points= +3 se acertou SOMENTE o placar do vencedor (não o exato, não em empate)
 *   diff_points        = +2 se acertou a diferença de gols E acertou o vencedor (não exato, não empate)
 *   loser_score_points = +1 se acertou o vencedor E acertou o placar do perdedor (não exato, não empate)
 *   goleada_points     = +1 se acertou vencedor E vencedor no palpite >=4 gols E diferença real >=4 gols
 *
 * Exclusividades:
 *   - exact_points e winner_score_points são mutuamente exclusivos
 *   - exact_points e diff_points são mutuamente exclusivos
 *   - exact_points e loser_score_points são mutuamente exclusivos
 *   - loser_score_points SÓ aplica se TAMBÉM acertou o vencedor (pré-requisito,
 *     mesmo padrão de diff_points e winner_score_points)
 *   - Em empate: loser_score_points NÃO aplica (não há "perdedor")
 *   - winner_score_points, diff_points e loser_score_points são, dentro do
 *     branch "acertou vencedor e não é exact", mutuamente exclusivos ENTRE SI
 *     por construção matemática (não por uma regra de prioridade explícita):
 *     se dois desses três batessem ao mesmo tempo, isso forçaria o placar a
 *     ser exato, o que contradiz a premissa de não ser exact. Logo, no máximo
 *     um dos três é positivo por palpite.
 */
```

### Função `calculateScore()` — mover o bloco de `loser_score_points`

Estrutura atual (linhas 69–134): o bloco de `loser_score_points` (regra 5) vive inteiramente no `else` (linhas 118–134, quando `predWinner !== realWinner`).

**Mudança:** remover esse `else` por completo (zerando implicitamente `loser_score_points`, já inicializado em 0) e inserir a nova lógica dentro do `if (predWinner === realWinner)`, no branch `else` da checagem de placar exato (onde hoje vivem `winner_score_points` e `diff_points`, linhas 80–102), como uma nova checagem irmã, **depois** do cálculo de `diff_points` e antes do fechamento desse bloco:

```typescript
if (predWinner === realWinner) {
    // Regra 1: acertou vencedor (ou empate)
    winner_points = 3

    // Regra 2: placar exato (mutuamente exclusivo com regras 3, 4 e 5)
    if (
      prediction.home_score === game.home_score &&
      prediction.away_score === game.away_score
    ) {
      exact_points = 5
      // winner_score_points, diff_points e loser_score_points ficam em 0
    } else {
      // Regra 3: somente placar do vencedor (não aplica em empate)
      if (realWinner !== 'draw') {
        if (realWinner === 'home' && prediction.home_score === game.home_score) {
          winner_score_points = 3
        } else if (
          realWinner === 'away' &&
          prediction.away_score === game.away_score
        ) {
          winner_score_points = 3
        }
      }

      // Regra 4: diferença de gols correta (não aplica em empate)
      if (realWinner !== 'draw') {
        const realDiff = Math.abs(game.home_score - game.away_score)
        const predDiff = Math.abs(prediction.home_score - prediction.away_score)
        if (predDiff === realDiff) {
          diff_points = 2
        }
      }

      // Regra 5 (CORRIGIDA): somente placar do perdedor — agora exige
      // acerto do vencedor (garantido por estarmos dentro deste branch) e
      // não ser placar exato (garantido pelo else acima). Não aplica em
      // empate (não há "perdedor" definido).
      if (realWinner === 'home' && prediction.away_score === game.away_score) {
        loser_score_points = 1
      } else if (realWinner === 'away' && prediction.home_score === game.home_score) {
        loser_score_points = 1
      }
    }

    // Regra 6: goleada (inalterada)
    if (realWinner !== 'draw') {
      const predWinnerScore =
        realWinner === 'home' ? prediction.home_score : prediction.away_score
      const realGoalDiff = Math.abs(game.home_score - game.away_score)
      if (predWinnerScore >= 4 && realGoalDiff >= 4) {
        goleada_points = 1
      }
    }
} else {
    // Não acertou vencedor: nenhum bônus se aplica (winner_points,
    // exact_points, winner_score_points, diff_points, loser_score_points e
    // goleada_points permanecem 0, conforme inicializados).
}
```

Não há necessidade de `if (realWinner !== 'draw')` extra ao redor do bloco de `loser_score_points` porque, quando `realWinner === 'draw'`, nem `realWinner === 'home'` nem `realWinner === 'away'` são verdadeiros — a condição já não dispara. Mantenha o estilo do código existente (pode adicionar o guard explícito por clareza, a critério do Programador, desde que o comportamento não mude).

O restante da função (cálculo de `points` somando todos os componentes, montagem do `breakdown`, `BREAKDOWN_LABELS`, `calculateLiveScore`) **não muda**.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint Ruby contém lógica de pontuação própria (confirmado pelo precedente de `fix-goleada-scoring`). Nenhuma alteração necessária em `api/*.rb`.

---

## `CLAUDE.md` — Tabela de Regras de Pontuação

Arquivo: `/Users/hamonvitorino/workspace/bolao-abj/CLAUDE.md`, seção "Regras de Pontuação" (linhas 16–31).

**Alterar a linha da tabela** de:
```
| Somente placar do perdedor | +1 |
```
para:
```
| Somente placar do perdedor (acertou vencedor) | +1 |
```
Isso espelha exatamente o padrão já usado na linha acima (`Diferença de gols correta (acertou vencedor)`).

**O "Exemplo" abaixo da tabela (linha 29)** ilustra placar exato, não a regra de "placar do perdedor" — não precisa de alteração, pois não menciona/depende dessa regra.

Nenhuma outra mudança em `CLAUDE.md` é necessária (a regra de empate, a tabela de funcionalidades e o modelo de dados não são afetados).

---

## Frontend — `components/bolao/ScoringRulesTable.tsx`

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/components/bolao/ScoringRulesTable.tsx`

Na constante `SCORING_RULES`, o objeto da regra (linhas 26–31):
```typescript
{
    event: 'Somente placar do perdedor',
    points: 1,
    note: 'independente de acertar o vencedor',
    highlight: false,
},
```
Alterar o campo `note` para o mesmo padrão usado por "Placar exato" e "Diferença de gols correta" (ambos usam `'requer acerto do vencedor'`):
```typescript
{
    event: 'Somente placar do perdedor',
    points: 1,
    note: 'requer acerto do vencedor',
    highlight: false,
},
```

`MAX_POINTS = 9` e seu comentário acima (linhas 40–43) **não precisam mudar** — confirmado por simulação exaustiva que o máximo teórico permanece 9 e os dois caminhos descritos no comentário (`exact` / `winner_score+diff`) continuam válidos sem envolver `loser_score`.

---

## Frontend — `app/(dashboard)/como-pontuar/page.tsx`

Três blocos precisam de atenção: `EXEMPLO_1`, `EXEMPLO_5` (foco principal) e `EXEMPLO_6`. `EXEMPLO_2`, `EXEMPLO_3`, `EXEMPLO_4` e `EXEMPLO_BONUS_EMPATE` **não mudam** (confirmado por simulação).

Mantenha o padrão observado no arquivo: cada `EXEMPLO_N` tem um comentário de duas linhas acima dele no formato:
```
// Exemplo N — Regra N: <nome da regra> (<TIME1> <h>×<a> <TIME2>, palpite <ph>×<pa>) → +<total> pts
// Confirmado contra calculateScore(): breakdown {winner:X, exact:X, winner_score:X, diff:X, loser_score:X, goleada:X}
```
O Programador DEVE validar o novo breakdown e total de cada exemplo abaixo executando de fato `calculateScore()` (ex.: script ad-hoc via `npx tsx`, sem necessidade de commitar o script — mesmo padrão usado na feature `exemplos-por-regra`) antes de cravar os números no JSX, e manter o comentário "Confirmado contra calculateScore()" como prova de que a validação foi feita.

### EXEMPLO_1 — ajustar para continuar isolando "Acerto do vencedor"

Hoje (`homeScore: 2, awayScore: 0, predHome: 1, predAway: 0`) o placar do perdedor (away, MEX) bate (`0 === 0`). Com a regra nova isso adiciona `loser_score_points = +1` indevidamente a um exemplo que deve isolar SOMENTE o acerto do vencedor. É necessário trocar o palpite para um valor que não acione `loser_score` (nem `winner_score`, nem `diff`, nem `exact`).

**Cenário validado por simulação exaustiva (Python, espelhando `calculateScore()`):**

- Real: BRA 2×0 MEX (mantido)
- Palpite: **BRA 3×2 MEX** (em vez de 1×0)

Cálculo manual:
- `predWinner` = home (3>2) = `realWinner` (home, 2>0) → acertou vencedor → `winner_points = 3`
- Exact? `3≠2` ou `2≠0` → não
- `winner_score` (home): pred home=3, real home=2 → não bate → 0
- `diff`: real diff=`|2-0|=2`; pred diff=`|3-2|=1` → não bate → 0
- `loser_score` (away): pred away=2, real away=0 → não bate → 0
- `goleada`: real diff=2 < 4 → não aplica → 0
- **Total: 3 pontos** — breakdown `{winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:0}`

Isola corretamente "Acerto do vencedor" sem nenhum bônus adicional, preservando o espírito do exemplo original.

Atualizar:
```typescript
// Exemplo 1 — Regra 1: Acerto do vencedor (BRA 2×0 MEX, palpite 3×2) → +3 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:0}
const EXEMPLO_1 = {
  title: 'EXEMPLO 1 — ACERTO DO VENCEDOR',
  ruleLabel: 'Acerto do vencedor',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 2,
  awayScore: 0,
  predHome: 3,
  predAway: 2,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
  ],
  total: 3,
  note: 'Acertou que o BRA venceria, mas errou o placar do vencedor (real=2, palpite=3), a diferença de gols (real=2, palpite=1) e o placar do perdedor (real=0, palpite=2). Nenhum bônus adicional se aplica.',
}
```

**Valide obrigatoriamente com `calculateScore()` real antes de aplicar** — os números acima foram derivados por simulação equivalente em Python nesta spec, mas a função TypeScript final (pós-edição) é a fonte de verdade.

### EXEMPLO_5 — reescrever para ilustrar a regra corrigida (foco principal desta feature)

**Cenário validado por simulação exaustiva (Python, espelhando `calculateScore()`):**

- Real: **BRA 3×1 ARG**
- Palpite: **BRA 2×1 ARG**

Cálculo manual passo a passo:
- `realWinner` = home (BRA, 3>1); `predWinner` = home (BRA, 2>1) → **acertou o vencedor** → `winner_points = +3`
- Placar exato? `2≠3` → não
- `winner_score` (placar do vencedor, home): palpite home=2, real home=3 → não bate → `winner_score_points = 0`
- `diff`: real diff=`|3-1|=2`; pred diff=`|2-1|=1` → não bate → `diff_points = 0`
- `loser_score` (placar do perdedor, away/ARG): palpite away=1, real away=1 → **bate** → `loser_score_points = +1` (regra corrigida: aplicada porque TAMBÉM acertou o vencedor)
- `goleada`: real diff=2 < 4 → não aplica → `goleada_points = 0`
- **Total: 3 + 1 = 4 pontos**
- Breakdown esperado: `{winner: 3, exact: 0, winner_score: 0, diff: 0, loser_score: 1, goleada: 0}`

Este cenário isola a regra corrigida com precisão: acerta o vencedor (pré-requisito novo) e acerta exclusivamente o placar do perdedor, sem acionar `winner_score`, `diff`, `exact` ou `goleada`.

Substituir o bloco `EXEMPLO_5` por:

```typescript
// Exemplo 5 — Regra 5: Somente placar do perdedor (BRA 3×1 ARG, palpite 2×1) → +4 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:0}
const EXEMPLO_5 = {
  title: 'EXEMPLO 5 — SOMENTE PLACAR DO PERDEDOR',
  ruleLabel: 'Somente placar do perdedor',
  homeTeam: 'BRA',
  awayTeam: 'ARG',
  homeScore: 3,
  awayScore: 1,
  predHome: 2,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 1, hit: true },
  ],
  total: 4,
  note: 'Acertou que o BRA venceria (placar do vencedor errado: real=3, palpite=2; diferença real=2, palpite=1) e, além disso, acertou exatamente o placar do time que perdeu (ARG, 1 gol). Esse bônus agora exige ter acertado o vencedor — diferente da versão anterior da regra.',
}
```

Note que o array `breakdown` deste exemplo ganha uma linha nova (`Somente placar do perdedor`) que não existia na versão antiga (a versão antiga só tinha duas linhas: "Acertou o vencedor" e "Somente placar do perdedor", já que os outros bônus eram irrelevantes quando o vencedor era errado). Confira o componente `ScoringExample` (`components/bolao/ScoringExample.tsx`) para garantir que renderizar 5 linhas de breakdown nesse card é suportado sem necessidade de alteração no componente (os demais exemplos como EXEMPLO_4 e EXEMPLO_6 já usam 4-5 linhas).

### EXEMPLO_6 — ajustar total e breakdown (goleada)

Hoje (`homeScore: 5, awayScore: 0, predHome: 4, predAway: 0`): o placar do perdedor (away, MEX) bate (`0 === 0`). Com a regra nova, isso passa a conceder `loser_score_points = +1` adicionalmente.

Cálculo manual com a regra nova:
- `realWinner` = home; `predWinner` = home → acertou vencedor → `winner_points = 3`
- Exact? `4≠5` → não
- `winner_score` (home): pred=4, real=5 → não bate → 0
- `diff`: real diff=5, pred diff=4 → não bate → 0
- `loser_score` (away): pred=0, real=0 → **bate** → `loser_score_points = +1`
- `goleada`: pred_winner_score (home, palpite)=4 ≥4, real_diff=5≥4 → **bate** → `goleada_points = +1`
- **Total: 3 + 1 + 1 = 5 pontos** (antes era 4)
- Breakdown: `{winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:1}`

Atualizar o bloco `EXEMPLO_6`:

```typescript
// Exemplo 6 — Regra 6: Goleada (BRA 5×0 MEX, palpite 4×0) → +5 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:1}
const EXEMPLO_6 = {
  title: 'EXEMPLO 6 — GOLEADA',
  ruleLabel: 'Goleada',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 5,
  awayScore: 0,
  predHome: 4,
  predAway: 0,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 1, hit: true },
    { label: 'Goleada', points: 1, hit: true },
  ],
  total: 5,
  note: 'Goleada é cumulativa com o acerto do vencedor e independente de acertar o placar exato ou a diferença: basta o vencedor do palpite ter feito 4+ gols (palpite: BRA fez 4) E a diferença real do jogo ter sido de 4+ gols (real: 5−0=5). Neste cenário, o placar do perdedor (MEX, 0 gols) também bateu, somando o bônus de "somente placar do perdedor" (+1).',
}
```

**Alternativa que o Programador pode escolher** (a critério, desde que valide com `calculateScore()`): em vez de aceitar o "ruído" do `loser_score` no exemplo de goleada, trocar `predAway` para um valor que não bata com `awayScore` (ex.: `predAway: 1` em vez de `0`), mantendo o total em 4 e o exemplo focado exclusivamente em goleada. Se optar por essa alternativa, recalcule manualmente (ou via script) o novo breakdown e ajuste o `note` e o comentário acima do bloco de acordo — qualquer uma das duas abordagens é aceitável, desde que os números estejam corretos e validados.

### Demais exemplos — confirmação de que não mudam

`EXEMPLO_2`, `EXEMPLO_3`, `EXEMPLO_4` e `EXEMPLO_BONUS_EMPATE` foram simulados com a regra nova e produzem exatamente os mesmos totais e breakdowns já documentados no arquivo hoje. **Nenhuma alteração necessária neles** — mas o Programador deve confirmar isso executando `calculateScore()` sobre eles após a edição de `lib/scoring.ts`, como parte da validação de regressão (ver Critérios de Aceite).

---

## Testes / Validações Existentes

Não há testes automatizados no projeto (sem `vitest`/`jest` configurado, sem pasta `__tests__`, sem scripts de teste em `package.json` — confirmado por inspeção). A validação de exemplos de pontuação no projeto é feita historicamente via **script ad-hoc não commitado** (`npx tsx algumScript.ts`), como documentado no changelog de `exemplos-por-regra`. Siga o mesmo padrão: escreva um script ad-hoc temporário que importe `calculateScore` de `lib/scoring.ts` e valide TODOS os exemplos da página (`EXEMPLO_1` a `EXEMPLO_6` e `EXEMPLO_BONUS_EMPATE`) após a edição, comparando com os totais/breakdowns esperados. Não é necessário commitar esse script.

**Grep amplo realizado nesta spec** por `loser_score`/`loserScore` no repositório (excluindo `node_modules`) encontrou estas ocorrências, todas endereçadas por esta spec:
- `CLAUDE.md` — tabela de regras (endereçado)
- `CHANGELOG.md` — histórico, não precisa de edição retroativa (é log de mudanças passadas; o Programador deve ADICIONAR uma entrada nova para esta correção, não editar entradas antigas)
- `app/(dashboard)/como-pontuar/page.tsx` — EXEMPLO_1, EXEMPLO_5, EXEMPLO_6 (endereçado)
- `supabase/migrations/20260614000003_fix_goleada_scoring.sql` e `supabase/migrations/20260615120500_group_scoped_scoring_trigger.sql` — migrations já aplicadas, NÃO EDITAR (a correção vem via nova migration, conforme especificado acima)
- `supabase/migrations/20260613000004_create_scores.sql` — migration original já aplicada, NÃO EDITAR
- `components/bolao/ScoreDisplay.tsx` — usa `BREAKDOWN_LABELS` para exibir o rótulo "Placar do perdedor"; **não precisa de mudança de código**, pois apenas renderiza o breakdown vindo de `scores.breakdown.loser_score` dinamicamente (o rótulo continua correto independente da regra que o gerou) — confirme isso ao implementar, mas é só validação, não há edição esperada
- `.pipeline/ranking-spec.md`, `.pipeline/exemplos-por-regra-changelog.md`, `.pipeline/ranking-changelog.md`, `.pipeline/grupos-spec.md`, `.pipeline/fix-goleada-scoring-changelog.md`, `.pipeline/como-pontuar-fix-1.md`, `.pipeline/como-pontuar-changelog.md`, `.pipeline/fix-goleada-scoring-spec.md`, `.pipeline/exemplos-por-regra-spec.md`, `.pipeline/scoring-changelog.md`, `.pipeline/scoring-spec.md` — documentos históricos do pipeline, **não editar** (são registros do que foi pedido/feito no passado, não documentação viva)
- `lib/types/score.ts` — apenas a interface `ScoreBreakdown` com o campo `loser_score: number`; comentário ao lado diz `// 0 ou 1`, o que permanece verdadeiro (não muda)
- `lib/scoring.ts` — endereçado (comentário + lógica)
- `db/migrations/20260615_group_scoped_scoring_trigger.sql` e `db/migrations/20260613_create_scores.sql` — cópias espelhadas desatualizadas; não editar diretamente (ver nota sobre `db/migrations/` ser opcional/espelho)

---

## Documentação — `CHANGELOG.md`

Adicionar uma entrada nova (não editar entradas antigas) descrevendo a correção, seguindo o formato/estilo já usado nas entradas existentes do arquivo (o Programador deve ler o topo de `CHANGELOG.md` para replicar o formato exato — título, data, bullets).

---

## Proteção de Rotas

Não aplicável — esta correção não introduz nem modifica rotas, autenticação ou autorização.

---

## Integração Supabase Realtime

Não aplicável — esta correção não altera o mecanismo de Realtime. O canal/trigger que já existe (`scores` table, evento `INSERT`/`UPDATE`, consumido por componentes como `ScoreDisplay`/ranking) continua funcionando sem mudanças; apenas o VALOR de `breakdown.loser_score` calculado pela função Postgres muda.

---

## Regras de Negócio (resumo executável)

1. `loser_score_points` (+1) só é concedido quando **simultaneamente**:
   - `predWinner === realWinner` (acertou o vencedor, ou seja, este é um pré-requisito agora)
   - `realWinner !== 'draw'` (não há "perdedor" em empate)
   - Não é placar exato (`prediction.home_score !== game.home_score OU prediction.away_score !== game.away_score`)
   - O placar do lado que perdeu bate exatamente: se `realWinner === 'home'`, então `prediction.away_score === game.away_score`; se `realWinner === 'away'`, então `prediction.home_score === game.home_score`
2. `loser_score_points` é mutuamente exclusivo com `exact_points` (por definição: exact_points cobre o caso em que AMBOS os placares batem).
3. `loser_score_points` é mutuamente exclusivo com `winner_score_points` e com `diff_points` dentro do branch "acertou vencedor, não exato" — **por construção matemática**, não por uma regra de prioridade arbitrária (provado por simulação exaustiva nesta spec). O Programador não precisa codificar nenhum `if` de exclusão explícita entre esses três — a aritmética já garante que nunca dois deles serão simultaneamente positivos.
4. `loser_score_points` é cumulativo com `winner_points` (+3, sempre presente quando o branch é alcançado) e pode ser cumulativo com `goleada_points` (+1) — não há exclusão entre eles (goleada depende do placar do VENCEDOR no palpite ser ≥4 e da diferença REAL ser ≥4; isso pode coexistir com o placar do perdedor batendo, como demonstrado no recálculo do EXEMPLO_6).
5. Quando `predWinner !== realWinner` (errou o vencedor), **nenhum** bônus de pontuação se aplica: `winner_points = exact_points = winner_score_points = diff_points = loser_score_points = goleada_points = 0`. Esse é o comportamento já existente para todos os outros bônus — a mudança desta feature é apenas trazer `loser_score_points` para dentro dessa mesma regra geral, em vez de ser a única exceção que pontuava sem acertar o vencedor.

---

## Critérios de Aceite

- [ ] `lib/scoring.ts`: `loser_score_points` (+1) só é concedido quando `predWinner === realWinner`, não é placar exato, e o placar do lado perdedor bate — verificado por leitura de código E por execução real de `calculateScore()` em casos de teste manuais (script ad-hoc)
- [ ] Comentário no topo de `lib/scoring.ts` reescrito conforme especificado (regra + exclusividades atualizadas)
- [ ] Migration nova criada em `supabase/migrations/20260616130000_fix_loser_score_rule.sql`, com `CREATE OR REPLACE FUNCTION calculate_scores_for_game` implementando a mesma lógica corrigida, preservando 100% das demais regras (vencedor, exato, placar do vencedor, diferença de gols, goleada) e o scoping por `group_id`
- [ ] Migration inclui bloco de recálculo retroativo (`PERFORM calculate_scores_for_game(g.id)` para todos os jogos `finished`) para corrigir scores já gravados pela regra antiga
- [ ] Nenhuma migration já aplicada foi editada (apenas migration nova criada)
- [ ] `CLAUDE.md`: linha da tabela alterada para `Somente placar do perdedor (acertou vencedor)`
- [ ] `components/bolao/ScoringRulesTable.tsx`: nota da linha "Somente placar do perdedor" alterada para `'requer acerto do vencedor'`
- [ ] `app/(dashboard)/como-pontuar/page.tsx`: `EXEMPLO_5` reescrito com cenário BRA 3×1 ARG / palpite 2×1 ARG, total 4 pts, breakdown `{winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:0}`, validado contra `calculateScore()` real
- [ ] `EXEMPLO_1` ajustado para não acionar `loser_score` incidentalmente (cenário sugerido: palpite 3×2, total 3 pts) ou outro cenário equivalente validado pelo Programador
- [ ] `EXEMPLO_6` ajustado para refletir o novo total/breakdown com `loser_score` incidental (total 5 pts) OU ajustado para evitar o ruído (a critério do Programador, desde que documentado e validado)
- [ ] `EXEMPLO_2`, `EXEMPLO_3`, `EXEMPLO_4`, `EXEMPLO_BONUS_EMPATE` confirmados sem alteração de total/breakdown (validados, não necessariamente editados)
- [ ] `CHANGELOG.md` recebe entrada nova descrevendo a correção (sem editar entradas antigas)
- [ ] Nenhuma regressão nas demais regras de pontuação (vencedor, exato, placar do vencedor, diferença de gols, goleada) em nenhum exemplo da página `/como-pontuar`
- [ ] Grep por `loser_score`/`loserScore` revisitado ao final para confirmar que todas as ocorrências em código vivo (não histórico de pipeline) foram tratadas
- [ ] `npm run lint` e `npm run build` permanecem limpos
- [ ] Design da página `/como-pontuar` e do componente `ScoringRulesTable` segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot) — nenhuma mudança visual além do texto/dados é esperada nesta correção
- [ ] Funciona em mobile (coluna única) — sem alteração de layout esperada, apenas confirmar que não há regressão visual nos cards de exemplo com a linha extra de breakdown no EXEMPLO_5/EXEMPLO_6

---

## Branch e Processo

- Branch: `fix/fix-loser-score-rule` (prefixo `fix/` por ser correção de regra de negócio já em produção, não feature nova)
- Commits em português, seguindo convenção do projeto (ex.: `fix(scoring): corrige regra de placar do perdedor para exigir acerto do vencedor`)
- Merge somente após aprovação do Revisor, via `git merge feature/fix-loser-score-rule` (ajustar para `fix/fix-loser-score-rule` conforme nome real da branch) na main
- Nenhum push para `origin` durante o pipeline — trabalho fica local até o usuário pedir explicitamente
