-- Tabela para armazenar tokens de integração com serviços externos.
-- O agente cloud lê o JWT do bolaodefutebol.com em tempo real usando a service_role key.
CREATE TABLE IF NOT EXISTS integration_tokens (
  id          TEXT        PRIMARY KEY,
  token       TEXT        NOT NULL,
  notes       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sem políticas públicas: apenas service_role acessa esta tabela
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
