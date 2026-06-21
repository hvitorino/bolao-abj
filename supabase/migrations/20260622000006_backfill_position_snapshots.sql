-- Migration: backfill_position_snapshots
-- Cria get_ranking_as_of para calcular ranking histórico preciso por data,
-- depois executa backfill de position_snapshots para todos os grupos.

-- Ranking como estava ao final de um match_day específico.
-- Espelha get_ranking() mas filtra scores de jogos até p_match_day.
CREATE OR REPLACE FUNCTION get_ranking_as_of(p_group_id uuid, p_match_day date)
RETURNS TABLE (
  user_id          uuid,
  participant_name text,
  total_points     int,
  games_predicted  int,
  rank_position    int
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gm.user_id                                        AS user_id,
    p.name                                            AS participant_name,
    COALESCE(SUM(s.points), 0)::int                   AS total_points,
    COUNT(s.id)::int                                  AS games_predicted,
    RANK() OVER (
      ORDER BY COALESCE(SUM(s.points), 0) DESC
    )::int                                            AS rank_position
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON  s.user_id   = gm.user_id
    AND s.group_id  = gm.group_id
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.id        = s.game_id
        AND g.match_day <= p_match_day
    )
  WHERE gm.group_id = p_group_id
  GROUP BY gm.user_id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;

-- Preenche snapshots históricos precisos para um grupo, um por match_day encerrado.
-- Idempotente: ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION backfill_position_snapshots(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day date;
BEGIN
  FOR v_day IN
    SELECT DISTINCT match_day
    FROM games
    WHERE status = 'finished'
    ORDER BY match_day ASC
  LOOP
    INSERT INTO position_snapshots (group_id, user_id, match_day, rank_position, total_points)
    SELECT
      p_group_id,
      r.user_id,
      v_day,
      r.rank_position,
      r.total_points
    FROM get_ranking_as_of(p_group_id, v_day) r
    ON CONFLICT (group_id, user_id, match_day) DO NOTHING;
  END LOOP;
END;
$$;

-- Executa backfill para todos os grupos existentes
DO $$
DECLARE
  v_group_id uuid;
BEGIN
  FOR v_group_id IN SELECT id FROM groups LOOP
    PERFORM backfill_position_snapshots(v_group_id);
  END LOOP;
END;
$$;
