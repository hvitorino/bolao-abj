-- Migration 005: ranking_view + get_ranking()
-- Nota: "position" é palavra reservada no PostgreSQL — usar rank_position
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  s.user_id,
  p.name        AS participant_name,
  p.avatar_url,
  SUM(s.points)::int                              AS total_points,
  COUNT(s.id)::int                                AS games_predicted,
  RANK() OVER (ORDER BY SUM(s.points) DESC)::int  AS rank_position
FROM scores s
JOIN profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.name, p.avatar_url
ORDER BY total_points DESC;

CREATE OR REPLACE FUNCTION get_ranking()
RETURNS TABLE (
  user_id          uuid,
  participant_name text,
  total_points     int,
  games_predicted  int,
  rank_position    int
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    s.user_id,
    p.name        AS participant_name,
    SUM(s.points)::int                              AS total_points,
    COUNT(s.id)::int                                AS games_predicted,
    RANK() OVER (ORDER BY SUM(s.points) DESC)::int  AS rank_position
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  GROUP BY s.user_id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
