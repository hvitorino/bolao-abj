-- Migration: reescreve calculate_scores_for_game para gerar um score por
-- (usuário, grupo) em vez de um score por usuário.
-- Feature: grupos
-- Data: 2026-06-15
--
-- Esta função é copiada linha a linha da versão vigente em
-- 20260614000003_fix_goleada_scoring.sql (que já contém a correção de
-- goleada >=4/>=4). A ÚNICA mudança real é a coluna group_id, lida de
-- v_pred.group_id (predictions já carrega essa coluna desde a migration
-- 20260615120100) e incluída no INSERT/ON CONFLICT de scores. Nenhuma regra
-- de pontuação do CLAUDE.md foi alterada.
--
-- O trigger on_game_finished / trigger_calculate_scores() que dispara esta
-- função NÃO precisa de nenhuma alteração — continua chamando
-- calculate_scores_for_game(NEW.id) só com o game_id; a função agora lida
-- com múltiplos grupos automaticamente ao iterar todas as predictions
-- daquele jogo (que podem pertencer a grupos diferentes).

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

  -- Itera sobre TODAS as predictions do jogo, em TODOS os grupos — cada
  -- prediction já é única por (user_id, game_id, group_id), então não há
  -- necessidade de agrupar; o loop simplesmente carrega group_id de cada
  -- prediction e o repassa para o score correspondente.
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

    -- group_id vem diretamente da prediction (v_pred.group_id), preservando
    -- o isolamento: o score gerado pertence ao mesmo grupo do palpite que o
    -- originou.
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

-- trigger_calculate_scores() e o trigger on_game_finished não mudam —
-- mantidos exatamente como em 20260613000004_create_scores.sql.
