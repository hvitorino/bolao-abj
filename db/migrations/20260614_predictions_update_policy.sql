-- Migration: Adiciona política UPDATE para edição de palpites
-- Data: 2026-06-14
-- Feature: predictions-edit

-- Policy: usuário autenticado atualiza apenas seus próprios palpites
CREATE POLICY "predictions_update_own"
  ON predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
