# Spec: Grupos Privados (Bolões Isolados)

**Slug:** grupos
**Data:** 2026-06-15
**Status:** spec

---

## Objetivo

Permitir que usuários criem grupos (bolões) privados e convidem participantes via link reutilizável. Cada grupo é totalmente isolado — ranking, participantes e palpites próprios — e o usuário só visualiza pontuação/ranking/participantes/palpites dos grupos dos quais participa. Um mesmo usuário pode pertencer a múltiplos grupos simultaneamente, com palpites independentes por grupo para o mesmo jogo, e pontuação/ranking calculados de forma isolada por grupo.

Esta é uma mudança estrutural de multi-tenancy introduzida sobre um sistema já em produção, com usuários e dados reais. Toda a spec foi desenhada para minimizar janela de risco: a migration de schema é aditiva sempre que possível, e o script de dados (idempotente) move o estado atual para um grupo "guarda-chuva" antes de qualquer constraint que dependeria de `group_id` ser aplicada.

**Fora de escopo nesta feature:**
- Remover/banir membro de um grupo (apenas entrar é suportado; sair/remover fica para feature futura)
- Múltiplos admins por grupo ou transferência de admin
- Convite por e-mail/notificação push (o convite é só o link reutilizável copiável)
- Edição de nome/configurações do grupo após criação
- `games` deixar de ser global — **confirmado nesta spec: `games` permanece global e compartilhado entre todos os grupos** (são os jogos oficiais da Copa 2026, dados objetivos, não pertencem a nenhum grupo). Apenas `predictions` e `scores` passam a ser escopados por grupo.
- O endpoint admin `PATCH /api/admin/update-game/[gameId]` (atualização de placar/status protegida por `X-Admin-Secret`) **não muda nesta feature** — `games` é global, então atualizar um jogo continua sendo uma operação única que afeta todos os grupos igualmente (cada grupo recalcula sua própria pontuação para aquele jogo via trigger, ver seção Trigger).

**Nota sobre a stack real do backend:** o `CLAUDE.md` descreve o backend como "Ruby 3.x/Sinatra — Vercel Serverless Functions (`@vercel/ruby`)", e esse padrão ainda existe para dois endpoints legados (`api/scores/calculate.rb`, que hoje na prática não é mais chamado pelo fluxo principal). Na prática, todos os endpoints ativos e usados pelo frontend hoje (`predictions`, `predictions/[id]`, `ranking`, `games`, `admin/update-game/[gameId]`, `admin/sync-games`) já são **Next.js Route Handlers em TypeScript** (`app/api/**/route.ts`), confirmado lendo o código-fonte atual. Esta spec segue a implementação real: todos os endpoints novos desta feature são Route Handlers TypeScript em `app/api/groups/**`, consistentes com o padrão já estabelecido pelo projeto desde a feature `ranking`/`predictions-edit`. Não há necessidade de criar novos arquivos `.rb`.

---

## Histórias de Usuário

- Como usuário autenticado, quero criar um novo grupo (bolão) informando um nome, para organizar um bolão privado com um conjunto específico de amigos.
- Como criador de um grupo, quero me tornar automaticamente seu admin, para poder gerenciar o convite sem precisar de uma etapa extra de promoção.
- Como admin de um grupo, quero obter um link de convite reutilizável, para compartilhar com quantas pessoas eu quiser sem gerar um link por pessoa.
- Como usuário (novo ou já cadastrado), quero abrir um link de convite e entrar automaticamente no grupo correspondente, para participar do bolão sem fricção.
- Como usuário, quero ver a lista dos grupos dos quais participo, para escolher em qual quero navegar.
- Como usuário em múltiplos grupos, quero selecionar um "grupo ativo" e ter as telas de jogos/palpites/ranking refletirem apenas aquele grupo, para não confundir pontuação e palpites entre bolões diferentes.
- Como usuário em múltiplos grupos, quero poder dar palpites diferentes para o mesmo jogo em grupos diferentes, para participar de bolões com regras de grupo distintas (ex: grupo da família vs. grupo do trabalho) sem que um palpite "vaze" para o outro.
- Como usuário, quero ter certeza de que não vejo ranking, participantes ou palpites de grupos aos quais não pertenço, para preservar a privacidade de cada bolão.

---

## Modelo de Dados

### Visão geral das tabelas novas

```sql
-- Grupos (bolões privados/isolados)
groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  invite_token  text NOT NULL UNIQUE,   -- token opaco para o link de convite reutilizável
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
)

-- Membership: associação usuário <-> grupo, com role
group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
)
```

### Tabelas modificadas

```sql
-- predictions: adiciona group_id, troca a constraint UNIQUE
predictions (
  id            uuid PK,
  user_id       uuid FK profiles,
  game_id       uuid FK games,
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,  -- NOVO
  home_score    int NOT NULL,
  away_score    int NOT NULL,
  submitted_at  timestamptz,
  UNIQUE(user_id, game_id, group_id)  -- SUBSTITUI UNIQUE(user_id, game_id)
)

-- scores: adiciona group_id
scores (
  id             uuid PK,
  user_id        uuid FK profiles,
  game_id        uuid FK games,
  group_id       uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,  -- NOVO
  prediction_id  uuid FK predictions,
  points         int NOT NULL DEFAULT 0,
  breakdown      jsonb,
  calculated_at  timestamptz,
  UNIQUE(prediction_id)  -- mantido; prediction_id já é único por (user,game,group) indiretamente
)
```

`games` e `profiles` **não recebem `group_id`** — permanecem tabelas globais, conforme decisão de escopo acima.

### Por que `UNIQUE(prediction_id)` em `scores` continua suficiente

Como `predictions` agora é única por `(user_id, game_id, group_id)`, cada `prediction_id` já representa inequivocamente um palpite de um usuário, para um jogo, dentro de um grupo específico. Um score sempre referencia exatamente um `prediction_id`, então `UNIQUE(prediction_id)` em `scores` continua garantindo um score por palpite — e como o palpite já é escopado por grupo, o score herda esse escopo transitivamente via `prediction_id`. A coluna `group_id` é adicionada em `scores` mesmo assim (denormalizada) para permitir queries diretas de agregação por grupo sem precisar fazer JOIN com `predictions` toda vez (usada pelo RPC de ranking e pelos hooks de live-scoring) — é uma decisão de performance/simplicidade de query, não uma necessidade de integridade adicional.

### Migrations necessárias

Todas em `supabase/migrations/`, seguindo a convenção de timestamp `YYYYMMDDHHMMSS_descricao.sql` já usada pelo projeto (ver `20260614191000_fix_prediction_visibility_policy.sql` como exemplo de timestamp com hora). Espelhar também em `db/migrations/` com o padrão `YYYYMMDD_descricao.sql`, já que o projeto mantém as duas pastas em paralelo (confirmado lendo o estado atual do repositório — ambas existem e ambas têm migrations equivalentes para todas as features anteriores).

1. **`20260615120000_create_groups_and_members.sql`**
   - `CREATE TABLE groups (...)`
   - `CREATE TABLE group_members (...)`
   - Índices: `idx_group_members_user_id ON group_members(user_id)`, `idx_group_members_group_id ON group_members(group_id)`, `idx_groups_invite_token ON groups(invite_token)` (já implícito por `UNIQUE`, mas explicitar para clareza de leitura)
   - RLS habilitado em ambas (ver seção RLS)

2. **`20260615120100_add_group_id_to_predictions_and_scores.sql`**
   - `ALTER TABLE predictions ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE CASCADE` — **nullable nesta etapa** (não pode ser `NOT NULL` ainda, pois há linhas existentes sem grupo)
   - `ALTER TABLE scores ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE CASCADE` — nullable também
   - **Não** remover a constraint antiga `UNIQUE(user_id, game_id)` nesta migration — isso é feito só depois que o backfill (migration 4) garantir que toda linha tem `group_id` preenchido. Remover a constraint antiga antes do backfill quebraria a garantia de unicidade durante a janela de transição.
   - Índices: `idx_predictions_group_id ON predictions(group_id)`, `idx_scores_group_id ON scores(group_id)`, `idx_predictions_user_game_group ON predictions(user_id, game_id, group_id)`

3. **`20260615120200_seed_bolao_ingrisia_group.sql`** — script de migração de dados idempotente (ver seção dedicada "Script de Migração de Dados" abaixo). Cria o grupo "Bolão da Ingrisia ABJ", define "Hamon" como admin, cria memberships para todos os profiles existentes, e faz `UPDATE` em todas as linhas de `predictions`/`scores` existentes para preencher `group_id`.

4. **`20260615120300_enforce_group_id_not_null.sql`** — **só roda depois que a migration 3 já tiver sido aplicada com sucesso em produção** (ver ordem de execução abaixo):
   - `ALTER TABLE predictions ALTER COLUMN group_id SET NOT NULL`
   - `ALTER TABLE scores ALTER COLUMN group_id SET NOT NULL`
   - `ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_game_id_key` (nome exato da constraint antiga deve ser confirmado via `\d predictions` no Supabase antes de aplicar — pode ter nome gerado automaticamente diferente; usar `SELECT conname FROM pg_constraint WHERE conrelid = 'predictions'::regclass AND contype = 'u'` para localizar)
   - `ALTER TABLE predictions ADD CONSTRAINT predictions_user_game_group_unique UNIQUE(user_id, game_id, group_id)`

