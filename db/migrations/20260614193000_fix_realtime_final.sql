-- Migration: 20260614_fix_realtime_rls_and_identity.sql
-- 1. Garante REPLICA IDENTITY FULL para games e scores (essencial para payload.new completo)
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER TABLE scores REPLICA IDENTITY FULL;

-- 2. Garante que as tabelas estão na publicação supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;

-- 3. Relaxa RLS em scores: permite que todos os autenticados leiam todos os scores.
-- Isso é necessário para que o Realtime envie eventos de mudança em scores para todos os clientes,
-- permitindo que o ranking atualize para todos quando QUALQUER usuário pontua.
-- Os dados de scores (pontos e breakdown) já são tecnicamente públicos via ranking e lista de participantes.

DROP POLICY IF EXISTS "scores_select_own" ON scores;
DROP POLICY IF EXISTS "users can read own scores" ON scores;

CREATE POLICY "Autenticados podem ler todos os scores"
  ON scores FOR SELECT
  TO authenticated
  USING (true);

-- 4. Garante que games também tem política de leitura para todos (já deve ter, mas por segurança)
DROP POLICY IF EXISTS "Autenticados podem ler jogos" ON games;
CREATE POLICY "Autenticados podem ler jogos"
  ON games FOR SELECT
  TO authenticated
  USING (true);
