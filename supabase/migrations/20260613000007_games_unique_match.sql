-- Migration 007: UNIQUE constraint em games para idempotência do seed
ALTER TABLE games
  ADD CONSTRAINT games_unique_match
  UNIQUE (home_team_code, away_team_code, match_date);
