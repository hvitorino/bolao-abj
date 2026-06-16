-- Migration: substitui get_ranking() por get_ranking(p_group_id uuid),
-- escopando o ranking por grupo.
-- Feature: grupos
-- Data: 2026-06-15
--
-- Mudança-chave em relação à versão anterior (20260614000001_fix_ranking_all_profiles.sql):
-- a base agora é group_members filtrado por p_group_id (em vez de todos os
-- profiles do sistema), e o LEFT JOIN com scores exige s.group_id = gm.group_id
-- — garantindo que a soma de pontos considera apenas scores daquele grupo
-- específico. Preserva o comportamento de incluir membros com 0 pontos
-- (LEFT JOIN + COALESCE), agora por grupo.

DROP FUNCTION IF EXISTS get_ranking();

CREATE OR REPLACE FUNCTION get_ranking(p_group_id uuid)
RETURNS TABLE (
  user_id          uuid,
  participant_name text,
  total_points     int,
  games_predicted  int,
  rank_position    int
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gm.user_id                                       AS user_id,
    p.name                                            AS participant_name,
    COALESCE(SUM(s.points), 0)::int                   AS total_points,
    COUNT(s.id)::int                                  AS games_predicted,
    RANK() OVER (
      ORDER BY COALESCE(SUM(s.points), 0) DESC
    )::int                                            AS rank_position
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s ON s.user_id = gm.user_id AND s.group_id = gm.group_id
  WHERE gm.group_id = p_group_id
  GROUP BY gm.user_id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
