-- Migration: torna group_id obrigatório em predictions/scores e substitui
-- a constraint de unicidade antiga por UNIQUE(user_id, game_id, group_id).
-- Feature: grupos
-- Data: 2026-06-15
--
-- ATENÇÃO — PRÉ-REQUISITO OBRIGATÓRIO ANTES DE APLICAR EM PRODUÇÃO:
-- Esta migration só pode ser aplicada depois que 20260615120200
-- (seed_bolao_ingrisia_group) tiver sido aplicada com sucesso E confirmado,
-- via query manual, que não há mais linhas órfãs:
--   SELECT COUNT(*) FROM predictions WHERE group_id IS NULL; -- deve retornar 0
--   SELECT COUNT(*) FROM scores      WHERE group_id IS NULL; -- deve retornar 0
-- Se qualquer uma das contagens for > 0, NÃO aplicar esta migration — investigar
-- a causa (ex: nova prediction criada entre o backfill e este passo, ver Risco 2
-- da spec) antes de prosseguir.
--
-- ATENÇÃO — NOME DA CONSTRAINT ANTIGA:
-- O DROP CONSTRAINT abaixo assume o nome convencional gerado automaticamente
-- pelo Postgres para UNIQUE(user_id, game_id) em predictions
-- (predictions_user_id_game_id_key, conforme criado em
-- 20260613000003_create_predictions.sql, sem nome explícito). Antes de aplicar
-- em produção, confirmar o nome exato rodando:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'predictions'::regclass AND contype = 'u';
-- Se o nome retornado for diferente, ajustar o DROP CONSTRAINT abaixo antes de
-- aplicar. O IF EXISTS evita erro caso o nome já tenha sido corrigido/já não exista.

ALTER TABLE predictions ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE scores      ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_game_id_key;

ALTER TABLE predictions
  ADD CONSTRAINT predictions_user_game_group_unique UNIQUE(user_id, game_id, group_id);
