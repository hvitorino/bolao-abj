-- Adiciona coluna match_day (DATE) à tabela games.
--
-- Esta coluna armazena o dia do calendário ESPN — o mesmo valor da query
-- ?dates=YYYYMMDD que retornou o jogo na sincronização. Jogos disputados
-- à noite nos fusos do Pacífico (PDT, UTC-7) ou América Central (CDT, UTC-5)
-- têm match_date UTC no dia seguinte, mas pertencem ao dia anterior no
-- calendário ESPN. Guardar match_day elimina qualquer inferência de fuso.
--
-- Backfill: aproxima via UTC-5 (CDT/EST, o fuso mais conservador dos
-- locais da Copa 2026) para dados já existentes. O próximo sync sobrescreve
-- com o valor definitivo da ESPN.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS match_day DATE;

UPDATE games
SET match_day = (match_date - INTERVAL '5 hours')::date
WHERE match_day IS NULL;

-- Índice para filtros por dia (página de jogos, bottom sheets)
CREATE INDEX IF NOT EXISTS idx_games_match_day ON games (match_day);
