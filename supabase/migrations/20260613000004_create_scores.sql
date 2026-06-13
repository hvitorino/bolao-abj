-- Migration 004: scores + calculate_scores_for_game + trigger on_game_finished
CREATE TABLE IF NOT EXISTS scores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  game_id       uuid        NOT NULL REFERENCES games(id)        ON DELETE CASCADE,
  prediction_id uuid        NOT NULL REFERENCES predictions(id)  ON DELETE CASCADE,
  points        int         NOT NULL DEFAULT 0,
  breakdown     jsonb       NOT NULL DEFAULT '{}',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id   ON scores (user_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id   ON scores (game_id);
CREATE INDEX IF NOT EXISTS idx_scores_user_game ON scores (user_id, game_id);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_select_own"
  ON scores FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Função de cálculo de pontuação
CREATE OR REPLACE FUNCTION calculate_scores_for_game(p_game_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game         games%ROWTYPE;
  v_pred         predictions%ROWTYPE;
  v_winner_pts   int; v_exact_pts  int; v_ws_pts     int;
  v_diff_pts     int; v_loser_pts  int; v_goleada_pts int;
  v_total        int; v_breakdown  jsonb;
  v_real_diff    int; v_pred_diff  int;
  v_real_winner  text; v_pred_winner text;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.home_score IS NULL OR v_game.away_score IS NULL THEN RETURN; END IF;

  IF    v_game.home_score > v_game.away_score THEN v_real_winner := 'home';
  ELSIF v_game.away_score > v_game.home_score THEN v_real_winner := 'away';
  ELSE  v_real_winner := 'draw'; END IF;

  FOR v_pred IN SELECT * FROM predictions WHERE game_id = p_game_id LOOP
    v_winner_pts := 0; v_exact_pts := 0; v_ws_pts := 0;
    v_diff_pts   := 0; v_loser_pts := 0; v_goleada_pts := 0;

    IF    v_pred.home_score > v_pred.away_score THEN v_pred_winner := 'home';
    ELSIF v_pred.away_score > v_pred.home_score THEN v_pred_winner := 'away';
    ELSE  v_pred_winner := 'draw'; END IF;

    IF v_pred_winner = v_real_winner THEN
      v_winner_pts := 3;
      IF v_pred.home_score = v_game.home_score AND v_pred.away_score = v_game.away_score THEN
        v_exact_pts := 5;
      ELSE
        IF v_real_winner = 'home' AND v_pred.home_score = v_game.home_score THEN v_ws_pts := 3;
        ELSIF v_real_winner = 'away' AND v_pred.away_score = v_game.away_score THEN v_ws_pts := 3;
        END IF;
        IF v_real_winner != 'draw' THEN
          v_real_diff := ABS(v_game.home_score - v_game.away_score);
          v_pred_diff := ABS(v_pred.home_score - v_pred.away_score);
          IF v_pred_diff = v_real_diff THEN v_diff_pts := 2; END IF;
        END IF;
      END IF;
      IF (v_real_winner = 'home' AND v_game.home_score >= 3) OR
         (v_real_winner = 'away' AND v_game.away_score >= 3) THEN
        v_goleada_pts := 1;
      END IF;
    ELSE
      IF v_real_winner = 'home' AND v_pred.away_score = v_game.away_score THEN v_loser_pts := 1;
      ELSIF v_real_winner = 'away' AND v_pred.home_score = v_game.home_score THEN v_loser_pts := 1;
      END IF;
    END IF;

    v_total := v_winner_pts + v_exact_pts + v_ws_pts + v_diff_pts + v_loser_pts + v_goleada_pts;
    v_breakdown := jsonb_build_object(
      'winner', v_winner_pts, 'exact', v_exact_pts, 'winner_score', v_ws_pts,
      'diff',   v_diff_pts,   'loser_score', v_loser_pts, 'goleada', v_goleada_pts
    );

    INSERT INTO scores (user_id, game_id, prediction_id, points, breakdown, calculated_at)
    VALUES (v_pred.user_id, p_game_id, v_pred.id, v_total, v_breakdown, now())
    ON CONFLICT (prediction_id) DO UPDATE
      SET points = EXCLUDED.points, breakdown = EXCLUDED.breakdown,
          calculated_at = EXCLUDED.calculated_at;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_calculate_scores()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished')
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    PERFORM calculate_scores_for_game(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_game_finished ON games;
CREATE TRIGGER on_game_finished
  AFTER UPDATE ON games FOR EACH ROW EXECUTE FUNCTION trigger_calculate_scores();
