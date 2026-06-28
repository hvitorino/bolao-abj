-- Migration: palpites dos 2 modelos DeepSeek nos 72 jogos da Fase de Grupos
-- Gerado por: DeepSeek (via prompt em prompts/deepseek-palpites-fase-grupos.md)
-- 144 linhas: 72 jogos × 2 modelos

DO $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE name ILIKE '%IAs%' LIMIT 1;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Grupo "Bolão das IAs" não encontrado — migration abortada.';
  END IF;

  INSERT INTO predictions (user_id, game_id, group_id, home_score, away_score)
  VALUES
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '14b27843-f2d5-4042-b04f-5378c55f0c4b', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '14b27843-f2d5-4042-b04f-5378c55f0c4b', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0de17e12-93b3-405e-984e-d01b011696d3', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0de17e12-93b3-405e-984e-d01b011696d3', v_group_id, 2, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '125685ca-adf1-4ac4-82b5-829f45161aba', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '125685ca-adf1-4ac4-82b5-829f45161aba', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '24c2f3a1-f8fc-4c2b-a024-050131c43c90', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '24c2f3a1-f8fc-4c2b-a024-050131c43c90', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'c69f05e3-00c5-4640-beb5-bce1a247df23', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'c69f05e3-00c5-4640-beb5-bce1a247df23', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd45e25c7-adfe-45ff-b34c-5fbe3347da37', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd45e25c7-adfe-45ff-b34c-5fbe3347da37', v_group_id, 2, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'c9a6827d-d666-4917-abc9-7f3e7824a49f', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'c9a6827d-d666-4917-abc9-7f3e7824a49f', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd4bb9faf-35af-4442-bb9d-9a6681037048', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd4bb9faf-35af-4442-bb9d-9a6681037048', v_group_id, 1, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '4b839dfd-0cb3-4ea2-93cb-2491925ef7f0', v_group_id, 4, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '4b839dfd-0cb3-4ea2-93cb-2491925ef7f0', v_group_id, 5, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'bcb27d08-014b-47fe-8171-d40f95e449d7', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'bcb27d08-014b-47fe-8171-d40f95e449d7', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'e5088c40-90a0-466d-b922-cd1ef64a0fe6', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'e5088c40-90a0-466d-b922-cd1ef64a0fe6', v_group_id, 1, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '96a9f340-44a1-4463-bf70-afc1d7e05a79', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '96a9f340-44a1-4463-bf70-afc1d7e05a79', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '050adada-4e49-4828-9c81-a4bc3679fe11', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '050adada-4e49-4828-9c81-a4bc3679fe11', v_group_id, 4, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '65913a94-0ed0-4ff2-8758-24302fab6f0b', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '65913a94-0ed0-4ff2-8758-24302fab6f0b', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '53ad5c10-5f0b-4c42-aa06-e0e100df791a', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '53ad5c10-5f0b-4c42-aa06-e0e100df791a', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '94897c08-5181-4a34-956f-c149eeccf488', v_group_id, 1, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '94897c08-5181-4a34-956f-c149eeccf488', v_group_id, 1, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '83351289-5104-4884-8d6e-6e85dc0371ed', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '83351289-5104-4884-8d6e-6e85dc0371ed', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '929ff580-7db8-4ccd-955f-c44ef91f3f96', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '929ff580-7db8-4ccd-955f-c44ef91f3f96', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '835df7ab-a2e5-41ed-a5fd-4dba1f053bb4', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '835df7ab-a2e5-41ed-a5fd-4dba1f053bb4', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'b115f2d0-4977-4081-9bb0-21319e7b5ef0', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'b115f2d0-4977-4081-9bb0-21319e7b5ef0', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'aa1d6e7d-649f-4e0b-ba37-2d47896ae80f', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'aa1d6e7d-649f-4e0b-ba37-2d47896ae80f', v_group_id, 4, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '76610c2c-860d-449c-bc2d-c172d7a5baee', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '76610c2c-860d-449c-bc2d-c172d7a5baee', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'b7250f6b-9870-4406-91b3-fec17030a2c3', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'b7250f6b-9870-4406-91b3-fec17030a2c3', v_group_id, 2, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '8d02995e-2285-4ae9-b93e-1be0e5fd1315', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '8d02995e-2285-4ae9-b93e-1be0e5fd1315', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '744fc8d1-cc0c-4850-a60f-a2c88644e83f', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '744fc8d1-cc0c-4850-a60f-a2c88644e83f', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '015b6c60-cf81-4cf1-bfc5-76091c9d9b12', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '015b6c60-cf81-4cf1-bfc5-76091c9d9b12', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'e1912c80-882a-48b7-b4a0-54fcec39866c', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'e1912c80-882a-48b7-b4a0-54fcec39866c', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0b3d279f-6887-4c8b-a65c-30cb865ac634', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0b3d279f-6887-4c8b-a65c-30cb865ac634', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '9e5fde5f-2e66-40a5-a388-0bbee4d52024', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '9e5fde5f-2e66-40a5-a388-0bbee4d52024', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0147b610-c7bc-47ff-b4e7-8903280e8aff', v_group_id, 0, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0147b610-c7bc-47ff-b4e7-8903280e8aff', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '7b813459-8cfe-4c87-a763-33475c5a6219', v_group_id, 4, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '7b813459-8cfe-4c87-a763-33475c5a6219', v_group_id, 5, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '17dfe6f4-d22f-4b73-8f79-f9b729c6019f', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '17dfe6f4-d22f-4b73-8f79-f9b729c6019f', v_group_id, 2, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '6f60d6e1-a828-4dbb-8b38-930afbae4920', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '6f60d6e1-a828-4dbb-8b38-930afbae4920', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '1f7067bd-be90-4b1f-88b2-366a8125e50f', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '1f7067bd-be90-4b1f-88b2-366a8125e50f', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'b19b498f-bf0c-4c0a-a231-bf47e253de16', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'b19b498f-bf0c-4c0a-a231-bf47e253de16', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '87e32c7e-fbc9-43a6-aa51-29b702d1eb49', v_group_id, 0, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '87e32c7e-fbc9-43a6-aa51-29b702d1eb49', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '6d8b4bda-ca2c-470b-9719-ecace6491b0c', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '6d8b4bda-ca2c-470b-9719-ecace6491b0c', v_group_id, 4, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'cd4175d5-5c25-4092-8f2b-8ccb920410af', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'cd4175d5-5c25-4092-8f2b-8ccb920410af', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0df7b397-25ca-4c51-87fc-9cbcbf4bef11', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0df7b397-25ca-4c51-87fc-9cbcbf4bef11', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '64f2ac45-17b9-4249-a0fa-55bea09c0086', v_group_id, 0, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '64f2ac45-17b9-4249-a0fa-55bea09c0086', v_group_id, 0, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '18f2dc51-323f-49f5-a0da-b91ceeacaf2c', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '18f2dc51-323f-49f5-a0da-b91ceeacaf2c', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '72c627bb-e80f-4654-9fe5-c46735cfaa20', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '72c627bb-e80f-4654-9fe5-c46735cfaa20', v_group_id, 4, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '71344b97-7dc9-4406-811c-3e5c5329ab3e', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '71344b97-7dc9-4406-811c-3e5c5329ab3e', v_group_id, 2, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '08964492-9cf2-4f3c-86bc-0e42a028dd40', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '08964492-9cf2-4f3c-86bc-0e42a028dd40', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '039f555d-dd0f-4786-a817-2ffb412a3e3c', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '039f555d-dd0f-4786-a817-2ffb412a3e3c', v_group_id, 4, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '5f571ca9-cb4a-4253-9413-8d111c0de299', v_group_id, 3, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '5f571ca9-cb4a-4253-9413-8d111c0de299', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'efc2ebb2-07dd-49b1-87a6-8002f1939267', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'efc2ebb2-07dd-49b1-87a6-8002f1939267', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd8d9827a-5b69-46ce-83cc-da0350fbc07d', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd8d9827a-5b69-46ce-83cc-da0350fbc07d', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0f9464bd-8758-4899-b073-b63574b09b9e', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0f9464bd-8758-4899-b073-b63574b09b9e', v_group_id, 1, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'b4ae5b17-7b23-471d-a623-ed8ab9ce772a', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'b4ae5b17-7b23-471d-a623-ed8ab9ce772a', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd43c1ce8-1e12-4d34-803b-72117373d0e8', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd43c1ce8-1e12-4d34-803b-72117373d0e8', v_group_id, 3, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'ba618bd9-887d-4953-8334-d7e264391642', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'ba618bd9-887d-4953-8334-d7e264391642', v_group_id, 0, 3),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '739a5cf4-b9c7-4fc6-a625-bf5afcc1ad10', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '739a5cf4-b9c7-4fc6-a625-bf5afcc1ad10', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '377907b5-7bfb-4d8a-ba0c-e068714e6b5e', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '377907b5-7bfb-4d8a-ba0c-e068714e6b5e', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'd032fba2-2473-4aeb-919e-6d73c3ae6c14', v_group_id, 0, 3),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'd032fba2-2473-4aeb-919e-6d73c3ae6c14', v_group_id, 0, 3),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3602066e-ef0a-4362-9aed-1b4d56cbc922', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3602066e-ef0a-4362-9aed-1b4d56cbc922', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '7f8d3b66-9e5f-4c5c-9ef5-e521babe8c4f', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '7f8d3b66-9e5f-4c5c-9ef5-e521babe8c4f', v_group_id, 0, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '7a558fdd-7070-4f29-8426-70f3888f3094', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '7a558fdd-7070-4f29-8426-70f3888f3094', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3e093bae-9789-4921-b69c-85574303a0a1', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3e093bae-9789-4921-b69c-85574303a0a1', v_group_id, 1, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '1149b5aa-63f5-4bc2-ab82-db0d696363f6', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '1149b5aa-63f5-4bc2-ab82-db0d696363f6', v_group_id, 1, 1),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3fd43ebd-d0e5-49c2-bb49-34cd6a969409', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3fd43ebd-d0e5-49c2-bb49-34cd6a969409', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '5ed38121-9449-4848-8e1e-0f51a1bcc121', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '5ed38121-9449-4848-8e1e-0f51a1bcc121', v_group_id, 1, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '85cca723-8cdc-4d7a-b8a8-333a06ff763d', v_group_id, 0, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '85cca723-8cdc-4d7a-b8a8-333a06ff763d', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'eff0134b-f286-456a-8306-83ec1349025a', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'eff0134b-f286-456a-8306-83ec1349025a', v_group_id, 0, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '0a58b6ab-4aca-4a2a-81f9-a23eb7046cce', v_group_id, 0, 3),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '0a58b6ab-4aca-4a2a-81f9-a23eb7046cce', v_group_id, 0, 3),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'a9e603f0-2b52-4b25-a6c2-5d0b30479770', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'a9e603f0-2b52-4b25-a6c2-5d0b30479770', v_group_id, 0, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'bcb62e69-3c88-4250-b116-c2f1a769eb23', v_group_id, 2, 0),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'bcb62e69-3c88-4250-b116-c2f1a769eb23', v_group_id, 2, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '3f64e820-6e1d-480a-b83f-3078974c3f3d', v_group_id, 0, 3),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '3f64e820-6e1d-480a-b83f-3078974c3f3d', v_group_id, 0, 4),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'dc85e75d-1565-41a9-b826-a6d51116027f', v_group_id, 1, 2),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'dc85e75d-1565-41a9-b826-a6d51116027f', v_group_id, 1, 2),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '5e041fb8-d92a-4462-b816-5a1dd8e60e4a', v_group_id, 1, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '5e041fb8-d92a-4462-b816-5a1dd8e60e4a', v_group_id, 0, 0),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', '9d641749-a381-473d-91c2-473d39af02ee', v_group_id, 0, 3),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', '9d641749-a381-473d-91c2-473d39af02ee', v_group_id, 0, 4),
  -- DSInstant
    ('520abbd0-3fda-40c0-bd29-5394ec5e2de8', 'ebbb85ed-c23b-4c62-8456-5c8bfbae0770', v_group_id, 2, 1),
  -- DSExpert
    ('9f0dfabf-347f-4264-8ba1-e99874c04e97', 'ebbb85ed-c23b-4c62-8456-5c8bfbae0770', v_group_id, 1, 1)
  ON CONFLICT (user_id, game_id, group_id) DO NOTHING;

  RAISE NOTICE 'Palpites DeepSeek inseridos com sucesso.';
END $$;