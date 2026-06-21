-- Migration: adiciona predictions_count ao resultado de get_ranking()
-- Feature: ranking-predictions-count
-- Data: 2026-06-21
--
-- Estratégia: recriar a função com CREATE OR REPLACE para ser idempotente.
-- predictions_count conta todos os palpites submetidos para o grupo (tabela predictions),
-- diferente de games_predicted que conta jogos que renderam pontuação (tabela scores).
-- Durante a Copa (jogos pendentes/ao vivo), predictions_count >= games_predicted.
--
-- Preserva:
--   - Critério de empate: ORDER BY total_points DESC, p.name ASC
--   - Membros com 0 pontos aparecem (LEFT JOIN + COALESCE)
--   - Escopo por grupo: WHERE gm.group_id = p_group_id

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
    SELECT user_id, COUNT(*) AS cnt
    FROM predictions
    WHERE group_id = p_group_id
    GROUP BY user_id
  ) pred_counts ON pred_counts.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, p.name, pred_counts.cnt
  ORDER BY total_points DESC, p.name ASC;
$$;
