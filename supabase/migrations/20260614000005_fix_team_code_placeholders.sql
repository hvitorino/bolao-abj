-- Migration 005: corrige códigos placeholder de 2 chars para 3 chars
--
-- Contexto: após a migration 004 remover os espaços de padding do char(3),
-- os códigos placeholder dos jogos de mata-mata ficaram com 2 chars (ex: "2A", "SF").
-- Esta migration converte esses códigos para formatos de 3 chars informativos.
--
-- Mapeamento: código_velho → código_novo
--   "2A" → "2GA" (2nd place Group A)
--   "1A" → "1GA" (Winner Group A)
--   "SF" → "SFX" (Semifinal placeholder)
--   etc.

-- Atualizar códigos home
UPDATE games
SET home_team_code = CASE
  WHEN home_team_code = 'SF' THEN 'SFX'
  WHEN home_team_code ~ '^[12][A-L]$' THEN SUBSTRING(home_team_code, 1, 1) || 'G' || SUBSTRING(home_team_code, 2, 1)
  ELSE home_team_code
END
WHERE length(home_team_code) < 3;

-- Atualizar códigos away
UPDATE games
SET away_team_code = CASE
  WHEN away_team_code = 'SF' THEN 'SFX'
  WHEN away_team_code ~ '^[12][A-L]$' THEN SUBSTRING(away_team_code, 1, 1) || 'G' || SUBSTRING(away_team_code, 2, 1)
  ELSE away_team_code
END
WHERE length(away_team_code) < 3;
