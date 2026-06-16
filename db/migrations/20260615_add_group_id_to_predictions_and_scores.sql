-- Migration: adiciona group_id (nullable) em predictions e scores
-- Feature: grupos
-- Data: 2026-06-15
--
-- IMPORTANTE: group_id é nullable nesta etapa propositalmente — há linhas
-- existentes em produção sem grupo ainda. NÃO tornar NOT NULL aqui.
-- A constraint antiga UNIQUE(user_id, game_id) é mantida intacta até o
-- backfill (migration 20260615120200) ser confirmado sem linhas órfãs
-- (ver migration 20260615120300_enforce_group_id_not_null.sql).

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE CASCADE;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_predictions_group_id          ON predictions(group_id);
CREATE INDEX IF NOT EXISTS idx_scores_group_id                ON scores(group_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_game_group    ON predictions(user_id, game_id, group_id);