5. **`20260615120400_group_scoped_rls.sql`** — substitui todas as policies de `predictions`/`scores` por versões escopadas por `group_members` (ver seção RLS completa abaixo).

6. **`20260615120500_group_scoped_scoring_trigger.sql`** — substitui `calculate_scores_for_game(uuid)` e `trigger_calculate_scores()` pela versão por grupo (ver seção Trigger).

7. **`20260615120600_get_ranking_by_group.sql`** — substitui `get_ranking()` por `get_ranking(p_group_id uuid)` (ver seção Ranking).

**Ordem de execução obrigatória em produção:** 1 → 2 → 3 → validar manualmente (ver seção Riscos) → 4 → 5 → 6 → 7. As migrations 1, 2, 5, 6, 7 podem ser aplicadas em sequência rápida (não dependem de dados), mas a 4 **não pode rodar antes da 3 ter sido confirmada com sucesso e sem linhas órfãs** (`group_id IS NULL`).

---

## Algoritmo de Convite

### Geração do token

- Campo `groups.invite_token text NOT NULL UNIQUE`.
- Gerado no momento da criação do grupo (não em request separado), usando 24 bytes aleatórios criptograficamente seguros, codificados em base64url (sem padding), resultando em uma string de 32 caracteres (`[A-Za-z0-9_-]`), ex: `k3F9pQ7xN2bV8mZcL1tR4sJdY6wA0eHu`.
- Implementação no backend (Node/TypeScript, dentro do Route Handler `POST /api/groups`):
  ```ts
  import { randomBytes } from 'crypto'

  function generateInviteToken(): string {
    return randomBytes(24).toString('base64url') // 32 chars, sem caracteres ambíguos de URL
  }
  ```
- Colisão: como `invite_token` é `UNIQUE`, em caso (extremamente improvável) de colisão o `INSERT` falha com `23505`; o Route Handler deve capturar esse código e tentar gerar um novo token uma única vez antes de desistir com erro 500. Não é necessário retry loop — a probabilidade de colisão com 24 bytes de entropia é desprezível para o volume esperado (um pequeno grupo de amigos, dezenas de grupos no máximo).
- O token **nunca é regenerado automaticamente**. Não há endpoint de "revogar/regenerar convite" nesta feature (fora de escopo — ver seção Objetivo).

### Formato e resolução do link

- Link de convite: `https://<dominio-do-app>/convite/<invite_token>` — rota pública (não requer autenticação prévia para **visualizar**, mas requer login para **efetivar a entrada** no grupo, ver fluxo abaixo).
- Resolução: a página `/convite/[token]` busca `SELECT id, name FROM groups WHERE invite_token = :token`. Se não encontrado, exibe estado de erro "convite inválido". Se encontrado, exibe nome do grupo e botão de ação.
- O token **não expira** e é **reutilizável por qualquer número de pessoas** — qualquer um com o link pode entrar, conforme decisão de negócio já validada. Não há contagem de usos nem lista de convidados específicos.

### Fluxo de entrada via convite

1. Usuário acessa `/convite/<token>` (rota pública, fora do grupo `(dashboard)`).
2. **Se não autenticado:** a página exibe o nome do grupo e um CTA "Entrar / Cadastrar para participar", que redireciona para `/login?redirect=/convite/<token>` (ou `/cadastro?redirect=/convite/<token>`). Após login/cadastro bem-sucedido, o usuário é redirecionado de volta para `/convite/<token>` para concluir a entrada.
3. **Se autenticado:** a página exibe o nome do grupo e um botão "ENTRAR NO GRUPO". Ao clicar, chama `POST /api/groups/join` com `{ invite_token }`.
4. O backend resolve `invite_token → group_id`, verifica se já existe membership (`group_members` com `user_id` + `group_id`):
   - Se já é membro: retorna sucesso idempotente (200, sem duplicar `group_members`), e o frontend redireciona direto para `/jogos?group=<group_id>` (ou equivalente, ver seção "Grupo Ativo").
   - Se não é membro: insere `group_members(group_id, user_id, role='member')`, retorna 201, e o frontend redireciona para `/jogos` com o novo grupo já marcado como ativo.
5. Usuário nunca pode entrar como `admin` via convite — `role` é sempre `'member'` para quem entra por este fluxo. Apenas o criador do grupo (`POST /api/groups`) recebe `role='admin'` automaticamente.

### Exibição do link ao admin

- Na tela "Detalhes do Grupo" (`/grupos/[id]`, ver seção Frontend), se o usuário logado for admin daquele grupo, exibir um card com o link completo (`https://<dominio>/convite/<token>`) e um botão "COPIAR LINK" (usa `navigator.clipboard.writeText`).
- Membros não-admin **não veem** o link de convite na tela de detalhes (apenas o admin pode compartilhar) — isso é uma decisão de UX razoável dado que o token é reutilizável e sensível (qualquer detentor do link entra no grupo); não há requisito explícito do PM sobre esconder de não-admins, mas como medida de defesa em profundidade mínima, a spec define que o card do link só renderiza quando `role === 'admin'`. Se o Programador julgar necessário expor para todos os membros (já que tecnicamente todos poderiam reconstruir o link sabendo o `group_id`... o que não é o caso, pois o token não é derivável do `group_id`), isso pode ser revisto, mas o padrão desta spec é **somente admin vê o link**.

---

## RLS (Row Level Security)

### Função auxiliar reutilizável

Para evitar repetir a subquery `EXISTS (SELECT 1 FROM group_members WHERE ...)` em todas as policies, criar uma função `SECURITY DEFINER` auxiliar:

```sql
CREATE OR REPLACE FUNCTION is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;
```

`SECURITY DEFINER` é necessário para que a própria checagem de RLS de `group_members` não recursivamente bloqueie a leitura dentro da function (a function roda com privilégios do dono, ignorando RLS de `group_members` internamente, mas só é usada para a checagem booleana — não expõe dados).

### `groups`

- `SELECT`: usuário autenticado só pode ler grupos dos quais é membro: `USING (is_group_member(id, auth.uid()))`.
  - Exceção: a leitura do nome do grupo a partir do token de convite (página pública `/convite/[token]`) **não passa por este RLS** — é feita via Route Handler com `service_role` (igual ao padrão já usado em `app/api/ranking/route.ts`), pois um usuário ainda não-membro precisa ver o nome do grupo antes de entrar.
- `INSERT`: qualquer usuário autenticado pode criar grupo, mas `created_by` deve ser o próprio `auth.uid()`: `WITH CHECK (created_by = auth.uid())`. Na prática, o `INSERT` de criação de grupo é feito via Route Handler com `service_role` (porque a criação do grupo e a criação do `group_members` admin precisam ser atômicas — ver seção Backend), então esta policy serve principalmente como defesa em profundidade caso algum client-side insert direto seja tentado no futuro.
- `UPDATE`/`DELETE`: nenhuma policy para usuários comuns nesta feature (edição/exclusão de grupo é fora de escopo).

### `group_members`

- `SELECT`: usuário autenticado só pode ler memberships de grupos dos quais ele próprio é membro: `USING (is_group_member(group_id, auth.uid()))`. Isso permite que um membro veja a lista de outros participantes do mesmo grupo (necessário para a tela de participantes/ranking), mas não veja membros de grupos de terceiros.
- `INSERT`: feito exclusivamente via Route Handler com `service_role` (fluxo de criação de grupo e fluxo de entrada via convite, ambos descritos acima) — sem policy de `INSERT` para `authenticated` (bloqueado por padrão quando RLS está ativo e não há policy permissiva).
- `UPDATE`/`DELETE`: nenhuma policy (mudar role ou remover membro é fora de escopo nesta feature).

### `predictions`

Substituir a policy atual (`predictions_select_started_or_own`, da feature `fix-prediction-visibility`) por uma versão que combina a regra temporal **e** a regra de grupo:

```sql
DROP POLICY IF EXISTS "predictions_select_started_or_own" ON predictions;
DROP POLICY IF EXISTS "predictions_select_all_authenticated" ON predictions;

CREATE POLICY "predictions_select_group_scoped"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    is_group_member(group_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM games
        WHERE games.id = predictions.game_id
          AND games.status <> 'pending'
      )
    )
  );
```

Ou seja: a regra temporal de `fix-prediction-visibility` (próprio palpite sempre visível; palpite de terceiros só após o jogo deixar `pending`) **permanece exatamente igual**, mas agora com a condição adicional obrigatória de que o usuário precisa ser membro do `group_id` daquela linha. Um usuário fora do grupo nunca vê nenhum palpite daquele grupo, independente do status do jogo.

`INSERT`/`UPDATE` de predictions continuam feitos via Route Handler com `service_role` (padrão já existente em `app/api/predictions/route.ts` e `app/api/predictions/[id]/route.ts`) — o Route Handler passa a validar explicitamente que `user_id` é membro de `group_id` antes de inserir (ver seção Backend), então não é estritamente necessário ter policy de `INSERT`/`UPDATE` para `authenticated` (já não existia antes desta feature).

