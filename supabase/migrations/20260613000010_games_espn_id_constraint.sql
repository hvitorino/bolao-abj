-- Migration 010: substitui índice parcial por UNIQUE constraint completa
-- O índice parcial (WHERE espn_id IS NOT NULL) não é compatível com
-- ON CONFLICT (espn_id) usado pelo Supabase JS client no upsert.
-- PostgreSQL permite múltiplos NULLs em colunas UNIQUE, então é seguro.
DROP INDEX IF EXISTS games_espn_id_idx;
ALTER TABLE games ADD CONSTRAINT games_espn_id_unique UNIQUE (espn_id);
