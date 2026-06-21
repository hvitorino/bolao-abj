-- Migration: cria tabela position_snapshots para registro de posições por rodada
-- Necessária para o redesign do perfil: seção SUA CAMPANHA (movimento ▲▼)

CREATE TABLE IF NOT EXISTS position_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_day     date NOT NULL,
  rank_position int  NOT NULL,
  total_points  int  NOT NULL,
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, match_day)
);

CREATE INDEX idx_position_snapshots_group_user
  ON position_snapshots (group_id, user_id, match_day DESC);

ALTER TABLE position_snapshots ENABLE ROW LEVEL SECURITY;

-- Membros do grupo podem ler snapshots do próprio grupo
CREATE POLICY "members can read own group snapshots"
  ON position_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = position_snapshots.group_id
        AND gm.user_id = auth.uid()
    )
  );