### `scores`

```sql
DROP POLICY IF EXISTS "scores_select_all_authenticated" ON scores;

CREATE POLICY "scores_select_group_scoped"
  ON scores FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));
```

Scores não têm a regra temporal de `predictions` (a pontuação só existe depois que o jogo termina e o trigger populou `scores`, então não há "vazamento antecipado" possível) — apenas a regra de grupo.

### `profiles`

**Sem alteração de RLS.** A policy `profiles_select_all_authenticated` (`USING (true)`) permanece como está. `profiles` continua sendo uma tabela global de perfis — saber que um usuário existe e seu nome não é informação sensível por grupo (o nome de alguém aparece em qualquer grupo do qual ele é membro, mas a lista de "quem está em qual grupo" já é protegida via `group_members`). Não há necessidade de restringir leitura de `profiles` por grupo: o que precisa ser protegido é "quais grupos existem e quem está neles e o que cada um palpitou", não "este nome existe no sistema".

### `games`

**Sem alteração de RLS.** `games` permanece global, lido por todos os autenticados, sem relação com `group_members`.

---

## Trigger de Cálculo de Scores (por grupo)

A função `calculate_scores_for_game(p_game_id uuid)` (criada na feature `scoring`, corrigida na `fix-goleada-scoring`) hoje itera `SELECT * FROM predictions WHERE game_id = p_game_id` e gera **um score por usuário**. Ela precisa passar a gerar **um score por (usuário, grupo)** — ou seja, iterar sobre todas as predictions daquele jogo (que já carregam `group_id`), sem agrupamento adicional, pois cada `prediction` já é única por `(user_id, game_id, group_id)`.

```sql
CREATE OR REPLACE FUNCTION calculate_scores_for_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game        games%ROWTYPE;
  v_pred        predictions%ROWTYPE;
  v_winner_pts  int;
  v_exact_pts   int;
  v_ws_pts      int;
  v_diff_pts    int;
  v_loser_pts   int;
  v_goleada_pts int;
  v_total       int;
  v_breakdown   jsonb;
  v_real_diff   int;
  v_pred_diff   int;
  v_real_winner text;
  v_pred_winner text;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.home_score IS NULL OR v_game.away_score IS NULL THEN
    RETURN;
  END IF;

  IF v_game.home_score > v_game.away_score THEN
    v_real_winner := 'home';
  ELSIF v_game.away_score > v_game.home_score THEN
    v_real_winner := 'away';
  ELSE
    v_real_winner := 'draw';
  END IF;

  -- Itera sobre TODAS as predictions do jogo, em TODOS os grupos —
  -- cada prediction já é única por (user_id, game_id, group_id), então
  -- não há necessidade de agrupar; o loop simplesmente carrega group_id
  -- de cada prediction e o repassa para o score correspondente.
  FOR v_pred IN SELECT * FROM predictions WHERE game_id = p_game_id LOOP
    v_winner_pts  := 0;
    v_exact_pts   := 0;
    v_ws_pts      := 0;
    v_diff_pts    := 0;
    v_loser_pts   := 0;
    v_goleada_pts := 0;

    IF v_pred.home_score > v_pred.away_score THEN
      v_pred_winner := 'home';
    ELSIF v_pred.away_score > v_pred.home_score THEN
      v_pred_winner := 'away';
    ELSE
      v_pred_winner := 'draw';
    END IF;

    IF v_pred_winner = v_real_winner THEN
      v_winner_pts := 3;

      IF v_pred.home_score = v_game.home_score AND v_pred.away_score = v_game.away_score THEN
        v_exact_pts := 5;
      ELSE
        IF v_real_winner != 'draw' THEN
          IF v_real_winner = 'home' AND v_pred.home_score = v_game.home_score THEN
            v_ws_pts := 3;
          ELSIF v_real_winner = 'away' AND v_pred.away_score = v_game.away_score THEN
            v_ws_pts := 3;
          END IF;
        END IF;

        IF v_real_winner != 'draw' THEN
          v_real_diff := ABS(v_game.home_score - v_game.away_score);
          v_pred_diff := ABS(v_pred.home_score - v_pred.away_score);
          IF v_pred_diff = v_real_diff THEN
            v_diff_pts := 2;
          END IF;
        END IF;
      END IF;

      -- Regra de goleada (versão corrigida: >=4 em ambos os lados)
      IF v_real_winner != 'draw' THEN
        DECLARE
          v_pred_winner_score int := CASE WHEN v_real_winner = 'home' THEN v_pred.home_score ELSE v_pred.away_score END;
          v_real_goal_diff    int := ABS(v_game.home_score - v_game.away_score);
        BEGIN
          IF v_pred_winner_score >= 4 AND v_real_goal_diff >= 4 THEN
            v_goleada_pts := 1;
          END IF;
        END;
      END IF;

    ELSE
      IF v_real_winner = 'home' THEN
        IF v_pred.away_score = v_game.away_score THEN
          v_loser_pts := 1;
        END IF;
      ELSIF v_real_winner = 'away' THEN
        IF v_pred.home_score = v_game.home_score THEN
          v_loser_pts := 1;
        END IF;
      END IF;
    END IF;

    v_total := v_winner_pts + v_exact_pts + v_ws_pts + v_diff_pts + v_loser_pts + v_goleada_pts;

    v_breakdown := jsonb_build_object(
      'winner',       v_winner_pts,
      'exact',        v_exact_pts,
      'winner_score', v_ws_pts,
      'diff',         v_diff_pts,
      'loser_score',  v_loser_pts,
      'goleada',      v_goleada_pts
    );

    -- group_id vem diretamente da prediction (v_pred.group_id), preservando o
    -- isolamento: o score gerado pertence ao mesmo grupo do palpite que o originou.
    INSERT INTO scores (user_id, game_id, group_id, prediction_id, points, breakdown, calculated_at)
    VALUES (v_pred.user_id, p_game_id, v_pred.group_id, v_pred.id, v_total, v_breakdown, now())
    ON CONFLICT (prediction_id) DO UPDATE
      SET points        = EXCLUDED.points,
          breakdown     = EXCLUDED.breakdown,
          group_id      = EXCLUDED.group_id,
          calculated_at = EXCLUDED.calculated_at;

  END LOOP;
END;
$$;
```

**Mudança real em relação à versão anterior:** apenas a linha do `INSERT` passa a incluir `group_id` (lido de `v_pred.group_id`, já que `predictions` agora carrega essa coluna). A lógica de pontuação propriamente dita (regras de negócio do CLAUDE.md) **não muda nenhum caractere** — confirmando o critério "nenhuma regressão nas regras de pontuação existentes". O trigger `on_game_finished`/`trigger_calculate_scores()` que dispara esta função **não precisa de nenhuma alteração** — ele já chama `calculate_scores_for_game(NEW.id)` passando apenas o `game_id`, e a função internamente agora lida com múltiplos grupos automaticamente ao iterar todas as predictions daquele jogo (que podem pertencer a grupos diferentes).

**Implicação importante:** como `games` é global, quando um jogo termina, **todo grupo que tiver pelo menos um membro com prediction para aquele jogo** recebe sua própria linha de `scores` (uma por prediction, automaticamente escopada por grupo) — exatamente como pedido no critério de sucesso do PM ("todo grupo que tem ao menos um membro com prediction para aquele jogo").

---

## Backend — Endpoints Next.js (Route Handlers TypeScript)

Seguindo o padrão real do projeto (`app/api/**/route.ts`, autenticação via Bearer JWT validado com `anonClient.auth.getUser(jwt)`, operações de escrita via `service_role` para contornar RLS de forma controlada).

### POST /api/groups

**Autenticação:** requerida (Bearer JWT)
**Body (JSON):**
```json
{ "name": "string" }
```
**Validação:**
- `name`: string não vazia após `trim()`, máximo 60 caracteres. Caso contrário, 422.

**Lógica:**
1. Autentica o usuário (mesmo padrão de `authenticate(request)` já usado em `app/api/predictions/route.ts`).
2. Gera `invite_token` via `generateInviteToken()`.
3. Com `service_client` (`service_role`), executa em sequência (não há transação multi-tabela disponível via REST do Supabase, então a ordem importa — ver nota de atomicidade abaixo):
   - `INSERT INTO groups (name, invite_token, created_by) VALUES (...)` → retorna `id`.
   - `INSERT INTO group_members (group_id, user_id, role) VALUES (group.id, user.id, 'admin')`.
4. **Nota de atomicidade:** se o segundo `INSERT` falhar após o primeiro ter sucesso, o grupo fica "órfão" (sem nenhum admin). Mitigação: se o `INSERT` em `group_members` falhar, o Route Handler deve fazer `DELETE FROM groups WHERE id = group.id` (rollback manual) antes de retornar erro 500. Documentar esse comportamento no código com um comentário explícito.

**Resposta de sucesso (201):**
```json
{ "id": "uuid", "name": "string", "invite_token": "string", "role": "admin" }
```
**Erros possíveis:**
- 401: não autenticado
- 422: `name` ausente, vazio ou maior que 60 caracteres
- 500: erro Supabase (com rollback manual do grupo órfão, se aplicável)

---

### GET /api/groups

