-- Migration: add bracket_slot_id FK to games table
-- Links knockout games to their position in the bracket tree.

ALTER TABLE games ADD COLUMN IF NOT EXISTS bracket_slot_id uuid REFERENCES bracket_slots(id);

-- Ensure at most one game per bracket slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_bracket_slot
  ON games(bracket_slot_id) WHERE bracket_slot_id IS NOT NULL;
