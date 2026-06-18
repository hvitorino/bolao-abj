create table mcp_oauth_codes (
  code           text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null default (now() + interval '5 minutes'),
  used           boolean not null default false
);

-- RLS habilitado; nenhuma policy pública criada.
-- Acesso exclusivo via service_role key.
alter table mcp_oauth_codes enable row level security;
