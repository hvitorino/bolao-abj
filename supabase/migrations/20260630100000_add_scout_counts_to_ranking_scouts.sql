-- Migration: estende get_ranking_scouts com contagens dos 4 scouts restantes
-- (winner_score_count, diff_count, loser_score_count, goleada_count)
-- Versão otimizada: consolida 6 LEFT JOINs em scores num único CTE com agregação condicional
-- Necessário DROP pois o tipo de retorno (TABLE) mudou com as novas colunas

DROP FUNCTION IF EXISTS get_ranking_scouts(uuid);

CREATE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id                uuid,
  exact_count            bigint,   -- placar exato (exact > 0)
  winner_count           bigint,   -- acerto de vencedor (winner > 0)
  miss_count             bigint,   -- erros de vencedor em jogos live/finished com palpite
  pred_active            bigint,   -- palpites em jogos live/finished
  pred_total             bigint,   -- palpites em qualquer jogo do grupo
  pred_last_two_rounds   bigint,   -- palpites nas 2 rodadas mais recentes com jogos live/finished
  winner_score_count     bigint,   -- acertos de placar do vencedor (winner_score > 0)
  diff_count             bigint,   -- acertos de diferença de gols (diff > 0)
  loser_score_count      bigint,   -- acertos de placar do perdedor (loser_score > 0)
  goleada_count          bigint    -- acertos de goleada (goleada > 0)
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH last_two_rounds AS (
    SELECT round
    FROM games
    WHERE status IN ('live', 'finished')
    GROUP BY round
    ORDER BY MAX(match_date) DESC
    LIMIT 2
  ),
  -- Única passagem em scores + games: extrai todos os breakdowns de uma vez
  scored_games AS (
    SELECT
      s.user_id,
      s.game_id,
      (s.breakdown->>'exact')::int         AS exact_val,
      (s.breakdown->>'winner')::int        AS winner_val,
      (s.breakdown->>'winner_score')::int  AS winner_score_val,
      (s.breakdown->>'diff')::int          AS diff_val,
      (s.breakdown->>'loser_score')::int   AS loser_score_val,
      (s.breakdown->>'goleada')::int       AS goleada_val
    FROM scores s
    JOIN games g ON g.id = s.game_id AND g.status IN ('live', 'finished')
    WHERE s.group_id = p_group_id
  )
  SELECT
    p.id AS user_id,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.exact_val > 0         THEN sg.game_id END), 0) AS exact_count,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.winner_val > 0        THEN sg.game_id END), 0) AS winner_count,
    COALESCE(miss_agg.miss_count, 0)                                                    AS miss_count,
    COALESCE(pred_active_agg.cnt, 0)                                                    AS pred_active,
    COALESCE(pred_total_agg.cnt, 0)                                                     AS pred_total,
    COALESCE(pred_last2_agg.cnt, 0)                                                     AS pred_last_two_rounds,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.winner_score_val > 0  THEN sg.game_id END), 0) AS winner_score_count,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.diff_val > 0          THEN sg.game_id END), 0) AS diff_count,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.loser_score_val > 0   THEN sg.game_id END), 0) AS loser_score_count,
    COALESCE(COUNT(DISTINCT CASE WHEN sg.goleada_val > 0       THEN sg.game_id END), 0) AS goleada_count
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  -- Única junção com scored_games (substitui 6 LEFT JOINs anteriores)
  LEFT JOIN scored_games sg ON sg.user_id = gm.user_id
  -- miss_count: jogos live/finished com palpite mas sem winner > 0 em scores
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS miss_count
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
      AND NOT EXISTS (
        SELECT 1 FROM scores s
        WHERE s.user_id   = pr.user_id
          AND s.game_id   = pr.game_id
          AND s.group_id  = p_group_id
          AND (s.breakdown->>'winner')::int > 0
      )
    GROUP BY pr.user_id
  ) miss_agg ON miss_agg.user_id = gm.user_id
  -- pred_active: palpites em jogos live/finished
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_active_agg ON pred_active_agg.user_id = gm.user_id
  -- pred_total: palpites em qualquer status
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_total_agg ON pred_total_agg.user_id = gm.user_id
  -- pred_last_two_rounds
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id
    WHERE pr.group_id = p_group_id
      AND g.round IN (SELECT round FROM last_two_rounds)
    GROUP BY pr.user_id
  ) pred_last2_agg ON pred_last2_agg.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, miss_agg.miss_count, pred_active_agg.cnt, pred_total_agg.cnt, pred_last2_agg.cnt;
$$;
