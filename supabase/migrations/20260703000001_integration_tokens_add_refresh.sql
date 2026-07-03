ALTER TABLE integration_tokens
  ADD COLUMN IF NOT EXISTS refresh_token TEXT;
