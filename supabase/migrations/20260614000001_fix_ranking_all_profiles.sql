-- Migration 20260614000001: corrige ranking para incluir todos os perfis cadastrados
-- Causa raiz: INNER JOIN em scores excluía usuários sem pontuação calculada.
-- Correção: partir de profiles com LEFT JOIN em scores + COALESCE para 0 pontos.

-- Atualiza view ranking_view para incluir todos os participantes (mesmo sem pontos)
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  p.id                                            AS user_id,
  p.name                                          AS participant_name,
  p.avatar_url,
  COALESCE(SUM(s.points), 0)::int                 AS total_points,
  COUNT(s.id)::int                                AS games_predicted,
  RANK() OVER (
    ORDER BY COALESCE(SUM(s.points), 0) DESC
  )::int                                          AS rank_position
FROM profiles p
LEFT JOIN scores s ON s.user_id = p.id
GROUP BY p.id, p.name, p.avatar_url
ORDER BY total_points DESC, p.name ASC;

-- Atualiza função get_ranking() com LEFT JOIN e COALESCE
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
    p.id                                            AS user_id,
    p.name                                          AS participant_name,
    COALESCE(SUM(s.points), 0)::int                 AS total_points,
    COUNT(s.id)::int                                AS games_predicted,
    RANK() OVER (
      ORDER BY COALESCE(SUM(s.points), 0) DESC
    )::int                                          AS rank_position
  FROM profiles p
  LEFT JOIN scores s ON s.user_id = p.id
  GROUP BY p.id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
