-- Migration: otimiza get_ranking_scouts consolidando 6 LEFT JOINs em scores
-- num único CTE com agregação condicional, reduzindo timeout
-- Usa CREATE OR REPLACE (mesmo tipo de retorno, só muda o corpo)

CREATE OR REPLACE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id                uuid,
  exact_count            bigint,
  winner_count           bigint,
  miss_count             bigint,
  pred_active            bigint,
  pred_total             bigint,
  pred_last_two_rounds   bigint,
  winner_score_count     bigint,
  diff_count             bigint,
  loser_score_count      bigint,
  goleada_count          bigint
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
  LEFT JOIN scored_games sg ON sg.user_id = gm.user_id
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS miss_count
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
      AND NOT EXISTS (
        SELECT 1 FROM scores s
        WHERE s.user_id = pr.user_id AND s.game_id = pr.game_id
          AND s.group_id = p_group_id AND (s.breakdown->>'winner')::int > 0
      )
    GROUP BY pr.user_id
  ) miss_agg ON miss_agg.user_id = gm.user_id
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_active_agg ON pred_active_agg.user_id = gm.user_id
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_total_agg ON pred_total_agg.user_id = gm.user_id
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