**Autenticação:** requerida
**Lógica:** retorna todos os grupos dos quais o usuário autenticado é membro, com o `role` do usuário em cada um.

```sql
SELECT g.id, g.name, g.created_at, gm.role
FROM groups g
JOIN group_members gm ON gm.group_id = g.id
WHERE gm.user_id = :userId
ORDER BY g.created_at ASC
```

**Resposta de sucesso (200):**
```json
[
  { "id": "uuid", "name": "Bolão da Ingrisia ABJ", "role": "admin", "created_at": "2026-06-13T00:00:00Z" },
  { "id": "uuid", "name": "Bolão do Trabalho", "role": "member", "created_at": "2026-06-15T10:00:00Z" }
]
```
**Erros possíveis:**
- 401: não autenticado

---

### GET /api/groups/[id]

**Autenticação:** requerida
**Lógica:** retorna detalhes de um grupo específico, incluindo `invite_token` **somente se o usuário autenticado for membro admin daquele grupo**; se for membro não-admin, retorna os dados sem o campo `invite_token`; se não for membro, 403.

**Resposta de sucesso (200) — admin:**
```json
{ "id": "uuid", "name": "Bolão da Ingrisia ABJ", "role": "admin", "invite_token": "k3F9pQ7xN2bV8mZcL1tR4sJdY6wA0eHu", "member_count": 6 }
```
**Resposta de sucesso (200) — membro não-admin:**
```json
{ "id": "uuid", "name": "Bolão da Ingrisia ABJ", "role": "member", "member_count": 6 }
```
**Erros possíveis:**
- 401: não autenticado
- 403: usuário não é membro deste grupo
- 404: grupo não encontrado

---

### GET /api/groups/resolve-invite?token=\<token\>

**Autenticação:** pública (não requer login — usada pela página `/convite/[token]` antes do usuário logar).
**Lógica:** busca `SELECT id, name FROM groups WHERE invite_token = :token` via `service_client` (contorna RLS, pois um não-membro precisa ver o nome do grupo antes de decidir entrar).

**Resposta de sucesso (200):**
```json
{ "id": "uuid", "name": "Bolão da Ingrisia ABJ" }
```
**Erros possíveis:**
- 400: `token` ausente
- 404: token não corresponde a nenhum grupo

---

### POST /api/groups/join

**Autenticação:** requerida (Bearer JWT)
**Body (JSON):**
```json
{ "invite_token": "string" }
```
**Lógica:**
1. Autentica o usuário.
2. Resolve `invite_token → group_id` via `service_client`. Se não encontrado, 404.
3. Verifica se já existe `group_members` para `(group_id, user_id)`:
   - Se já existe: retorna 200 idempotente com os dados do grupo (sem erro — entrar de novo no mesmo grupo não é um erro).
   - Se não existe: `INSERT INTO group_members (group_id, user_id, role) VALUES (group_id, user.id, 'member')`, retorna 201.

**Resposta de sucesso (200 ou 201):**
```json
{ "group_id": "uuid", "name": "Bolão da Ingrisia ABJ", "role": "member", "already_member": false }
```
**Erros possíveis:**
- 401: não autenticado
- 400: `invite_token` ausente
- 404: token inválido (nenhum grupo encontrado)

---

### Modificação: POST /api/predictions e PATCH /api/predictions/[id]

Ambos os Route Handlers existentes (`app/api/predictions/route.ts`, `app/api/predictions/[id]/route.ts`) precisam passar a exigir e validar `group_id`:

**`POST /api/predictions` — novo body:**
```json
{ "game_id": "uuid", "group_id": "uuid", "home_score": 0, "away_score": 0 }
```

**Novas validações (antes do `INSERT`):**
1. `group_id` ausente ou não-UUID → 422 (`invalid_params`).
2. Usuário não é membro de `group_id` → 403 (`forbidden`, mensagem "Você não participa deste grupo."). Verificado via `service_client.from('group_members').select('id').eq('group_id', groupId).eq('user_id', user.id).maybeSingle()`.
3. A verificação de "já existe prediction" (hoje `eq('user_id', user.id).eq('game_id', gameId)`) passa a incluir `.eq('group_id', groupId)` — permitindo que o mesmo usuário tenha predictions distintas para o mesmo jogo em grupos diferentes.
4. O `INSERT` passa a incluir `group_id: groupId`.
5. Erro de conflito (`23505`, violação da nova constraint `UNIQUE(user_id, game_id, group_id)`) continua mapeado para `422 already_submitted`.

**`PATCH /api/predictions/[id]` — sem mudança de body** (o `id` já identifica univocamente a linha, que já carrega seu `group_id` imutável — o palpite não pode "mudar de grupo" via edição). A única adição é, ao buscar a prediction existente (`select` na etapa 2 do handler atual), incluir `group_id` no `select` para eventual uso futuro, e manter a checagem de `ownership` (`prediction.user_id !== user.id`) exatamente como está — não é necessário checar membership de novo no PATCH, pois se o usuário já é `user_id` da prediction, ele necessariamente já era membro do grupo no momento da criação (e não há fluxo de remoção de membro nesta feature que pudesse invalidar isso retroativamente).

**`GET /api/predictions?game_id=...`** — passa a exigir também `group_id` como query param obrigatório, filtrando `.eq('group_id', groupId)` além de `.eq('user_id', user.id)` e `.eq('game_id', gameId)`. Sem `group_id`, retorna 400.

---

### Modificação: GET /api/ranking

**Novo query param obrigatório:** `?group_id=<uuid>`.

**Lógica:**
1. Autentica o usuário.
2. Valida `group_id` presente e UUID válido → senão 400.
3. Verifica membership do usuário em `group_id` (via `service_client`) → senão 403.
4. Chama RPC `get_ranking(p_group_id)` (nova assinatura, ver migration 7) em vez de `get_ranking()` sem argumento.

**Resposta de sucesso (200):** mesmo formato de antes (array de `RankingEntry`), agora implicitamente escopado ao grupo informado.

**Erros possíveis (novos, além dos já existentes 401/500):**
- 400: `group_id` ausente ou inválido
- 403: usuário não é membro do grupo informado

#### Nova função RPC `get_ranking(p_group_id uuid)`

```sql
DROP FUNCTION IF EXISTS get_ranking();

CREATE OR REPLACE FUNCTION get_ranking(p_group_id uuid)
RETURNS TABLE (
  user_id          uuid,
  participant_name text,
  total_points     int,
  games_predicted  int,
  rank_position    int
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    gm.user_id                                       AS user_id,
    p.name                                            AS participant_name,
    COALESCE(SUM(s.points), 0)::int                   AS total_points,
    COUNT(s.id)::int                                  AS games_predicted,
    RANK() OVER (
      ORDER BY COALESCE(SUM(s.points), 0) DESC
    )::int                                            AS rank_position
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s ON s.user_id = gm.user_id AND s.group_id = gm.group_id
  WHERE gm.group_id = p_group_id
  GROUP BY gm.user_id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
```

**Mudança-chave em relação à versão anterior:** a base agora é `group_members` filtrado por `p_group_id` (em vez de todos os `profiles` do sistema), e o `LEFT JOIN` com `scores` exige `s.group_id = gm.group_id` — garantindo que a soma de pontos considera apenas scores daquele grupo específico. Isso preserva o comportamento corrigido na migration `fix_ranking_all_profiles` (incluir membros com 0 pontos, via `LEFT JOIN` + `COALESCE`), agora aplicado por grupo: todo membro do grupo aparece no ranking daquele grupo mesmo sem nenhum palpite ainda.

---

## Frontend — Componentes e Páginas React

### Estrutura de rotas nova

```
app/
├── (dashboard)/
│   ├── grupos/
│   │   ├── page.tsx              # Lista "Meus Grupos" + botão criar grupo
│   │   ├── novo/
│   │   │   └── page.tsx          # Formulário de criação de grupo
│   │   └── [id]/
│   │       └── page.tsx          # Detalhes do grupo: nome, membros, link de convite (se admin)
│   ├── jogos/page.tsx            # MODIFICADO: passa a depender de group_id ativo
│   ├── ranking/page.tsx          # MODIFICADO: passa a depender de group_id ativo
│   ├── meus-palpites/page.tsx    # MODIFICADO: passa a depender de group_id ativo
│   └── layout.tsx                # MODIFICADO: seletor de grupo ativo no header
├── convite/
│   └── [token]/
│       └── page.tsx              # Rota PÚBLICA (fora de (dashboard)) — tela de aceite de convite
```

### Mecanismo de "grupo ativo"

**Decisão de design:** o grupo ativo é persistido via **query param `?group=<id>` na URL**, não em estado global de contexto React nem em cookie. Razões:
- Mantém cada página (`/jogos`, `/ranking`, `/meus-palpites`) como Server Component que já recebe o `group_id` necessário diretamente de `searchParams`, sem precisar de um Context Provider client-side envolvendo todo o `(dashboard)` layout.
- Permite compartilhar um link direto para "jogos do Grupo X" (ex: `/jogos?group=abc&date=2026-06-14`).
- Consistente com o padrão já usado por `/jogos?date=...` (`searchParams: Promise<{ date?: string }>`, ver `app/(dashboard)/jogos/page.tsx` atual).

