-- Migration: substitui as policies de predictions/scores por versões
-- escopadas por grupo (multi-tenancy).
-- Feature: grupos
-- Data: 2026-06-15
--
-- ATENÇÃO — ORDEM DE APLICAÇÃO: só aplicar depois de 20260615120300
-- (NOT NULL + nova constraint) ter sido confirmada com sucesso. Se aplicada
-- antes do backfill, is_group_member(group_id, ...) com group_id NULL nunca
-- é verdadeiro e toda leitura de predictions/scores para temporariamente
-- (ver Risco 5 da spec).

-- ============================================================
-- predictions
-- ============================================================

-- Remove todas as policies de SELECT conhecidas em predictions, de todas as
-- features anteriores, para não deixar nenhuma policy permissiva órfã que
-- vazaria dados entre grupos.
DROP POLICY IF EXISTS "predictions_select_own" ON predictions;
DROP POLICY IF EXISTS "predictions_select_all_authenticated" ON predictions;
DROP POLICY IF EXISTS "predictions_select_started_or_own" ON predictions;
DROP POLICY IF EXISTS "predictions_insert_own" ON predictions;

CREATE POLICY "predictions_select_group_scoped"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    is_group_member(group_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM games
        WHERE games.id = predictions.game_id
          AND games.status <> 'pending'
      )
    )
  );

-- Sem policy de INSERT/UPDATE para `authenticated`: toda escrita em predictions
-- é feita via service_role nos Route Handlers, que validam membership
-- explicitamente antes de inserir/atualizar.

-- ============================================================
-- scores
-- ============================================================

DROP POLICY IF EXISTS "scores_select_own" ON scores;
DROP POLICY IF EXISTS "scores_select_all_authenticated" ON scores;
DROP POLICY IF EXISTS "Autenticados podem ler todos os scores" ON scores;

CREATE POLICY "scores_select_group_scoped"
  ON scores FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

-- profiles e games: sem alteração de RLS nesta feature (permanecem globais).
