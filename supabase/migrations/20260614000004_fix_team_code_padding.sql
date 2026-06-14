-- Migration 004: corrige exibição dos códigos de times no frontend
--
-- Diagnóstico: jogos de mata-mata (oitavas, quartas, semis, final) têm códigos
-- placeholder como "2A", "1C", "SF" (2 chars) armazenados como char(3) com
-- padding de espaço ("2A ", "1C ", "SF "). O React renderiza o espaço trailing,
-- quebrando o alinhamento visual.
--
-- Solução: converter char(3) para varchar(3), que não adiciona padding, e
-- atualizar os registros existentes para remover o espaço trailing.

-- 1. Remover espaços trailing dos registros existentes
UPDATE games
SET home_team_code = trim(home_team_code)
WHERE home_team_code != trim(home_team_code);

UPDATE games
SET away_team_code = trim(away_team_code)
WHERE away_team_code != trim(away_team_code);

-- 2. Converter tipo das colunas de char(3) para varchar(3)
--    varchar não adiciona padding de espaços, prevenindo recorrência
ALTER TABLE games
  ALTER COLUMN home_team_code TYPE varchar(10),
  ALTER COLUMN away_team_code TYPE varchar(10);
