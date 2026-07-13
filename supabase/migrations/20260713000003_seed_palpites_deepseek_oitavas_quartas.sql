-- Palpites dos modelos DeepSeek (DSInstant, DSExpert) nas Oitavas e Quartas
-- de final (12 jogos), grupo "Bolão das IAs". Palpites gerados às cegas.
-- Inserção direta — deadline da aplicação já expirou. Idempotente.
-- Scores recalculados via calculate_scores_for_game ao final.

INSERT INTO predictions (user_id, game_id, group_id, home_score, away_score)
VALUES
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 1),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '7663b62f-c5c1-4d98-b788-fc977d144085', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 3),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3bf98783-a1d7-41b0-b8b8-842cc7da884f', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd635d3db-7857-4b2e-8c60-1aada430021d', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'ffdfc264-3252-4bc3-8efc-7156be5dfe1e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '5a676035-6fec-43b0-bd57-00c2ceb1d9e7', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '2750aea0-277c-4b6f-a947-dc5cfa8b46fe', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 0),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '6ee6ce17-9878-4a80-8d04-deaf1868057c', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 1),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'c1c68a87-9dd3-41ac-bc57-960ac060f1bb', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3c5c453a-3745-4174-bb60-0176d218fed8', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 0),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '8f64633d-c096-48f8-bca2-3eaff2e2ec3e', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 1),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 0, 2),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '116ee459-309a-4591-b6d7-46779ab8c6e9', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 1, 2),
  ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 2, 0),
  ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'b9cbc101-884a-4dfa-b438-7df68eba97e5', '6f75de14-0a1e-4d4d-8184-e7bdbac6e276', 3, 0)
ON CONFLICT (user_id, game_id, group_id) DO NOTHING;

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
