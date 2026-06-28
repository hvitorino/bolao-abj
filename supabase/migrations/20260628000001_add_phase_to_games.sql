-- Adiciona coluna phase com a fase do torneio em português
ALTER TABLE games ADD COLUMN phase text;

UPDATE games SET phase = CASE
  WHEN round LIKE 'Grupo %'                                                          THEN 'Fase de Grupos'
  WHEN round = 'Copa do Mundo 2026' AND match_date < '2026-06-28T12:00:00Z'         THEN 'Fase de Grupos'
  WHEN match_date >= '2026-06-28T12:00:00Z' AND match_date < '2026-07-04T12:00:00Z' THEN '16 avos de Final'
  WHEN match_date >= '2026-07-04T12:00:00Z' AND match_date < '2026-07-08T12:00:00Z' THEN 'Oitavas de Final'
  WHEN match_date >= '2026-07-08T12:00:00Z' AND match_date < '2026-07-13T12:00:00Z' THEN 'Quartas de Final'
  WHEN match_date >= '2026-07-13T12:00:00Z' AND match_date < '2026-07-18T12:00:00Z' THEN 'Semifinal'
  WHEN match_date::date = '2026-07-18'                                               THEN 'Terceiro Lugar'
  WHEN match_date >= '2026-07-19T00:00:00Z'                                          THEN 'Final'
  ELSE 'Fase de Grupos'
END;

ALTER TABLE games ALTER COLUMN phase SET NOT NULL;
