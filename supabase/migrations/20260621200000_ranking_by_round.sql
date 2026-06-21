-- Função: get_ranking_by_round — ranking filtrado por fase
DROP FUNCTION IF EXISTS get_ranking_by_round(uuid, text);

CREATE OR REPLACE FUNCTION get_ranking_by_round(p_group_id uuid, p_round text)
RETURNS TABLE (
  rank_position     bigint,
  user_id           uuid,
  participant_name  text,
  total_points      bigint,
  games_predicted   bigint
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
    COALESCE(COUNT(DISTINCT s.game_id), 0)                               AS games_predicted
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON s.user_id = gm.user_id
   AND s.group_id = p_group_id
  LEFT JOIN games g ON g.id = s.game_id
  WHERE gm.group_id = p_group_id
    AND (s.game_id IS NULL OR g.round = p_round)
  GROUP BY p.id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;

-- Função: get_available_rounds — fases com palpites no grupo
DROP FUNCTION IF EXISTS get_available_rounds(uuid);

CREATE OR REPLACE FUNCTION get_available_rounds(p_group_id uuid)
RETURNS TABLE (round text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT g.round
  FROM games g
  JOIN predictions pred ON pred.game_id = g.id AND pred.group_id = p_group_id
  WHERE g.round IS NOT NULL
  ORDER BY g.round;
$$;