**Fallback de grupo ativo:** se a página é acessada sem `?group=`, o servidor busca os grupos do usuário (`group_members` + `groups`, ordenado por `joined_at ASC`) e redireciona (via `redirect()` do Next.js) para a mesma rota com `?group=<primeiro_grupo.id>` anexado. Se o usuário não pertence a nenhum grupo (caso teoricamente impossível após a migration de dados, mas possível para um usuário novo que nunca usou um link de convite), redireciona para `/grupos` com uma mensagem "Você ainda não participa de nenhum grupo — crie um ou peça um link de convite."

**Persistência entre navegações:** o seletor de grupo no header (`GroupSwitcher`, ver abaixo) é um componente client-side que, ao trocar de grupo, usa `router.push` preservando o pathname atual e substituindo o `group` query param — ex: se o usuário está em `/ranking?group=A` e troca para o grupo B, navega para `/ranking?group=B`.

### `GroupSwitcher.tsx` (novo)

**Arquivo:** `app/(dashboard)/group-switcher.tsx`
**Diretiva:** `'use client'`

**Props:**
```ts
interface GroupSwitcherProps {
  groups: { id: string; name: string; role: 'admin' | 'member' }[]
  activeGroupId: string
}
```

**Comportamento:**
- Renderiza um `<select>` estilizado (ou dropdown customizado seguindo o estilo Elifoot — sem necessidade de biblioteca de UI externa) listando os grupos do usuário pelo nome, com o grupo ativo pré-selecionado.
- Ao selecionar um grupo diferente, usa `usePathname()` + `useSearchParams()` (já usados em `nav-links.tsx` para o link ativo) para montar a nova URL: pathname atual + `?group=<novo_id>` (preservando outros params como `date`, se existirem, exceto quando isso não fizer sentido entre grupos — `date` pode ser preservado sem problema, pois `games` é global).
- Posicionado no header do dashboard (`app/(dashboard)/layout.tsx`), ao lado de `NavLinks`.
- Se o usuário pertence a um único grupo, o `<select>` ainda é exibido (mas com uma única opção) — não é necessário escondê-lo condicionalmente; simplicidade de implementação > otimização visual para esse caso raro após a migração (a maioria dos usuários migrados terá 1 grupo até criarem/entrarem em outros).

**Estados:** o `GroupSwitcher` recebe a lista de grupos já carregada via prop (buscada no Server Component do layout) — não tem estado de loading próprio.

### `app/(dashboard)/layout.tsx` (modificado)

- Server Component busca, além do `user`, a lista de grupos do usuário (`GET` equivalente direto via Supabase client server-side: `group_members JOIN groups WHERE user_id = user.id`).
- Determina o `activeGroupId`: lido de `searchParams` se o layout tiver acesso (Next.js App Router permite layouts lerem `searchParams` apenas se declarados — caso não seja viável estruturalmente, a leitura do `group` ativo para fins de **destacar** no `GroupSwitcher` pode ser feita client-side dentro do próprio `GroupSwitcher` via `useSearchParams()`, e o layout apenas passa a lista de `groups` sem precisar saber qual é o ativo). **Decisão:** o layout passa apenas `groups` para `GroupSwitcher`; o próprio `GroupSwitcher` lê `useSearchParams().get('group')` para saber qual marcar como selecionado — evita problemas de tipagem de `searchParams` em layouts do App Router.
- Se a lista de grupos do usuário estiver vazia, o `GroupSwitcher` não é renderizado; em vez disso, um link "CRIAR/ENTRAR EM UM GRUPO" aparece no header levando a `/grupos`.

### `app/(dashboard)/grupos/page.tsx` (novo)

