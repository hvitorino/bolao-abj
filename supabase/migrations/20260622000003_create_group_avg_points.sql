-- Migration: função get_group_avg_points
-- Retorna a média de pontos por palpite de todos os membros do grupo

CREATE OR REPLACE FUNCTION get_group_avg_points(p_group_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    CASE
      WHEN COUNT(s.id) = 0 THEN 0
      ELSE ROUND(SUM(s.points)::numeric / COUNT(DISTINCT (s.user_id, s.game_id))::numeric, 2)
    END
  FROM scores s
  WHERE s.group_id = p_group_id;
$$;
