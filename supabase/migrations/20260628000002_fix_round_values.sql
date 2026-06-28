-- Padroniza a coluna round:
-- Fase de grupos: "Rodada 1", "Rodada 2" ou "Rodada 3"
--   Lógica: conta quantos jogos encerrados o home_team tem antes deste jogo + 1
-- Fases eliminatórias: mesmo valor da coluna phase
UPDATE games g
SET round = CASE
  WHEN g.phase != 'Fase de Grupos' THEN g.phase
  ELSE 'Rodada ' || (
    (SELECT COUNT(*)
     FROM games prev
     WHERE (prev.home_team = g.home_team OR prev.away_team = g.home_team)
       AND prev.phase = 'Fase de Grupos'
       AND prev.match_date < g.match_date
       AND prev.status = 'finished'
    ) + 1
  )::text
END;
