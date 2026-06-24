-- Migration: 20260624000010_public_read_games_scores.sql
-- Permite leitura pública (anon) nas tabelas games e scores.
-- Necessário para que o Supabase Realtime funcione na página pública de jogo
-- (/jogos/[gameId]/publico), que usa anon key sem sessão autenticada.
-- Os dados de games (placar, status) e scores (pontos, breakdown) são
-- deliberadamente públicos — a própria página os exibe sem autenticação.

DROP POLICY IF EXISTS "Anon pode ler jogos" ON games;
CREATE POLICY "Anon pode ler jogos"
  ON games FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon pode ler scores" ON scores;
CREATE POLICY "Anon pode ler scores"
  ON scores FOR SELECT
  TO anon
  USING (true);
