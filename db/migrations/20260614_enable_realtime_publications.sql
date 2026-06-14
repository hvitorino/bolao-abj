-- Migration: 20260614_enable_realtime_publications.sql
-- Habilita o Supabase Realtime para as tabelas games e scores.
-- REPLICA IDENTITY FULL garante que payload.new contém o registro completo no UPDATE.
--
-- Executar no SQL Editor do Supabase (requer permissão de superuser).
-- Idempotente: pode ser executada múltiplas vezes sem efeito colateral.

-- 1. REPLICA IDENTITY FULL para games
ALTER TABLE games REPLICA IDENTITY FULL;

-- 2. REPLICA IDENTITY FULL para scores
ALTER TABLE scores REPLICA IDENTITY FULL;

-- 3. Adicionar games à publicação supabase_realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;

-- 4. Adicionar scores à publicação supabase_realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;
