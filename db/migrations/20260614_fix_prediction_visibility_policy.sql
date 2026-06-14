-- Migration: Restringe visibilidade de palpites antes do início do jogo
-- Data: 2026-06-14
-- Feature: fix-prediction-visibility
--
-- Regras:
-- - o próprio usuário sempre pode ler o próprio palpite
-- - outros usuários só podem ler palpites de jogos que já saíram de `pending`

DROP POLICY IF EXISTS "predictions_select_all_authenticated" ON predictions;
DROP POLICY IF EXISTS "predictions_select_started_or_own" ON predictions;

CREATE POLICY "predictions_select_started_or_own"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM games
      WHERE games.id = predictions.game_id
        AND games.status <> 'pending'
    )
  );
