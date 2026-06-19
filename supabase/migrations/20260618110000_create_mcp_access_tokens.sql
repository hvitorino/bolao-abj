create table mcp_access_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- RLS habilitado; nenhuma policy pública criada.
-- Acesso exclusivo via service_role key.
alter table mcp_access_tokens enable row level security;
