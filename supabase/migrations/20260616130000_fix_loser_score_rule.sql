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

-- Recálculo retroativo: scores já gravados para jogos finalizados antes
-- desta correção podem conter loser_score concedido pela regra antiga
-- (usuário errou o vencedor mas acertou o placar do perdedor). Este bloco
-- força o recálculo de TODOS os jogos finished com a função corrigida acima,
-- garantindo que nenhum score historicamente incorreto permaneça assim.
DO $$
DECLARE
  g RECORD;
BEGIN
  FOR g IN SELECT id FROM games WHERE status = 'finished' LOOP
    PERFORM calculate_scores_for_game(g.id);
  END LOOP;
END;
$$;
