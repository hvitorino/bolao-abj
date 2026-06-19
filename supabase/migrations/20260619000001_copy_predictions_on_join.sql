-- Migration: cria função copy_predictions_to_group e trigger on_group_member_inserted
-- Feature: group-member-history
-- Data: 2026-06-19
--
-- Ao adicionar um participante a um grupo (INSERT em group_members), copia
-- automaticamente todos os seus palpites existentes em outros grupos para o
-- novo grupo e recalcula a pontuação dos jogos 'finished' com palpite copiado.
--
-- Estratégia: replicação imediata (Opção A da spec) — copia predictions com
-- ON CONFLICT DO NOTHING, garantindo idempotência via UNIQUE(user_id, game_id, group_id).
-- O trigger é síncrono: a cópia é concluída antes da resposta HTTP dos endpoints
-- POST /api/groups/join e POST /api/invites/[id]/accept.
--
-- Tratamento de erro: exceções internas são capturadas com RAISE WARNING para
-- que falhas pontuais de cópia não bloqueiem a entrada do usuário no grupo.
-- A entrada no grupo é sempre priorizada sobre a completude do histórico.

-- -----------------------------------------------------------------------
-- 1. Função principal: copy_predictions_to_group
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION copy_predictions_to_group(
  p_user_id  uuid,
  p_group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pred predictions%ROWTYPE;
BEGIN
  -- Para cada jogo em que o usuário tem palpite em QUALQUER outro grupo,
  -- mas ainda NÃO tem palpite no grupo p_group_id, copiar o palpite mais
  -- recente (por submitted_at DESC — desempate por maior UUID se necessário).
  FOR v_pred IN
    SELECT DISTINCT ON (game_id)
      user_id, game_id, home_score, away_score, submitted_at
    FROM predictions
    WHERE user_id = p_user_id
      AND group_id <> p_group_id
    ORDER BY game_id, submitted_at DESC
  LOOP
    BEGIN
      INSERT INTO predictions (user_id, game_id, group_id, home_score, away_score, submitted_at)
      VALUES (p_user_id, v_pred.game_id, p_group_id, v_pred.home_score, v_pred.away_score, v_pred.submitted_at)
      ON CONFLICT (user_id, game_id, group_id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'copy_predictions_to_group: erro ao copiar prediction game_id=% para group_id=%: %',
          v_pred.game_id, p_group_id, SQLERRM;
    END;
  END LOOP;

  -- Recalcular pontuação para jogos 'finished' que agora têm prediction neste
  -- grupo. calculate_scores_for_game itera TODAS as predictions do jogo
  -- (incluindo as recém-copiadas) e usa ON CONFLICT (prediction_id) DO UPDATE
  -- — é idempotente. Cada chamada gera (ou atualiza) o score com o group_id
  -- do novo grupo.
  PERFORM calculate_scores_for_game(g.id)
  FROM games g
  WHERE g.status = 'finished'
    AND EXISTS (
      SELECT 1 FROM predictions p2
      WHERE p2.game_id = g.id
        AND p2.user_id = p_user_id
        AND p2.group_id = p_group_id
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 2. Função trigger: trigger_copy_predictions_on_join
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_copy_predictions_on_join()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM copy_predictions_to_group(NEW.user_id, NEW.group_id);
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------
-- 3. Trigger: on_group_member_inserted
-- -----------------------------------------------------------------------
-- DROP IF EXISTS garante idempotência: aplicar a migration duas vezes não
-- deixa dois triggers iguais (o que duplicaria a execução da função).

DROP TRIGGER IF EXISTS on_group_member_inserted ON group_members;

CREATE TRIGGER on_group_member_inserted
  AFTER INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION trigger_copy_predictions_on_join();
