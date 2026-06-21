-- Migration: fix_profile_stats_active_denominator
-- Adiciona campo active_predictions_made à função get_profile_stats.
-- O denominador das taxas (acerto de vencedor, placar exato, média de pontos)
-- passa a ser apenas palpites em jogos com status 'finished' ou 'live',
-- excluindo jogos 'pending' cujo resultado ainda não é conhecido.

-- DROP necessário pois o tipo de retorno mudou (adição de active_predictions_made)
DROP FUNCTION IF EXISTS get_profile_stats(uuid, uuid);

CREATE OR REPLACE FUNCTION get_profile_stats(p_group_id uuid, p_user_id uuid)
RETURNS TABLE (
  predictions_made        bigint,
  active_predictions_made bigint,
  finished_games          bigint,
  winner_correct          bigint,
  exact_correct           bigint,
  total_points            bigint,
  best_streak             bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH finished AS (
    SELECT g.id, g.match_date
    FROM games g
    WHERE g.status = 'finished'
    ORDER BY g.match_date ASC, g.id ASC
  ),
  user_predictions AS (
    SELECT p.game_id, p.id AS prediction_id
    FROM predictions p
    WHERE p.user_id = p_user_id
      AND p.group_id = p_group_id
  ),
  active_user_predictions AS (
    SELECT p.game_id
    FROM predictions p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = p_user_id
      AND p.group_id = p_group_id
      AND g.status IN ('finished', 'live')
  ),
  user_scores AS (
    SELECT s.game_id,
           s.points,
           (s.breakdown->>'winner')::int AS winner_pts,
           (s.breakdown->>'exact')::int  AS exact_pts
    FROM scores s
    WHERE s.user_id = p_user_id
      AND s.group_id = p_group_id
  ),
  game_results AS (
    SELECT
      f.id AS game_id,
      ROW_NUMBER() OVER (ORDER BY f.match_date ASC, f.id ASC) AS rn,
      CASE
        WHEN us.winner_pts > 0 THEN 1
        ELSE 0
      END AS hit
    FROM finished f
    LEFT JOIN user_scores us ON us.game_id = f.id
  ),
  streak_groups AS (
    SELECT
      game_id,
      rn,
      hit,
      rn - ROW_NUMBER() OVER (PARTITION BY hit ORDER BY rn) AS grp
    FROM game_results
  ),
  best AS (
    SELECT COALESCE(MAX(cnt), 0) AS best_streak
    FROM (
      SELECT grp, COUNT(*) AS cnt
      FROM streak_groups
      WHERE hit = 1
      GROUP BY grp
    ) runs
  )
  SELECT
    (SELECT COUNT(*) FROM user_predictions)                                        AS predictions_made,
    (SELECT COUNT(*) FROM active_user_predictions)                                 AS active_predictions_made,
    (SELECT COUNT(*) FROM finished)                                                AS finished_games,
    (SELECT COUNT(*) FROM user_scores WHERE winner_pts > 0)                        AS winner_correct,
    (SELECT COUNT(*) FROM user_scores WHERE exact_pts > 0)                         AS exact_correct,
    (SELECT COALESCE(SUM(points), 0) FROM user_scores)                             AS total_points,
    (SELECT best_streak FROM best)                                                  AS best_streak
$$;