**Tipo:** Server Component
**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  MEUS GRUPOS                                          │
│  ─────────────────────────────────────────────────── │
│  ► BOLÃO DA INGRISIA ABJ        ADMIN    6 membros    │
│    BOLÃO DO TRABALHO            MEMBRO   4 membros    │
│  ─────────────────────────────────────────────────── │
│  [ + CRIAR NOVO GRUPO ]                                │
└──────────────────────────────────────────────────────┘
```
- Cada linha é um link para `/grupos/[id]`.
- Botão "+ CRIAR NOVO GRUPO" leva a `/grupos/novo`.
- Estado vazio: "VOCÊ NÃO PARTICIPA DE NENHUM GRUPO AINDA" + botão de criar.

### `app/(dashboard)/grupos/novo/page.tsx` + `CreateGroupForm.tsx` (novo)

**Arquivo do form:** `components/bolao/CreateGroupForm.tsx`, `'use client'`.

**Comportamento:**
- Input de texto único: "NOME DO GRUPO" (placeholder: ex: "Bolão da Família").
- Botão "CRIAR GRUPO" (estilo CTA: `bg color-primary`, `texto color-bg`, uppercase — igual ao botão "CONFIRMAR PALPITE" do Card de Palpite).
- Ao submeter: `POST /api/groups` com `{ name }`. Em sucesso, redireciona para `/grupos/[novo_id]` (tela de detalhes, onde o admin já vê o link de convite imediatamente).
- Erros: nome vazio → mensagem inline em `color-error` antes mesmo do submit (validação client-side); erro 422/500 do servidor → mensagem em `color-error` abaixo do form.

### `app/(dashboard)/grupos/[id]/page.tsx` (novo)

**Tipo:** Server Component, com uma porção client-side para o botão de copiar (`CopyInviteLink.tsx`).

**Layout (visão admin):**
```
┌──────────────────────────────────────────────────────┐
│  BOLÃO DA INGRISIA ABJ                          ADMIN │
│  ─────────────────────────────────────────────────── │
│  LINK DE CONVITE (REUTILIZÁVEL)                       │
│  https://bolao-abj.vercel.app/convite/k3F9pQ7x...     │
│  [ COPIAR LINK ]                                       │
│  ─────────────────────────────────────────────────── │
│  PARTICIPANTES (6)                                     │
│  • HAMON          ADMIN                                │
│  • JOÃO           MEMBRO                                │
│  • MARIA          MEMBRO                                │
└──────────────────────────────────────────────────────┘
```
**Layout (visão membro não-admin):** mesma estrutura, sem a seção "LINK DE CONVITE".

**Lógica:**
1. Busca `GET /api/groups/[id]` (ou query direta server-side equivalente) — se 403/404, exibir página de erro "Grupo não encontrado ou você não tem acesso" com link para `/grupos`.
2. Busca lista de membros: `group_members JOIN profiles WHERE group_id = id ORDER BY role DESC, joined_at ASC` (admins primeiro).
3. Renderiza condicionalmente a seção de convite conforme `role === 'admin'`.

### `CopyInviteLink.tsx` (novo)

**Arquivo:** `components/bolao/CopyInviteLink.tsx`, `'use client'`.
**Props:** `{ inviteUrl: string }`.
**Comportamento:** botão que chama `navigator.clipboard.writeText(inviteUrl)` e exibe feedback temporário "COPIADO!" por ~2 segundos (`color-win`), revertendo para "COPIAR LINK" depois. Sem dependência externa.

### `app/convite/[token]/page.tsx` (novo, rota pública)

**Tipo:** Server Component (fora do grupo `(dashboard)`, portanto sem o layout protegido por auth).

**Lógica:**
1. Resolve o token via chamada equivalente a `GET /api/groups/resolve-invite?token=...` (pode ser feito como query direta server-side com `service_role`, já que esta página não está dentro do `(dashboard)` e não tem `createClient()` autenticado de usuário disponível antes do login).
2. Se token inválido: exibe "CONVITE INVÁLIDO OU EXPIRADO" (mesmo que o token nunca expire tecnicamente, a mensagem cobre o caso de token incorreto/removido).
3. Se válido: verifica se há sessão de usuário autenticado (`supabase.auth.getUser()`):
   - **Sem sessão:** exibe nome do grupo + botão "ENTRAR / CADASTRAR" → linka para `/login?redirect=/convite/${token}` (o fluxo de login/cadastro já existente precisa aceitar um param `redirect` opcional e, ao final, navegar para essa URL ao invés do dashboard padrão — pequeno ajuste no fluxo de auth existente, ver Regras de Negócio).
   - **Com sessão:** exibe nome do grupo + botão "ENTRAR NO GRUPO" → componente client-side `JoinGroupButton.tsx` que chama `POST /api/groups/join`, e em sucesso redireciona para `/jogos?group=<group_id>`.

**Design:** mesma estética do restante do app (monospace, cores da paleta, bordas simples), mesmo sendo uma rota pública — não é uma landing page de marketing, é só uma tela funcional de aceite.

### `JoinGroupButton.tsx` (novo)

**Arquivo:** `components/bolao/JoinGroupButton.tsx`, `'use client'`.
**Props:** `{ inviteToken: string, groupId: string }`.
**Comportamento:** botão "ENTRAR NO GRUPO"; ao clicar, `POST /api/groups/join`; loading state "ENTRANDO..."; sucesso → `router.push('/jogos?group=' + groupId)`; erro → mensagem em `color-error` abaixo do botão, sem navegação.

### Modificações em páginas existentes

#### `app/(dashboard)/jogos/page.tsx`

- `JogosPageProps.searchParams` passa a incluir `group?: string` além de `date?: string`.
- Se `group` ausente: redireciona para o primeiro grupo do usuário (lógica de fallback descrita acima), preservando `date` se presente.
- Se `group` presente mas usuário não é membro: redireciona para `/grupos` com mensagem de erro (ou renderiza estado de erro "Você não participa deste grupo").
- Todas as queries que hoje filtram apenas por `user_id`/`game_id` passam a também filtrar por `group_id = activeGroupId`:
  - Busca de `predictions` do usuário logado: `.eq('group_id', activeGroupId)` adicionado.
  - Busca de `allPredictions` (para `participantsByGameId`): `.eq('group_id', activeGroupId)` adicionado — **e a lista de participantes em si muda de "todos os profiles do sistema" para "todos os membros daquele grupo"**: a query `allProfiles` (hoje `SELECT id, name FROM profiles ORDER BY name`) passa a ser `SELECT profiles.id, profiles.name FROM group_members JOIN profiles ON profiles.id = group_members.user_id WHERE group_members.group_id = activeGroupId ORDER BY profiles.name`. Isso é uma mudança importante: hoje a tela de jogos mostra TODOS os usuários cadastrados no sistema como "participantes"; após esta feature, mostra apenas os membros do grupo ativo.
  - Busca de `allScores`: `.eq('group_id', activeGroupId)` adicionado.
- O componente `PredictionForm`/`GameCard` (que faz `POST`/`PATCH` em `/api/predictions`) passa a receber e enviar `group_id: activeGroupId` no body da requisição.

#### `app/(dashboard)/ranking/page.tsx`

- Recebe `group` via `searchParams`, mesma lógica de fallback/redirect.
- `RankingTable` passa a receber `groupId` como prop obrigatória, repassando para `useRankingRealtime(groupId)` (assinatura modificada — ver abaixo) e `useLivePointsByUser(groupId)` (idem).

#### `app/(dashboard)/meus-palpites/page.tsx`

- Recebe `group` via `searchParams`, mesma lógica de fallback/redirect.
- Query de predictions do usuário passa a incluir `.eq('group_id', activeGroupId)`.
- Cabeçalho da página passa a exibir o nome do grupo ativo, ex: "MEUS PALPITES — BOLÃO DA INGRISIA ABJ".

#### `lib/hooks/useRankingRealtime.ts` (modificado)

**Nova assinatura:**
```ts
function useRankingRealtime(groupId: string): {
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
}
```
- `fetchRanking()` passa a chamar `GET /api/ranking?group_id=${groupId}`.
- Canal Realtime passa a ter filtro: `postgres_changes` em `scores`, evento `*`, **filtro `group_id=eq.${groupId}`** (em vez de escutar todas as mudanças de `scores` de todos os grupos — reduz ruído de eventos e evita refetch desnecessário quando outro grupo pontua). Nome do canal: `ranking-scores-${groupId}` (escopado, para não colidir se o usuário tiver múltiplas instâncias do hook montadas, embora isso não deva ocorrer na prática).
- `useEffect` dependency array passa a incluir `[groupId]` — trocar de grupo precisa desmontar a subscription antiga e criar uma nova.

#### `lib/hooks/useLivePointsByUser.ts` (modificado)

**Nova assinatura:**
```ts
function useLivePointsByUser(groupId: string): { livePoints: LivePointsByUser; loading: boolean }
```
- O fetch de "jogos `live` + predictions desses jogos" passa a filtrar predictions por `.eq('group_id', groupId)` — jogos continuam globais (`games` sem filtro de grupo, pois um jogo `live` é o mesmo jogo para todos os grupos), mas as predictions agregadas para calcular pontos parciais só consideram o grupo ativo.
- Canal Realtime: mantém escuta em `games` (tabela global, sem filtro de grupo possível nem necessário, pois qualquer jogo `live` de qualquer grupo é o mesmo registro de `games`), mas o **recálculo interno** após cada evento já filtra as predictions pelo `groupId` recebido como argumento do hook.
- `useEffect` dependency array passa a incluir `[groupId]`.

#### `components/bolao/RankingTable.tsx` (modificado)

- Nova prop `groupId: string`, repassada para os dois hooks acima.
- Cabeçalho da tabela passa a exibir o nome do grupo (recebido como prop adicional `groupName: string`, vindo do Server Component pai), ex: "RANKING — BOLÃO DA INGRISIA ABJ" (substituindo o texto fixo "RANKING — BOLÃO DO CARTOLA ABJ" usado hoje).

#### `components/games/GameList.tsx`, `GameCard.tsx`, `PredictionForm.tsx`, `GameParticipantsList.tsx`

- Todos passam a receber e repassar `groupId: string` como prop adicional, necessária para:
  - `PredictionForm`: incluir `group_id` no body do `POST/PATCH /api/predictions`.
  - `GameParticipantsList`: nenhuma mudança de lógica interna (já recebe `participants` prontos via prop) — a lista de `participants` que chega já vem filtrada por grupo desde a página `/jogos`, então o componente em si é agnóstico a grupo (não precisa saber o `groupId`, só recebe dados já corretos).

---

## Regras de Negócio

1. **Criação de grupo:** qualquer usuário autenticado pode criar um grupo informando um `name` não vazio (máx. 60 caracteres). O criador se torna automaticamente `role = 'admin'` daquele grupo, via inserção atômica (com rollback manual em caso de falha parcial, ver seção Backend).

2. **Entrada via convite:** qualquer usuário autenticado (novo ou existente) que acessar `/convite/<token>` válido e confirmar a entrada se torna `role = 'member'` do grupo correspondente. Entrar de novo no mesmo grupo (token já usado antes pelo mesmo usuário) é uma operação idempotente — não gera erro, não duplica membership.

3. **Token de convite:** gerado uma única vez na criação do grupo, nunca expira, nunca é regenerado nesta feature, e é válido para qualquer número de usos por qualquer pessoa que o possua.

4. **Isolamento de palpites:** um usuário pode ter, no máximo, **um palpite por (jogo, grupo)** — `UNIQUE(user_id, game_id, group_id)`. O mesmo usuário pode ter palpites diferentes para o mesmo jogo em grupos diferentes, sem nenhuma relação entre eles.

5. **Isolamento de pontuação:** a pontuação (`scores`) de um palpite é calculada e armazenada com o mesmo `group_id` do palpite que a originou. A soma de pontos de um usuário em um grupo (`get_ranking`) considera exclusivamente `scores` daquele `group_id`.

6. **Deadline e regras de pontuação inalteradas:** o deadline de 5 minutos antes do início do jogo (`match_date - now() <= 5min`) e todas as regras de pontuação do CLAUDE.md (vencedor +3, exato +5, placar do vencedor +3, diferença +2, placar do perdedor +1, goleada +1 com a condição corrigida de `>=4` em ambos os lados) **continuam idênticas**, agora apenas aplicadas dentro do escopo de cada `(jogo, grupo)` independentemente — a regra em si não tem nenhuma noção de "grupo", apenas o conjunto de dados sobre o qual ela opera é filtrado por grupo antes/depois do cálculo.

7. **`games` é global:** o calendário de jogos, placares e status são os mesmos para todos os grupos. Quando um jogo passa para `live` ou `finished`, **todos os grupos** que tiverem ao menos um membro com palpite para aquele jogo recalculam sua pontuação de forma independente (múltiplas linhas em `scores`, uma por grupo, todas geradas pelo mesmo disparo do trigger).

8. **Visibilidade estritamente por membership:** um usuário nunca pode ler (via UI ou API) `predictions`, `scores`, `group_members` ou detalhes de `groups` de um grupo do qual não é membro — garantido tanto por RLS (linha de defesa primária) quanto por checagens explícitas nos Route Handlers (linha de defesa secundária, ex: 403 em `GET /api/groups/[id]` e `GET /api/ranking`).

9. **Visibilidade temporal de palpites preservada por grupo:** a regra da feature `fix-prediction-visibility` (próprio palpite sempre visível; palpite de terceiros só após o jogo sair de `pending`) continua válida, mas agora "terceiros" significa "outros membros do mesmo grupo" — nunca há exposição cruzada entre grupos, independentemente do status do jogo.

10. **Admin único, sem promoção/demoção nesta feature:** o `role = 'admin'` é atribuído apenas no momento da criação do grupo, ao criador. Não há nesta feature nenhum mecanismo de promover um `member` a `admin`, remover o admin, ou ter múltiplos admins — fora de escopo.

11. **Grupo ativo obrigatório para navegar no dashboard:** as rotas `/jogos`, `/ranking`, `/meus-palpites` exigem um `group_id` de contexto (via query param `?group=`); se ausente, o servidor redireciona automaticamente para o primeiro grupo do usuário (ordenado por `joined_at`); se o usuário não tiver nenhum grupo, redireciona para `/grupos`.

---

## Proteção de Rotas

- **Rotas protegidas (requerem autenticação, dentro do grupo `(dashboard)`, já cobertas pelo middleware/layout existente):** `/grupos`, `/grupos/novo`, `/grupos/[id]`, e as já existentes `/jogos`, `/ranking`, `/meus-palpites`, `/como-pontuar`.
- **Rota nova pública (sem autenticação obrigatória para visualizar):** `/convite/[token]` — fica **fora** do grupo `(dashboard)`, similar a `/login` e `/cadastro` (grupo `(auth)`). A ação de efetivamente entrar no grupo (`POST /api/groups/join`) exige autenticação; a página em si apenas exibe informação e oferece o caminho de login/cadastro quando necessário.
- **Redirecionamento de pós-login:** o fluxo de login/cadastro existente precisa aceitar um parâmetro opcional `redirect` na query string e, ao final da autenticação bem-sucedida, navegar para essa URL em vez do destino padrão (`/jogos`) — pequeno ajuste pontual nos componentes de login/cadastro já implementados na feature `auth`, necessário para o fluxo "abri o link de convite sem estar logado → fiz login → volto para o convite automaticamente".
- **Endpoints novos:**
  - `POST /api/groups` — requer Bearer JWT.
  - `GET /api/groups` — requer Bearer JWT.
  - `GET /api/groups/[id]` — requer Bearer JWT + membership.
  - `GET /api/groups/resolve-invite` — público.
  - `POST /api/groups/join` — requer Bearer JWT.
- **Endpoints modificados:**
  - `POST /api/predictions`, `PATCH /api/predictions/[id]`, `GET /api/predictions` — continuam exigindo Bearer JWT, agora também validam membership de `group_id`.
  - `GET /api/ranking` — continua exigindo Bearer JWT, agora também exige `group_id` e valida membership.
- **Endpoint admin inalterado:** `PATCH /api/admin/update-game/[gameId]` continua protegido por `X-Admin-Secret`, sem qualquer relação com grupos (confirmado explicitamente conforme solicitado).

---

## Integração Supabase Realtime

| Hook | Tabela | Evento | Canal | Filtro | O que fazer ao receber evento |
|------|--------|--------|-------|--------|-------------------------------|
| `useRankingRealtime(groupId)` (modificado) | `scores` | `*` | `ranking-scores-${groupId}` | `group_id=eq.${groupId}` | Refaz fetch de `GET /api/ranking?group_id=${groupId}` |
| `useLivePointsByUser(groupId)` (modificado) | `games` | `UPDATE` | `live-points-games-${groupId}` | nenhum (games é global, sem coluna de grupo) | Refaz fetch de jogos `live` + predictions filtradas por `group_id=${groupId}`, recalcula soma por usuário, debounce 1000ms (inalterado) |
| `useGameRealtime` (já existe, inalterado) | `games` | `UPDATE` | `game-${gameId}` | `id=eq.${gameId}` | Inalterado — `games` não tem `group_id`, então este hook não precisa de nenhuma mudança |

**Configuração manual necessária no Supabase:** nenhuma nova tabela entra na publicação `supabase_realtime` — `games` e `scores` já estão publicadas desde as features anteriores. `groups` e `group_members` **não precisam** entrar na publicação Realtime nesta feature (não há requisito de atualização em tempo real para criação de grupo/entrada de membro — a lista de grupos é recarregada a cada navegação de página via Server Component, o que é suficiente para o caso de uso).

---

## Script de Migração de Dados (idempotente)

**Arquivo:** `db/migrations/20260615_seed_bolao_ingrisia_group.sql` (espelhado em `supabase/migrations/20260615120200_seed_bolao_ingrisia_group.sql`, conforme convenção de duas pastas já usada no projeto).

**Objetivo:** criar o grupo "Bolão da Ingrisia ABJ", tornar o usuário "Hamon" (buscado por `profiles.name`) seu admin, criar membership para todos os profiles já cadastrados, e popular `group_id` em todas as linhas existentes de `predictions` e `scores`.

```sql
-- Migração de dados idempotente: move todo o estado pré-grupos para
-- o grupo "Bolão da Ingrisia ABJ", com "Hamon" como admin.
-- Seguro para rodar múltiplas vezes (idempotente).

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
    INSERT INTO groups (name, invite_token, created_by)
    VALUES ('Bolão da Ingrisia ABJ', encode(gen_random_bytes(24), 'base64'), v_admin_id)
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
```

**Por que o token de convite usa `encode(gen_random_bytes(24), 'base64')` em SQL em vez do gerador TypeScript:** este script roda diretamente no Postgres (migration SQL), não no Route Handler — `gen_random_bytes` é da extensão `pgcrypto`, já necessária para `gen_random_uuid()` usado em outras tabelas do projeto. O formato resultante (base64 padrão, com possíveis `+`/`/`) é discretamente diferente do `base64url` gerado pelo backend TypeScript, mas isso não é um problema: o campo é `text` opaco, e o link de convite usa o valor como veio — apenas atentar que caracteres `+`/`/` em base64 padrão **precisam ser URL-encoded** ao montar o link (`encodeURIComponent(token)`), ou trocar para uma codificação URL-safe direto no SQL (ex: `translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_')` para já gerar URL-safe, recomendado para evitar essa pegadinha). **Recomendação final:** usar essa função `translate` no script para manter o token sempre URL-safe, consistente com o formato gerado pelo backend TypeScript.

