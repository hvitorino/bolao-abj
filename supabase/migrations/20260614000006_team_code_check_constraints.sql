-- Migration 006: adiciona CHECK constraints nos códigos de times
--
-- A mudança de char(3) para varchar(10) na migration 004 removeu a limitação
-- implícita de comprimento que o tipo char fornecia. Sem uma CHECK constraint
-- explícita, o banco aceita silenciosamente qualquer string de até 10 chars.
--
-- A regra de negócio exige exatamente 3 caracteres em home_team_code e
-- away_team_code. Esta migration reforça essa regra na camada de banco,
-- protegendo seeds, rotas alternativas e inserções diretas via SQL Admin.
--
-- Nota: usa length(trim(...)) = 3 para ser compatível com dados após o trim
-- da migration 004 e para tolerar espaços acidentais em ambientes legados.

ALTER TABLE games
  ADD CONSTRAINT games_home_team_code_length CHECK (length(trim(home_team_code)) = 3),
  ADD CONSTRAINT games_away_team_code_length CHECK (length(trim(away_team_code)) = 3);
