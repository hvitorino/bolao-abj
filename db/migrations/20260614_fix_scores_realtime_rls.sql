-- Migration: 20260614_fix_scores_realtime_rls.sql
-- Garante que o usuário autenticado pode ler seus próprios scores via Supabase Realtime.
--
-- Sem esta política, o canal Realtime pode ser bloqueado pelo RLS antes de entregar
-- eventos de INSERT/UPDATE na tabela scores ao cliente, mesmo com filtro por game_id.
--
-- Executar no SQL Editor do Supabase após 20260614_enable_realtime_publications.sql.
-- Idempotente: usa CREATE POLICY IF NOT EXISTS para evitar erro em re-execuções.

-- Política de SELECT: usuário autenticado pode ler seus próprios scores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scores' AND policyname = 'users can read own scores'
  ) THEN
    CREATE POLICY "users can read own scores"
    ON scores FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;
