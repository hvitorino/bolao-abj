-- Corrige jogos que caíram no fallback "Copa do Mundo 2026" ou "Rodada de 32"
-- usando a mesma lógica de getPhase() do sync.
UPDATE games
SET round = CASE
  WHEN match_date < '2026-06-28T12:00:00Z' THEN 'Fase de Grupos'
  WHEN match_date < '2026-07-04T12:00:00Z' THEN '16 avos de Final'
  WHEN match_date < '2026-07-08T12:00:00Z' THEN 'Oitavas de Final'
  WHEN match_date < '2026-07-13T12:00:00Z' THEN 'Quartas de Final'
  WHEN match_date < '2026-07-18T12:00:00Z' THEN 'Semifinal'
  WHEN match_date < '2026-07-19T00:00:00Z' THEN 'Terceiro Lugar'
  ELSE 'Final'
END
WHERE round IN ('Copa do Mundo 2026', 'Rodada de 32');
