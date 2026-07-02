-- Migration: 20260701_enable_realtime_predictions.sql
-- Habilita a tabela predictions para Supabase Realtime (mesmo padrão de games e scores).
-- Necessário para que palpites de outros usuários sejam recebidos instantaneamente
-- via postgres_changes, sem depender de polling.

-- 1. REPLICA IDENTITY FULL para garantir payload.new completo nos eventos UPDATE/DELETE
ALTER TABLE predictions REPLICA IDENTITY FULL;

-- 2. Adiciona predictions à publicação supabase_realtime (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
  END IF;
END $$;
