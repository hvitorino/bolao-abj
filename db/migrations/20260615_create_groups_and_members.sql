-- Migration: cria tabelas groups e group_members (multi-tenancy)
-- Feature: grupos
-- Data: 2026-06-15
--
-- Mudança aditiva: não altera nenhuma tabela existente. Cria a base para
-- isolar predictions/scores por grupo nas próximas migrations desta feature.

CREATE TABLE IF NOT EXISTS groups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  invite_token  text        NOT NULL UNIQUE,
  created_by    uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id   ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id  ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_token      ON groups(invite_token);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Função auxiliar reutilizável: checa membership sem recursão de RLS.
-- SECURITY DEFINER é necessário para que a checagem de RLS de group_members
-- não bloqueie recursivamente a leitura dentro da própria function.
CREATE OR REPLACE FUNCTION is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- groups: SELECT restrito a membros do próprio grupo.
-- A leitura do nome do grupo via invite_token (página pública /convite/[token])
-- não passa por esta policy — é feita via service_role no Route Handler.
CREATE POLICY "groups_select_member"
  ON groups FOR SELECT
  TO authenticated
  USING (is_group_member(id, auth.uid()));

-- groups: INSERT defensivo (criação real é feita via service_role no backend,
-- pois precisa ser atômica com a criação do group_members admin).
CREATE POLICY "groups_insert_own"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- group_members: SELECT restrito a membros do mesmo grupo (permite ver outros
-- participantes do próprio grupo, mas nunca de grupos de terceiros).
CREATE POLICY "group_members_select_member"
  ON group_members FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

-- Sem policy de INSERT/UPDATE/DELETE para `authenticated` em group_members:
-- toda escrita é feita via service_role (criação de grupo, entrada via convite).
