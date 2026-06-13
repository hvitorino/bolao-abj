-- Migration: Adicionar UNIQUE constraint em games para idempotência
-- Data: 2026-06-13
-- Feature: game-navigation (Fix 3)
-- Executar manualmente no Supabase SQL Editor em bancos que já tenham a tabela games
--
-- Esta constraint garante que o seed e futuras inserções não possam criar
-- confrontos duplicados (mesmo par de times + mesma data/hora).
-- O seed usa `on_conflict=(home_team_code,away_team_code,match_date)` que depende dela.

ALTER TABLE games
  ADD CONSTRAINT games_unique_match
  UNIQUE (home_team_code, away_team_code, match_date);
