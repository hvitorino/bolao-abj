-- Permite leitura anon de predictions para jogos já iniciados ou finalizados.
-- Necessário para que o polling da página pública (/publico/[groupId]/[date])
-- consiga mostrar o breakdown de pontuação sem exigir sessão autenticada.
-- Seguro: palpites só ficam visíveis após o jogo sair do status 'pending'.

DROP POLICY IF EXISTS "predictions_select_anon_public" ON predictions;
CREATE POLICY "predictions_select_anon_public"
  ON predictions FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = predictions.game_id
        AND games.status <> 'pending'
    )
  );
