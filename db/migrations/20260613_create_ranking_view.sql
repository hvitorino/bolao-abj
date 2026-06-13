-- Migration: ranking_view + get_ranking()
-- Feature: ranking
-- Data: 2026-06-13
--
-- Executar manualmente no Supabase SQL Editor

-- View para agregação de pontos do ranking
-- Nota: usa SECURITY DEFINER implicitamente via função RPC abaixo.
-- A view em si reflete as políticas RLS de scores (SELECT próprio usuário),
-- portanto o acesso ao ranking completo é feito via função get_ranking() com SECURITY DEFINER.
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  s.user_id,
  p.name AS participant_name,
  p.avatar_url,
  SUM(s.points)::int AS total_points,
  COUNT(s.id)::int AS games_predicted,
  RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
FROM scores s
JOIN profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.name, p.avatar_url
ORDER BY total_points DESC;

-- Função RPC para retornar o ranking completo a qualquer usuário autenticado
-- SECURITY DEFINER: executa com permissões do owner, ignorando RLS de scores
CREATE OR REPLACE FUNCTION get_ranking()
RETURNS TABLE (
  user_id uuid,
  participant_name text,
  total_points int,
  games_predicted int,
  position int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    s.user_id,
    p.name AS participant_name,
    SUM(s.points)::int AS total_points,
    COUNT(s.id)::int AS games_predicted,
    RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  GROUP BY s.user_id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;

-- Habilitar Realtime para scores (caso não tenha sido feito na feature scoring)
-- Executar apenas se ainda não estiver configurado:
-- ALTER TABLE scores REPLICA IDENTITY FULL;
-- ALTER PUBLICATION supabase_realtime ADD TABLE scores;
