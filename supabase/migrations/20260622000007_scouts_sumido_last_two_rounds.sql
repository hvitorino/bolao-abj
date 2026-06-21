-- Migration: atualiza get_ranking_scouts adicionando pred_last_two_rounds
-- Necessário DROP pois o tipo de retorno (TABLE) mudou com a nova coluna

DROP FUNCTION IF EXISTS get_ranking_scouts(uuid);

CREATE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id                uuid,
  exact_count            bigint,
  winner_count           bigint,
  miss_count             bigint,
  pred_active            bigint,
  pred_total             bigint,
  pred_last_two_rounds   bigint   -- palpites nas 2 rodadas mais recentes com jogos live/finished
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
  )
  SELECT
    p.id AS user_id,
    COALESCE(COUNT(DISTINCT s_exact.game_id), 0)          AS exact_count,
    COALESCE(COUNT(DISTINCT s_winner.game_id), 0)         AS winner_count,
    COALESCE(miss_agg.miss_count, 0)                      AS miss_count,
    COALESCE(pred_active_agg.cnt, 0)                      AS pred_active,
    COALESCE(pred_total_agg.cnt, 0)                       AS pred_total,
    COALESCE(pred_last2_agg.cnt, 0)                       AS pred_last_two_rounds
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s_exact
    ON s_exact.user_id = gm.user_id
   AND s_exact.group_id = p_group_id
   AND (s_exact.breakdown->>'exact')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_exact.game_id AND g.status IN ('live','finished'))
  LEFT JOIN scores s_winner
    ON s_winner.user_id = gm.user_id
   AND s_winner.group_id = p_group_id
   AND (s_winner.breakdown->>'winner')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_winner.game_id AND g.status IN ('live','finished'))
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
