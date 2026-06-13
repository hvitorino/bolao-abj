-- Migration: Criar tabela games
-- Data: 2026-06-13
-- Feature: game-navigation
-- Executar manualmente no Supabase SQL Editor

-- Habilitar a extensão uuid-ossp se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela games
CREATE TABLE IF NOT EXISTS games (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team      text NOT NULL,
  away_team      text NOT NULL,
  home_team_code char(3) NOT NULL,
  away_team_code char(3) NOT NULL,
  match_date     timestamptz NOT NULL,
  home_score     int,
  away_score     int,
  status         text NOT NULL DEFAULT 'pending'
                 CONSTRAINT games_status_check
                 CHECK (status IN ('pending', 'live', 'finished')),
  round          text NOT NULL,
  venue          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS games_match_date_idx ON games (match_date);
CREATE INDEX IF NOT EXISTS games_status_idx ON games (status);
CREATE INDEX IF NOT EXISTS games_match_date_date_idx ON games ((match_date::date));

-- Habilitar Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ler todos os jogos
CREATE POLICY "Autenticados podem ler jogos"
  ON games
  FOR SELECT
  TO authenticated
  USING (true);

-- Nota: INSERT, UPDATE e DELETE só pelo service_role (admins via Supabase dashboard ou scripts seed)
-- Não é necessário criar policies de escrita para authenticated
