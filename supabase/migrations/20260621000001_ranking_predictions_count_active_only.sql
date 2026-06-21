-- Migration: limita predictions_count a jogos encerrados ou em andamento
-- Feature: ranking-predictions-count (refinamento)
--
-- Antes: contava todos os palpites, incluindo jogos ainda não iniciados.
-- Agora: conta apenas palpites de jogos com status 'live' ou 'finished',
-- refletindo engajamento real em vez de palpites futuros já registrados.

DROP FUNCTION IF EXISTS get_ranking(uuid);

CREATE OR REPLACE FUNCTION get_ranking(p_group_id uuid)
RETURNS TABLE (
  rank_position     bigint,
  user_id           uuid,
  participant_name  text,
  total_points      bigint,
  games_predicted   bigint,
  predictions_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC, p.name ASC) AS rank_position,
    p.id                                                                  AS user_id,
    p.name                                                                AS participant_name,
    COALESCE(SUM(s.points), 0)                                           AS total_points,
    COALESCE(COUNT(DISTINCT s.game_id), 0)                               AS games_predicted,
    COALESCE(pred_counts.cnt, 0)                                         AS predictions_count
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON s.user_id = gm.user_id
   AND s.group_id = p_group_id
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id
    WHERE pr.group_id = p_group_id
      AND g.status IN ('live', 'finished')
    GROUP BY pr.user_id
  ) pred_counts ON pred_counts.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, p.name, pred_counts.cnt
  ORDER BY total_points DESC, p.name ASC;
$$;
