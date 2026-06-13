-- Migration 009: agenda sync ESPN via pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sincroniza os jogos de hoje e amanhã a cada 2 minutos
SELECT cron.schedule(
  'sync-espn-games',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dyulqyuyjkjmtrgrdkgf.supabase.co/functions/v1/sync-games?days=2',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
