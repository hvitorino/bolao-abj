-- Migração: cria 10 contas fictícias de modelos de IA e as adiciona ao
-- grupo "Bolão das IAs". Idempotente (ON CONFLICT DO NOTHING em todos os inserts).
--
-- Participantes Claude / DeepSeek: nomes fornecidos pelo usuário
-- Participantes Gemini: nomes criados seguindo padrão de abreviação
--   G + descritor do modelo (ex: GPro31 = Gemini 3.1 Pro Preview)

DO $$
DECLARE
  v_group_id  uuid;

  -- UUIDs fixos — nunca alterar, garante idempotência
  v_csonnet   uuid := '0cc1dea9-d928-4eab-ac48-1a9e941cb9ee';
  v_copus     uuid := 'c0d01db4-ac58-439d-a39e-76eb05b98817';
  v_chaiku    uuid := '7d583ff5-d6bd-4319-b5dd-350b47514964';
  v_dsinstant uuid := '520abbd0-3fda-40c0-bd29-5394ec5e2de8';
  v_dsexpert  uuid := '9f0dfabf-347f-4264-8ba1-e99874c04e97';
  v_gpro31    uuid := '4b5f4b1c-021f-4f03-8690-cfbfd1f01713';
  v_gflash3   uuid := 'bbeb85a4-ca27-427d-b611-7fa76c0c7825';
  v_gpro25    uuid := '98e26fdf-8e66-4e14-b138-5d0ec6989613';
  v_glite31   uuid := 'b35ba696-9d1f-4aff-8cee-79e2c66050d1';
  v_gflash35  uuid := '8cd9f1e4-aaf0-4b2d-8e08-c58b4850055e';

BEGIN
  -- 1. Localiza o grupo (tolerante a variações de acento)
  SELECT id INTO v_group_id FROM groups WHERE name ILIKE '%IAs%' LIMIT 1;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Grupo "Bolão das IAs" não encontrado — migration abortada.';
  END IF;

  -- 2. Cria os fake users em auth.users
  --    O trigger on_auth_user_created dispara e cria os profiles automaticamente,
  --    lendo profiles.name a partir de raw_user_meta_data->>'name'.
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) VALUES
    (v_csonnet,   'authenticated', 'authenticated', 'csonnet@bolao.ai',   '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"CSonnet"}',   false),
    (v_copus,     'authenticated', 'authenticated', 'copus@bolao.ai',     '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"COpus"}',     false),
    (v_chaiku,    'authenticated', 'authenticated', 'chaiku@bolao.ai',    '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"CHaiku"}',    false),
    (v_dsinstant, 'authenticated', 'authenticated', 'dsinstant@bolao.ai', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"DSInstant"}', false),
    (v_dsexpert,  'authenticated', 'authenticated', 'dsexpert@bolao.ai',  '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"DSExpert"}',  false),
    (v_gpro31,    'authenticated', 'authenticated', 'gpro31@bolao.ai',    '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"GPro31"}',    false),
    (v_gflash3,   'authenticated', 'authenticated', 'gflash3@bolao.ai',   '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"GFlash3"}',   false),
    (v_gpro25,    'authenticated', 'authenticated', 'gpro25@bolao.ai',    '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"GPro25"}',    false),
    (v_glite31,   'authenticated', 'authenticated', 'glite31@bolao.ai',   '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"GLite31"}',   false),
    (v_gflash35,  'authenticated', 'authenticated', 'gflash35@bolao.ai',  '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"GFlash35"}',  false)
  ON CONFLICT (id) DO NOTHING;

  -- 3. Adiciona todos ao grupo como membros
  INSERT INTO group_members (group_id, user_id, role)
  SELECT v_group_id, u, 'member'
  FROM unnest(ARRAY[
    v_csonnet, v_copus, v_chaiku, v_dsinstant, v_dsexpert,
    v_gpro31, v_gflash3, v_gpro25, v_glite31, v_gflash35
  ]) AS u
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RAISE NOTICE 'Participantes IAs adicionados ao grupo % (id=%)', 'Bolão das IAs', v_group_id;
END $$;
