-- Migração de dados idempotente: move todo o estado pré-grupos para
-- o grupo "Bolão da Ingrisia ABJ", com "Hamon" como admin.
-- Feature: grupos
-- Data: 2026-06-15
--
-- Seguro para rodar múltiplas vezes (idempotente).
--
-- ATENÇÃO — PASSO MANUAL OBRIGATÓRIO ANTES DE APLICAR EM PRODUÇÃO:
-- Rodar manualmente em produção antes desta migration:
--   SELECT id, name FROM profiles WHERE name ILIKE '%hamon%';
-- Confirmar que existe exatamente um profile cujo "name" é exatamente "Hamon"
-- (comparação ILIKE 'Hamon', case-insensitive mas exata, sem variações como
-- "Hamon Vitorino" ou "hamon123"). Se o nome cadastrado for diferente, ajustar
-- a constante 'Hamon' abaixo antes de aplicar. Esta migration FALHA ALTO
-- (RAISE EXCEPTION) se não encontrar o usuário — comportamento intencional.
--
-- ATENÇÃO — ORDEM DE APLICAÇÃO:
-- Esta migration só pode rodar depois de 20260615120000 (groups/group_members)
-- e 20260615120100 (group_id nullable em predictions/scores) terem sido
-- aplicadas com sucesso. Depois desta migration, validar manualmente:
--   SELECT COUNT(*) FROM predictions WHERE group_id IS NULL; -- deve ser 0
--   SELECT COUNT(*) FROM scores      WHERE group_id IS NULL; -- deve ser 0
-- Só então aplicar 20260615120300 (NOT NULL + nova constraint).

DO $$
DECLARE
  v_group_id  uuid;
  v_admin_id  uuid;
BEGIN
  -- 1. Localiza ou cria o grupo "Bolão da Ingrisia ABJ"
  SELECT id INTO v_group_id FROM groups WHERE name = 'Bolão da Ingrisia ABJ' LIMIT 1;

  -- 2. Localiza o usuário "Hamon" em profiles.name (case-insensitive, busca exata por nome)
  SELECT id INTO v_admin_id FROM profiles WHERE name ILIKE 'Hamon' LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuário "Hamon" não encontrado em profiles.name — migração abortada. Verifique o nome exato cadastrado antes de prosseguir.';
  END IF;

  IF v_group_id IS NULL THEN
    -- Token gerado em formato URL-safe (base64 com +/ trocados por -_), para
    -- ficar consistente com o formato base64url gerado pelo backend TypeScript
    -- (generateInviteToken em lib/invite-token.ts) e evitar a pegadinha de
    -- caracteres +/ precisarem de URL-encoding ao montar o link de convite.
    INSERT INTO groups (name, invite_token, created_by)
    VALUES (
      'Bolão da Ingrisia ABJ',
      translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_'),
      v_admin_id
    )
    RETURNING id INTO v_group_id;
  END IF;

  -- 3. Garante que "Hamon" é admin do grupo (idempotente via ON CONFLICT)
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, v_admin_id, 'admin')
  ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin';

  -- 4. Garante membership para TODOS os profiles existentes (idempotente)
  --    Demais usuários entram como 'member'; se algum já existir como admin
  --    (caso de re-execução), o ON CONFLICT preserva o role já atribuído
  --    fazendo DO NOTHING em vez de sobrescrever.
  INSERT INTO group_members (group_id, user_id, role)
  SELECT v_group_id, p.id, 'member'
  FROM profiles p
  WHERE p.id != v_admin_id
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- 5. Backfill de group_id em predictions (apenas linhas ainda sem grupo)
  UPDATE predictions
  SET group_id = v_group_id
  WHERE group_id IS NULL;

  -- 6. Backfill de group_id em scores (apenas linhas ainda sem grupo)
  UPDATE scores
  SET group_id = v_group_id
  WHERE group_id IS NULL;

  RAISE NOTICE 'Migração concluída: grupo % (id=%), admin=%', 'Bolão da Ingrisia ABJ', v_group_id, v_admin_id;
END
$$;
