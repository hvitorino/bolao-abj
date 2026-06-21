-- Migration: função record_position_snapshots + trigger trg_snapshot_on_day_close
-- Grava snapshot de posições para todos os membros ao fechar o último jogo do dia

-- Função idempotente: grava posições de todos os membros de um grupo para um dado match_day
CREATE OR REPLACE FUNCTION record_position_snapshots(p_group_id uuid, p_match_day date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO position_snapshots (group_id, user_id, match_day, rank_position, total_points)
  SELECT
    p_group_id,
    r.user_id,
    p_match_day,
    r.rank_position::int,
    r.total_points::int
  FROM get_ranking(p_group_id) r
  ON CONFLICT (group_id, user_id, match_day) DO NOTHING;
$$;

-- Trigger: ao fechar último jogo do dia, gravar snapshot para todos os grupos com palpites naquele dia
CREATE OR REPLACE FUNCTION trigger_snapshot_on_day_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_day date;
  v_remaining int;
  rec record;
BEGIN
  -- Só processa quando muda para 'finished'
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;

  v_match_day := NEW.match_day;

  -- Conta jogos do mesmo dia que NÃO estão finished ainda (excluindo o próprio)
  SELECT COUNT(*) INTO v_remaining
  FROM games
  WHERE match_day = v_match_day
    AND status <> 'finished'
    AND id <> NEW.id;

  -- Se ainda há jogos não encerrados no dia, não grava snapshot
  IF v_remaining > 0 THEN
    RETURN NEW;
  END IF;

  -- Grava snapshot para cada grupo que tem palpite nesse dia
  FOR rec IN
    SELECT DISTINCT p.group_id
    FROM predictions p
    JOIN games g ON g.id = p.game_id
    WHERE g.match_day = v_match_day
  LOOP
    PERFORM record_position_snapshots(rec.group_id, v_match_day);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_on_day_close ON games;
CREATE TRIGGER trg_snapshot_on_day_close
  AFTER UPDATE OF status ON games
  FOR EACH ROW
  EXECUTE FUNCTION trigger_snapshot_on_day_close();
