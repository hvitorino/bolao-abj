-- Migration: cria função get_streak_for_group
-- Retorna a sequência atual de acertos consecutivos (streak) por participante
-- dentro de um grupo. O streak conta a partir do jogo encerrado mais recente,
-- retroativamente, enquanto houver acerto do vencedor ininterrupto.
-- Quebra: jogo encerrado sem palpite OU palpite com breakdown->winner = 0.

CREATE OR REPLACE FUNCTION get_streak_for_group(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  streak  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
  members AS (
    SELECT gm.user_id
    FROM group_members gm
    WHERE gm.group_id = p_group_id
  ),
  finished_games AS (
    SELECT
      g.id AS game_id,
      ROW_NUMBER() OVER (ORDER BY g.match_date DESC, g.id DESC) AS rn
    FROM games g
    WHERE g.status = 'finished'
  ),
  -- Para cada membro × jogo encerrado, determina se houve acerto do vencedor
  member_game_results AS (
    SELECT
      m.user_id,
      fg.game_id,
      fg.rn,
      CASE
        WHEN p.id IS NOT NULL AND COALESCE((s.breakdown->>'winner')::int, 0) > 0
        THEN TRUE
        ELSE FALSE
      END AS hit
    FROM members m
    CROSS JOIN finished_games fg
    LEFT JOIN predictions p
      ON p.user_id = m.user_id
     AND p.game_id = fg.game_id
     AND p.group_id = p_group_id
    LEFT JOIN scores s
      ON s.user_id = m.user_id
     AND s.game_id = fg.game_id
     AND s.group_id = p_group_id
  ),
  -- Primeiro jogo (rn mais baixo = mais recente) em que o participante NÃO acertou
  first_miss AS (
    SELECT
      user_id,
      MIN(rn) AS miss_rn
    FROM member_game_results
    WHERE hit = FALSE
    GROUP BY user_id
  ),
  total_finished AS (
    SELECT COUNT(*) AS cnt FROM finished_games
  )
  SELECT
    m.user_id,
    COALESCE(fm.miss_rn - 1, tf.cnt)::bigint AS streak
  FROM members m
  LEFT JOIN first_miss fm ON fm.user_id = m.user_id
  CROSS JOIN total_finished tf
$$;
