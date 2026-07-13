-- Palpites dos modelos Gemini (GPro31, GFlash3, GPro25, GLite31, GFlash35)
-- nas Oitavas e Quartas de final (12 jogos), grupo "Bolão das IAs".
-- Palpites gerados às cegas por cada modelo (subagentes isolados, sem ver os
-- resultados reais). Inserção direta — deadline da aplicação já expirou.
-- Idempotente: ON CONFLICT DO NOTHING. Scores recalculados via
-- calculate_scores_for_game ao final.

INSERT INTO predictions (user_id, game_id, group_id, home_score, away_score)
VALUES
  -- GPro31 (4b5f4b1c-021f-4f03-8690-cfbfd1f01713)
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 0),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('4b5f4b1c-021f-4f03-8690-cfbfd1f01713', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),

  -- GFlash3 (bbeb85a4-ca27-427d-b611-7fa76c0c7825)
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 3),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('bbeb85a4-ca27-427d-b611-7fa76c0c7825', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),

  -- GPro25 (98e26fdf-8e66-4e14-b138-5d0ec6989613)
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 1),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 1),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 0),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 3),
  ('98e26fdf-8e66-4e14-b138-5d0ec6989613', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 0),

  -- GLite31 (b35ba696-9d1f-4aff-8cee-79e2c66050d1)
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('b35ba696-9d1f-4aff-8cee-79e2c66050d1', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),

  -- GFlash35 (8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e)
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 0),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 2),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 1),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 0),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 1),
  ('8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1)
ON CONFLICT (user_id, game_id, group_id) DO NOTHING;

-- Recalcula os scores dos 12 jogos (já finished) agora que há novos palpites.
DO $$
DECLARE g uuid;
BEGIN
  FOR g IN SELECT unnest(ARRAY[
    '7663b62f-c5c1-4d98-b788-fc977d144085'::uuid,
    '3bf98783-a1d7-41b0-b8b8-842cc7da884f'::uuid,
    'd635d3db-7857-4b2e-8c60-1aada430021d'::uuid,
    'ffdfc264-3252-4bc3-8efc-7156be5dfe1e'::uuid,
    '5a676035-6fec-43b0-bd57-00c2ceb1d9e7'::uuid,
    '2750aea0-277c-4b6f-a947-dc5cfa8b46fe'::uuid,
    '6ee6ce17-9878-4a80-8d04-deaf1868057c'::uuid,
    'c1c68a87-9dd3-41ac-bc57-960ac060f1bb'::uuid,
    '3c5c453a-3745-4174-bb60-0176d218fed8'::uuid,
    '8f64633d-c096-48f8-bca2-3eaff2e2ec3e'::uuid,
    '116ee459-309a-4591-b6d7-46779ab8c6e9'::uuid,
    'b9cbc101-884a-4dfa-b438-7df68eba97e5'::uuid
  ]) LOOP
    PERFORM calculate_scores_for_game(g);
  END LOOP;
END $$;
