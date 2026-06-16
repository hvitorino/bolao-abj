-- Migration: cria convites nominais para grupos (group_invites)
-- Feature: convites-nominais
-- Data: 2026-06-16
--
-- Mudança aditiva: não altera nenhuma tabela existente. Convites nominais
-- coexistem com o mecanismo de link reutilizável (groups.invite_token),
-- entregue na feature `grupos`.

CREATE TABLE IF NOT EXISTS group_invites (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invited_user_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by       uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  responded_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_group_invites_group_id        ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_invited_user_id ON group_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_status          ON group_invites(status);

-- Garante, no nível do banco, que nunca existem dois convites `pending`
-- simultâneos para o mesmo par (group_id, invited_user_id). Reconvite após
-- recusa é permitido (gera uma nova linha pending), só não pode haver duas
-- linhas pending ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS group_invites_unique_pending
  ON group_invites (group_id, invited_user_id)
  WHERE status = 'pending';

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- Função auxiliar reutilizável: checa se o usuário é admin do grupo, sem
-- recursão de RLS. Mesmo padrão de is_group_member (feature `grupos`).
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- group_invites: SELECT — admin do grupo vê todos os convites daquele grupo;
-- o próprio convidado vê os convites endereçados a ele, em qualquer grupo.
CREATE POLICY "group_invites_select_admin_or_invitee"
  ON group_invites FOR SELECT
  TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR is_group_admin(group_id, auth.uid())
  );

-- Sem policy de INSERT/UPDATE para `authenticated`: toda escrita (criar
-- convite, aceitar, recusar) é feita via service_role nos Route Handlers,
-- que validam autorização explicitamente em código. Mesma decisão de
-- defesa em profundidade já usada em `grupos` para group_members.

-- Função de busca de usuário a convidar: resolve nome/e-mail para um
-- profile.id. SECURITY DEFINER é necessário para ler auth.users (e-mail),
-- que não é acessível via client autenticado comum. O e-mail nunca é
-- retornado no SELECT — usado apenas na cláusula WHERE para permitir o
-- match, preservando a regra de nunca expor e-mail de terceiros.
CREATE OR REPLACE FUNCTION search_users_to_invite(p_query text, p_exclude_group_id uuid)
RETURNS TABLE (
  id    uuid,
  name  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.name
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE (
    p.name ILIKE '%' || p_query || '%'
    OR u.email ILIKE '%' || p_query || '%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = p_exclude_group_id AND gm.user_id = p.id
  )
  ORDER BY p.name ASC
  LIMIT 10;
$$;
