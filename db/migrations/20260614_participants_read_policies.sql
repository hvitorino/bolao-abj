-- Migration: Políticas de leitura para todos os participantes
-- Data: 2026-06-14
-- Feature: game-participants-view
--
-- Esta feature exige que qualquer usuário autenticado possa ler palpites
-- e scores de TODOS os participantes do bolão (não apenas os seus próprios).
--
-- Antes desta migration, as políticas de predictions e scores só permitiam
-- SELECT filtrado por auth.uid() = user_id.

-- ============================================================
-- predictions: SELECT para todos os autenticados
-- ============================================================

-- Remove a política restritiva (apenas próprios palpites)
DROP POLICY IF EXISTS "predictions_select_own" ON predictions;

-- Cria política permissiva: qualquer autenticado lê todos os palpites
CREATE POLICY "predictions_select_all_authenticated"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- scores: SELECT para todos os autenticados
-- ============================================================

-- Remove a política restritiva (apenas próprios scores)
DROP POLICY IF EXISTS "scores_select_own" ON scores;

-- Cria política permissiva: qualquer autenticado lê todos os scores
CREATE POLICY "scores_select_all_authenticated"
  ON scores FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- profiles: SELECT para todos os autenticados
-- ============================================================
-- A tabela profiles é gerenciada pelo Supabase Auth.
-- Se já existir política de SELECT para authenticated, não há conflito.
-- Executar apenas se a política ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_all_authenticated'
  ) THEN
    EXECUTE '
      CREATE POLICY "profiles_select_all_authenticated"
        ON profiles FOR SELECT
        TO authenticated
        USING (true)
    ';
  END IF;
END
$$;
