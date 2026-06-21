-- Migration: cria função get_ranking_scouts para cálculo de badges de scout no ranking
-- Idempotente via CREATE OR REPLACE

CREATE OR REPLACE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id       uuid,
  exact_count   bigint,   -- número de acertos de placar exato (exact > 0)
  winner_count  bigint,   -- número de acertos de vencedor (winner > 0)
  miss_count    bigint,   -- número de erros de vencedor em jogos live/finished com palpite
  pred_active   bigint,   -- palpites em jogos live/finished (para scout "sumido")
  pred_total    bigint    -- palpites em qualquer jogo do grupo (para scout "wally")
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id AS user_id,
    -- acertos de placar exato: scores de jogos live/finished com breakdown->exact > 0
    COALESCE(COUNT(DISTINCT s_exact.game_id), 0)          AS exact_count,
    -- acertos de vencedor: scores de jogos live/finished com breakdown->winner > 0
    COALESCE(COUNT(DISTINCT s_winner.game_id), 0)         AS winner_count,
    -- erros de vencedor: palpites em jogos live/finished onde winner = 0 em scores
    -- (inclui jogos com palpite mas sem score gerado, tratados como winner=0)
    COALESCE(miss_agg.miss_count, 0)                      AS miss_count,
    -- palpites em jogos live/finished
    COALESCE(pred_active_agg.cnt, 0)                      AS pred_active,
    -- palpites em qualquer status (para detectar wally)
    COALESCE(pred_total_agg.cnt, 0)                       AS pred_total
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  -- exact_count
  LEFT JOIN scores s_exact
    ON s_exact.user_id = gm.user_id
   AND s_exact.group_id = p_group_id
   AND (s_exact.breakdown->>'exact')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_exact.game_id AND g.status IN ('live','finished'))
  -- winner_count
  LEFT JOIN scores s_winner
    ON s_winner.user_id = gm.user_id
   AND s_winner.group_id = p_group_id
   AND (s_winner.breakdown->>'winner')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_winner.game_id AND g.status IN ('live','finished'))
  -- miss_count: jogos live/finished com palpite registrado mas sem winner > 0 em scores
  LEFT JOIN (
    SELECT
      pr.user_id,
      COUNT(*) AS miss_count
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
      AND NOT EXISTS (
        SELECT 1 FROM scores s
        WHERE s.user_id   = pr.user_id
          AND s.game_id   = pr.game_id
          AND s.group_id  = p_group_id
          AND (s.breakdown->>'winner')::int > 0
      )
    GROUP BY pr.user_id
  ) miss_agg ON miss_agg.user_id = gm.user_id
  -- pred_active: palpites em jogos live/finished
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_active_agg ON pred_active_agg.user_id = gm.user_id
  -- pred_total: palpites em qualquer status
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_total_agg ON pred_total_agg.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, miss_agg.miss_count, pred_active_agg.cnt, pred_total_agg.cnt;
$$;
