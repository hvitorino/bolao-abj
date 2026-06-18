-- Migration: create_group_messages
-- Cria a tabela de mensagens do chat do grupo com RLS e publicação no Realtime

CREATE TABLE group_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_messages_group_id   ON group_messages(group_id);
CREATE INDEX idx_group_messages_created_at ON group_messages(group_id, created_at DESC);

-- RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: somente membros do grupo podem ler mensagens
CREATE POLICY "group_messages_select_member"
  ON group_messages FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

-- INSERT: somente membros do grupo podem escrever, e apenas como si mesmos
CREATE POLICY "group_messages_insert_member"
  ON group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id, auth.uid())
  );

-- Habilita publicação no Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