**Idempotência confirmada:**
- Grupo: `SELECT ... WHERE name = ...` antes de `INSERT` — não duplica o grupo se rodado de novo.
- Admin: `ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin'` — não duplica membership, garante que Hamon continua admin mesmo se a migração rodar de novo após alguma mudança manual.
- Demais membros: `ON CONFLICT (group_id, user_id) DO NOTHING` — não duplica, não rebaixa um eventual admin promovido manualmente entre execuções.
- Backfill: `WHERE group_id IS NULL` — rodar de novo não tem efeito sobre linhas já migradas (e não deveria, pois depois da migration 4 da seção Migrations, `group_id` já será `NOT NULL` e essas linhas `UPDATE` não encontrarão mais nenhuma linha-alvo).

**Quando executar em relação às demais migrations:** este script (migration 3 da lista) deve rodar **depois** de `groups`/`group_members` existirem e de `predictions`/`scores` terem a coluna `group_id` (nullable) criada (migrations 1 e 2), e **antes** de `group_id` se tornar `NOT NULL` e da constraint antiga ser removida (migration 4). Ver "Riscos de Migração" abaixo para o checklist de validação entre as etapas 3 e 4.

---

## Riscos de Migração de Dados em Produção

O projeto já está em produção com usuários reais (confirmado pelo PM: "projeto já está em produção com 19 features entregues"). Os riscos abaixo são específicos da introdução tardia de multi-tenancy:

### Risco 1 — Usuário "Hamon" não encontrado ou nome ambíguo
**Cenário:** o script de migração busca `profiles.name ILIKE 'Hamon'`. Se o nome cadastrado for diferente (ex: "Hamon Vitorino", "hamon123", ou um apelido), a busca por igualdade exata falha e o script aborta com `RAISE EXCEPTION` (comportamento intencional — falhar ruidosamente é melhor que adivinhar o admin errado).
**Mitigação:** antes de rodar a migration em produção, executar manualmente `SELECT id, name FROM profiles WHERE name ILIKE '%hamon%';` para confirmar o nome exato cadastrado, e ajustar a constante no script se necessário (trocar `ILIKE 'Hamon'` por `ILIKE 'Hamon%'` ou o valor exato encontrado) **antes** de aplicar a migration. Documentar esse passo manual no plano de execução do Programador.

### Risco 2 — Janela de inconsistência entre adicionar a coluna `group_id` (nullable) e o backfill
**Cenário:** entre a migration 2 (adiciona `group_id` nullable) e a migration 3 (backfill), se algum usuário criar um novo palpite via `POST /api/predictions` **antes** do Route Handler ser atualizado para exigir `group_id`, a nova linha entraria com `group_id = NULL`, e o backfill da migration 3 (que só atualiza `WHERE group_id IS NULL`) acabaria incorretamente atribuindo essa linha nova ao grupo "Bolão da Ingrisia ABJ" mesmo que não fosse essa a intenção (na prática, como não há outro grupo ainda nesse momento, isso é inofensivo, mas é uma corrida de condição a evitar).
**Mitigação:** o deploy do código (Route Handlers atualizados para exigir `group_id`) e a aplicação das migrations de banco devem ser coordenados na mesma janela de manutenção, com a seguinte ordem estrita: (a) aplicar migrations 1+2 (schema aditivo, nullable — não quebra o código antigo, que ainda não passa `group_id`, pois a coluna aceita `NULL`); (b) aplicar migration 3 (backfill); (c) **imediatamente em seguida**, fazer o deploy do novo frontend/backend que já exige `group_id` em todas as escritas; (d) só então aplicar migration 4 (`NOT NULL` + nova constraint). Manter essa janela curta (idealmente fora do horário de pico de uso do bolão, ex: de madrugada ou em dia sem jogos).

### Risco 3 — Constraint antiga com nome desconhecido
**Cenário:** a migration 4 precisa fazer `DROP CONSTRAINT` na antiga `UNIQUE(user_id, game_id)` de `predictions`, mas o nome exato gerado automaticamente pelo Postgres (`predictions_user_id_game_id_key` é o nome convencional, mas pode diferir se a tabela foi criada com nome explícito diferente) precisa ser confirmado antes de aplicar.
**Mitigação:** documentado na própria migration 4 (ver seção Migrations) — rodar `SELECT conname FROM pg_constraint WHERE conrelid = 'predictions'::regclass AND contype = 'u';` manualmente antes de escrever o `DROP CONSTRAINT` definitivo, e ajustar o nome no script SQL antes de aplicar em produção.

