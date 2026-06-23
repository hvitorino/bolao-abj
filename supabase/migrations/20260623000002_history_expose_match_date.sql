-- Migration: expõe match_date no retorno de get_profile_history para exibir hora do jogo

DROP FUNCTION IF EXISTS get_profile_history(uuid, uuid, int, int);

CREATE OR REPLACE FUNCTION get_profile_history(
  p_group_id uuid,
  p_user_id  uuid,
  p_limit    int DEFAULT 20,
  p_offset   int DEFAULT 0
)
RETURNS TABLE (
  game_id         uuid,
  match_date      timestamptz,
  match_day       date,
  home_team       text,
  away_team       text,
  home_team_code  text,
  away_team_code  text,
  home_score      int,
  away_score      int,
  pred_home       int,
  pred_away       int,
  points          int,
  breakdown       jsonb,
  is_miss         boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    g.id                                          AS game_id,
    g.match_date,
    g.match_day,
    g.home_team,
    g.away_team,
    g.home_team_code,
    g.away_team_code,
    g.home_score,
    g.away_score,
    p.home_score                                  AS pred_home,
    p.away_score                                  AS pred_away,
    COALESCE(s.points, 0)                         AS points,
    s.breakdown,
    (p.id IS NULL)                                AS is_miss
  FROM games g
  LEFT JOIN predictions p
    ON p.game_id = g.id
   AND p.user_id = p_user_id
   AND p.group_id = p_group_id
  LEFT JOIN scores s
    ON s.game_id = g.id
   AND s.user_id = p_user_id
   AND s.group_id = p_group_id
  WHERE g.status = 'finished'
  ORDER BY g.match_date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
