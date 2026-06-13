-- Adiciona coluna espn_id para sincronização com ESPN API
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS espn_id text;

CREATE UNIQUE INDEX IF NOT EXISTS games_espn_id_idx ON games (espn_id) WHERE espn_id IS NOT NULL;