### Risco 4 — Usuários ativos durante a migração (downtime parcial)
**Cenário:** se algum usuário estiver no meio de submeter um palpite exatamente durante a janela de deploy (entre o deploy do schema e o deploy do código), pode receber um erro 422/500 inesperado (`group_id` obrigatório no novo código, mas o usuário ainda está em uma sessão de frontend antigo sem esse campo, ou vice-versa).
**Mitigação:** aceitável para um bolão de "pequeno grupo de amigos" (conforme contexto do CLAUDE.md) — o risco de um único palpite falhar momentaneamente durante a janela de deploy é baixo impacto e recuperável (o usuário tenta de novo). Recomenda-se ainda assim avisar o grupo (ex: mensagem no grupo de WhatsApp do bolão) sobre uma breve janela de manutenção antes de aplicar a migração, e executar fora do horário de jogos ao vivo (evitar interromper o `live-scoring` durante uma partida em andamento).

### Risco 5 — Perda de visibilidade cruzada inadvertida em `RLS` mal aplicada
**Cenário:** se a migration 5 (RLS escopada por grupo) for aplicada **antes** do backfill (migration 3) ou antes de `group_id` estar populado, todas as queries de `predictions`/`scores` passariam a usar `is_group_member(group_id, auth.uid())` contra um `group_id` ainda `NULL` em todas as linhas — `is_group_member(NULL, ...)` nunca é verdadeiro, então **toda leitura de predictions/scores pararia de retornar dados** até o backfill ser concluído (efetivamente um apagão temporário da visualização de palpites/pontuação, embora sem perda de dados).
**Mitigação:** ordem de aplicação estrita já definida na seção Migrations (1 → 2 → 3 → validar → 4 → 5 → 6 → 7) — a migration 5 (RLS) só é aplicada **depois** do backfill confirmado, eliminando esse risco por construção. Adicionar ao plano do Programador um passo de validação explícito entre as etapas: `SELECT COUNT(*) FROM predictions WHERE group_id IS NULL;` deve retornar `0` antes de prosseguir para a migration 4/5.

### Risco 6 — Regressão na regra de pontuação durante a reescrita do trigger
**Cenário:** ao reescrever `calculate_scores_for_game`, um erro de copy-paste poderia alterar sutilmente a lógica de pontuação (ex: esquecer a correção de goleada `>=4` já aplicada na feature `fix-goleada-scoring` e reintroduzir a regra antiga `>=3`).
**Mitigação:** a versão da função nesta spec foi copiada linha a linha da versão vigente (confirmada lendo `lib/scoring.ts` atual, que já reflete a correção `>=4`/`>=4`) com a única adição sendo `group_id` no `INSERT`/`ON CONFLICT`. O Programador deve fazer um diff explícito entre a função antiga (consultável via `\df+ calculate_scores_for_game` no Supabase ou lendo a migration `20260614000003_fix_goleada_scoring.sql`) e a nova, confirmando que a única mudança real é a coluna `group_id` — qualquer outra diferença de texto deve ser tratada como bug introduzido pela feature, não como mudança intencional.

### Risco 7 — Usuários que nunca usaram `/jogos` antes da migração e ficam "sem grupo"
**Cenário:** um profile cadastrado mas que nunca chegou a usar o sistema (caso raro, mas possível) ainda recebe membership no grupo "Bolão da Ingrisia ABJ" pelo backfill da migration 3 (que itera todos os `profiles`, não apenas os que têm `predictions`) — isso é o comportamento correto e desejado, mas vale confirmar explicitamente que a migration 3 usa `FROM profiles p` (todos os perfis) e não `FROM predictions` (só quem já palpitou), para não deixar nenhum usuário cadastrado "orfão" sem grupo após a migração.
**Mitigação:** já implementado corretamente no script (seção 4 do `DO $$`: `SELECT v_group_id, p.id, 'member' FROM profiles p WHERE p.id != v_admin_id`) — listado aqui como item de verificação explícita para o Revisor confirmar no código entregue.

### Risco 8 — Rollback em caso de falha a meio da migração de produção
**Cenário:** se a migration 4 (`NOT NULL` + nova constraint) falhar parcialmente (ex: por uma linha residual com `group_id IS NULL` que escapou do backfill), a tabela pode ficar em estado intermediário inconsistente.
**Mitigação:** cada migration desta feature é uma transação implícita do Postgres (DDL em uma única instrução por `ALTER TABLE`/`CREATE`) — se uma instrução falhar, ela não compromete instruções já committed em migrations anteriores (migrations são arquivos separados, aplicados um a um). Antes de aplicar a migration 4, **sempre** rodar a query de verificação do Risco 5 (`SELECT COUNT(*) FROM predictions WHERE group_id IS NULL` e o equivalente para `scores`) e só proceder se ambas retornarem `0`. Se uma migration específica falhar, ela pode ser corrigida e reaplicada isoladamente sem necessidade de reverter as anteriores.

---

## Critérios de Aceite

- [ ] Usuário autenticado consegue criar um grupo via `POST /api/groups` informando `name`, e se torna automaticamente `role = 'admin'` daquele grupo.
- [ ] Admin consegue visualizar e copiar o link de convite (`/convite/<token>`) na tela `/grupos/[id]`; membros não-admin não veem esse link na mesma tela.
- [ ] Um usuário (logado ou deslogado) que acessa `/convite/<token>` válido consegue entrar no grupo correspondente após autenticar-se, recebendo `role = 'member'`.
- [ ] Entrar duas vezes no mesmo grupo pelo mesmo link (mesmo usuário) não duplica `group_members` nem gera erro — comportamento idempotente.
- [ ] Usuário só visualiza ranking, participantes e palpites de grupos dos quais é membro — validado tanto via RLS (tentativa direta de leitura de outro `group_id` falha) quanto via Route Handlers (`GET /api/ranking?group_id=<outro_grupo>` retorna 403 se não-membro).
- [ ] `predictions` tem `UNIQUE(user_id, game_id, group_id)` aplicado; um mesmo usuário consegue ter palpites diferentes para o mesmo jogo em dois grupos distintos dos quais participa.
- [ ] `scores` tem `group_id` preenchido em toda nova linha gerada pelo trigger, herdado corretamente do `group_id` da `prediction` correspondente.
- [ ] Trigger `on_game_finished` → `calculate_scores_for_game` gera uma linha de score por `(usuário, grupo)` para cada grupo que tiver ao menos um membro com palpite no jogo finalizado — confirmado com cenário de teste manual envolvendo 2 grupos com membros sobrepostos e não sobrepostos.
- [ ] `get_ranking(p_group_id)` retorna apenas membros daquele grupo, com soma de pontos restrita a `scores` daquele `group_id`.
- [ ] Ranking parcial/live (`useLivePointsByUser`) soma pontuação provisória apenas das predictions do grupo ativo, sem misturar com outros grupos.
- [ ] Script de migração de dados (idempotente) cria o grupo "Bolão da Ingrisia ABJ", define "Hamon" (buscado em `profiles.name`) como admin, e migra todos os profiles/predictions/scores pré-existentes para esse grupo — validado rodando o script duas vezes seguidas sem erro nem duplicação.
- [ ] Nenhuma regressão nas regras de pontuação de CLAUDE.md (vencedor +3, exato +5, placar do vencedor +3, diferença +2, placar do perdedor +1, goleada +1 com `>=4`/`>=4`) — validado comparando a função `calculate_scores_for_game` antes/depois da feature linha a linha, exceto a adição de `group_id`.
- [ ] Deadline de 5 minutos antes do início do jogo continua bloqueando submissão/edição de palpite, agora também validando membership do `group_id` informado.
- [ ] Endpoint admin `PATCH /api/admin/update-game/[gameId]` funciona sem qualquer alteração, confirmando que `games` permanece global.
- [ ] Seletor de "grupo ativo" no header do dashboard permite trocar de grupo e todas as telas (`/jogos`, `/ranking`, `/meus-palpites`) refletem o grupo selecionado via `?group=<id>` na URL.
- [ ] Acessar `/jogos`, `/ranking` ou `/meus-palpites` sem `?group=` redireciona automaticamente para o primeiro grupo do usuário; usuário sem nenhum grupo é redirecionado para `/grupos`.
- [ ] Design segue DESIGN.md rigorosamente em todas as telas novas (`/grupos`, `/grupos/novo`, `/grupos/[id]`, `/convite/[token]`): paleta verde/amarelo/azul, fonte monospace, estilo Elifoot denso, dark only, sem ícones decorativos, sem sombras, bordas simples.
- [ ] Funciona em mobile (coluna única) em todas as telas novas, incluindo o seletor de grupo no header (quebra de linha graciosa em telas estreitas, mesmo padrão `flexWrap: wrap` já usado no header do dashboard).
- [ ] `npm run lint` e `npm run build` executados com sucesso após todas as mudanças.
- [ ] Interface 100% em português brasileiro nas telas novas.
