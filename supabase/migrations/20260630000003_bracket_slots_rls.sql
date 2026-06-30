-- Migration: RLS policies for bracket_slots
-- Same pattern as games: authenticated users can read, only admins can modify.

ALTER TABLE bracket_slots ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read bracket slots
CREATE POLICY "Autenticados podem ler bracket_slots"
  ON bracket_slots FOR SELECT TO authenticated USING (true);
