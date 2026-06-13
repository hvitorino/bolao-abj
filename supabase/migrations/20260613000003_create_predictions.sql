-- Migration 003: predictions
CREATE TABLE IF NOT EXISTS predictions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id      uuid        NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  home_score   int         NOT NULL CHECK (home_score >= 0),
  away_score   int         NOT NULL CHECK (away_score >= 0),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id   ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_game_id   ON predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_game ON predictions(user_id, game_id);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions_select_own"
  ON predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "predictions_insert_own"
  ON predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
