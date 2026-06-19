# Spec: Palpites e Pontuação ao Adicionar Participante a Grupo

**Slug:** group-member-history
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Ao adicionar um participante a um grupo (via link reutilizável ou convite nominal), replicar automaticamente todos os seus palpites já existentes em outros grupos para o novo grupo, e recalcular a pontuação para os jogos já finalizados — de modo que o usuário apareça imediatamente no ranking do novo grupo com seu histórico completo, sem necessidade de re-inserir dados manualmente.

---

## Histórias de Usuário

- Como participante recém-adicionado a um grupo, quero ver minha pontuação histórica no ranking desse grupo imediatamente após entrar, para que minha posição seja justa desde o início.
- Como admin de um grupo, quero que um novo participante traga automaticamente seus palpites já feitos ao entrar, para que o ranking reflita seu desempenho real desde a entrada.
- Como participante já membro de um grupo, quero que minha pontuação e palpites não sejam alterados quando outros usuários entram no grupo.

---

## Análise de Design: Estratégia de Replicação

### Opções consideradas

**Opção A — Replicação imediata (INSERT de cópias com novo group_id)**
Ao entrar no grupo, copiar as `predictions` do usuário (de qualquer grupo anterior) para o novo `group_id`, e chamar `calculate_scores_for_game` para cada jogo `finished` com prediction copiada.

**Opção B — View/join global sem group_id (sem duplicação)**
Remover `group_id` de `predictions`, tornando palpites globais por usuário/jogo, e ajustar o ranking para filtrar por membros do grupo. Scores também seriam globais ou calculados on-the-fly.

**Opção C — Fallback lógico no ranking (lê predictions de outros grupos)**
Manter o schema atual, mas modificar `get_ranking` para buscar predictions do usuário em qualquer grupo quando ele não tem prediction no grupo corrente.

### Decisão: Opção A (replicação imediata)

**Justificativa:**

1. **Consistência com a arquitetura atual:** `predictions` e `scores` já são escopados por `group_id`. O trigger `calculate_scores_for_game` já itera todas as predictions de um jogo e gera scores por `group_id`. A replicação respeita esse modelo sem tocar em nenhuma lógica existente.

2. **Opção B quebraria todas as features entregues:** Remover `group_id` de `predictions` exigiria reescrever: constraint de unicidade, trigger de pontuação, RLS, `get_ranking`, `predict-all-groups`, ranking Realtime, MCP, Daily Recap. Risco de regressão inaceitável.

3. **Opção C introduz inconsistência silenciosa:** Um palpite em `grupo-A` seria "visível" no `grupo-B` sem realmente pertencer a ele. Atualizações (edição de palpite) no `grupo-A` não refletiriam no `grupo-B`. Comportamento impossível de rastrear via RLS e violaria o isolamento de dados garantido pela policy `predictions_select_group_scoped`.

4. **Replicação é idempotente:** A constraint `UNIQUE(user_id, game_id, group_id)` garante que executar o processo duas vezes não duplica dados. O `ON CONFLICT DO NOTHING` é suficiente.

5. **Palpites futuros:** Após replicação, palpites novos são criados normalmente via `POST /api/predictions` com o `group_id` do novo grupo. O usuário pode usar `predict-all-groups` para propagar. O comportamento de palpites futuros não muda.

**Implicação de design crítica:** a replicação deve copiar apenas predictions de jogos `pending` (não iniciados — status diferente de `finished`/`live`) OU predictions de qualquer status? A resposta é: **copiar predictions de todos os jogos** (pending, live e finished). Para jogos `finished`, a pontuação é recalculada via `calculate_scores_for_game`. Para jogos `pending`, o palpite copiado serve como palpite no novo grupo (o usuário "leva" o palpite). Para jogos `live`, o palpite é copiado e a pontuação parcial/live-scoring será computada client-side naturalmente.

**Fluxo de edição:** se o usuário editar um palpite no grupo-A depois de já ter entrado no grupo-B, o palpite no grupo-B NÃO é atualizado automaticamente — ele foi copiado no momento da entrada. O usuário pode usar "propagar para todos os grupos" para sincronizar edições manualmente. Esse comportamento está alinhado com o modelo existente de `predict-all-groups`.

---

## Modelo de Dados

### Tabelas modificadas

Nenhuma tabela nova é necessária. O schema existente suporta a feature inteiramente.

### Função Postgres nova: `copy_predictions_to_group`

```sql
CREATE OR REPLACE FUNCTION copy_predictions_to_group(
  p_user_id  uuid,
  p_group_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_pred predictions%ROWTYPE;
BEGIN
  -- Para cada jogo em que o usuário tem palpite em QUALQUER outro grupo,
  -- mas ainda NÃO tem palpite no grupo p_group_id, copiar o palpite mais
  -- recente (por submitted_at DESC — desempate pelo UUID se necessário).
  FOR v_pred IN
    SELECT DISTINCT ON (game_id)
      user_id, game_id, home_score, away_score, submitted_at
    FROM predictions
    WHERE user_id = p_user_id
      AND group_id <> p_group_id
    ORDER BY game_id, submitted_at DESC
  LOOP
    INSERT INTO predictions (user_id, game_id, group_id, home_score, away_score, submitted_at)
    VALUES (p_user_id, v_pred.game_id, p_group_id, v_pred.home_score, v_pred.away_score, v_pred.submitted_at)
    ON CONFLICT (user_id, game_id, group_id) DO NOTHING;
  END LOOP;

  -- Recalcular pontuação para jogos finished que agora têm prediction neste grupo.
  -- calculate_scores_for_game itera TODAS as predictions do jogo, incluindo as
  -- recém-copiadas. ON CONFLICT (prediction_id) DO UPDATE garante idempotência.
  PERFORM calculate_scores_for_game(g.id)
  FROM games g
  WHERE g.status = 'finished'
    AND EXISTS (
      SELECT 1 FROM predictions p2
      WHERE p2.game_id = g.id
        AND p2.user_id = p_user_id
        AND p2.group_id = p_group_id
    );
END;
$$;
```

### Trigger Postgres: `on_group_member_inserted`

```sql
CREATE OR REPLACE FUNCTION trigger_copy_predictions_on_join()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM copy_predictions_to_group(NEW.user_id, NEW.group_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_member_inserted
  AFTER INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION trigger_copy_predictions_on_join();
```

**Por que trigger e não chamada no Route Handler?**
- Cobre todos os pontos de entrada: `POST /api/groups/join` (link reutilizável) e `POST /api/invites/[id]/accept` (convite nominal). Hoje há dois endpoints que fazem `INSERT INTO group_members`; sem o trigger, cada um precisaria chamar a função explicitamente, com risco de divergência futura.
- O trigger é atômico com o INSERT em `group_members`: se a cópia falhar, o INSERT é revertido (ou vice-versa — ver seção de Riscos abaixo).
- Consistente com o padrão já usado no projeto: `calculate_scores_for_game` também é disparado por trigger (`on_game_finished`).

**Risco de atomicidade:** Se `copy_predictions_to_group` lançar uma exceção, a transação do INSERT em `group_members` é revertida e o usuário não entra no grupo. Para evitar isso, a função deve capturar erros internamente e logar via `RAISE WARNING` em vez de propagar a exceção:

```sql
-- Dentro do loop de INSERT:
BEGIN
  INSERT INTO predictions ...
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'copy_predictions_to_group: erro ao copiar prediction game_id=% para group_id=%: %',
      v_pred.game_id, p_group_id, SQLERRM;
END;
```

Dessa forma, falhas pontuais de cópia não impedem o usuário de entrar no grupo. O histórico incompleto é preferível a bloquear a entrada.

### Migrations necessárias

1. `20260619000001_copy_predictions_on_join.sql`
   - `CREATE OR REPLACE FUNCTION copy_predictions_to_group(p_user_id uuid, p_group_id uuid)`
   - `CREATE OR REPLACE FUNCTION trigger_copy_predictions_on_join()`
   - `DROP TRIGGER IF EXISTS on_group_member_inserted ON group_members`
   - `CREATE TRIGGER on_group_member_inserted AFTER INSERT ON group_members FOR EACH ROW EXECUTE FUNCTION trigger_copy_predictions_on_join()`

---

## Backend — Endpoints modificados

### POST /api/groups/join
**Arquivo:** `app/api/groups/join/route.ts`
**Modificação:** Nenhuma alteração de código. O trigger Postgres `on_group_member_inserted` dispara automaticamente após o `INSERT INTO group_members` executado neste endpoint.

**Comportamento pós-feature:**
- `INSERT INTO group_members` → trigger `on_group_member_inserted` → `copy_predictions_to_group(user_id, group_id)` → cópia de predictions + recálculo de scores
- Resposta do endpoint permanece idêntica: `{ group_id, name, role, already_member }`

### POST /api/invites/[id]/accept
**Arquivo:** `app/api/invites/[id]/accept/route.ts`
**Modificação:** Nenhuma alteração de código. Mesmo raciocínio: o `INSERT INTO group_members` já presente neste endpoint dispara o trigger automaticamente.

**Atenção:** O endpoint tem um caminho de código onde o usuário já é membro (`if (!existingMembership) { INSERT... }`). Nesse caso, o INSERT não ocorre, logo o trigger não dispara — mas se o usuário já é membro, ele já tem suas predictions copiadas (ou as copiou na entrada original).

---

## Frontend — Componentes React

### Nenhum componente novo é necessário

A feature é inteiramente backend (trigger Postgres). O frontend existente já exibe ranking, palpites e scores escopados por `group_id` — ao entrar no grupo, os dados replicados aparecem naturalmente em todas as superfícies:

- **Ranking** (`/ranking`): `get_ranking(p_group_id)` retorna o usuário com pontos somados dos scores copiados.
- **Jogos** (`/jogos`): `GameParticipantsList` busca predictions e scores por `group_id` — as predictions copiadas aparecem automaticamente.
- **Meus Palpites** (`/meus-palpites`): filtra predictions por `user_id + group_id` — inclui as copiadas.
- **Live Scoring** (`useLivePointsByUser`): já filtra por `group_id`.
- **Daily Recap / Live Today**: escopados por grupo, sem alteração necessária.

### Feedback visual de entrada no grupo (melhoria opcional, não bloqueante)

Os endpoints `join` e `accept` já redirecionam o usuário para `/jogos?group=<id>`. O estado do ranking e dos jogos é carregado normalmente. Não há necessidade de indicador de "copiando histórico..." pois o trigger é síncrono e concluído antes da resposta HTTP. O usuário verá os dados imediatamente ao carregar `/jogos` ou `/ranking`.

---

## Regras de Negócio

1. **Qual prediction copiar quando o usuário tem palpites em múltiplos grupos para o mesmo jogo:** copiar o mais recente por `submitted_at DESC`. Lógica: o palpite mais recente representa a última intenção do usuário para aquele jogo.

2. **Jogos sem prediction em nenhum grupo:** não há nada a copiar. O usuário não aparecerá com prediction para esses jogos no novo grupo — comportamento correto.

3. **Jogos `pending` com prediction copiada:** o palpite fica registrado no novo grupo. Antes do deadline, o usuário pode editá-lo via `PATCH /api/predictions/[id]`. A edição é local ao grupo ativo (mesmo comportamento atual). O usuário pode usar "propagar para todos os grupos" para sincronizar.

4. **Jogos `live` com prediction copiada:** a pontuação parcial é calculada client-side via `calculateScore()` de `lib/scoring.ts` (feature `live-scoring`) — sem mudança. A prediction copiada é suficiente para a lógica client-side.

5. **Jogos `finished` com prediction copiada:** `calculate_scores_for_game(game_id)` é chamado para cada jogo finished. Essa função já existe e já usa `ON CONFLICT (prediction_id) DO UPDATE` — é idempotente. Gera um `score` com o `group_id` do novo grupo.

6. **Regressão zero:** usuários já membros do grupo não têm predictions ou scores alterados. `ON CONFLICT (user_id, game_id, group_id) DO NOTHING` garante que predictions existentes não são sobrescritas. `ON CONFLICT (prediction_id) DO UPDATE` em `calculate_scores_for_game` só atualiza o score da prediction específica — não toca scores de outros usuários.

7. **Usuário entra no mesmo grupo duas vezes (via link após convite aceito):** `group_members` tem `UNIQUE(group_id, user_id)`. O INSERT falharia com `23505`, e o trigger não dispara. O endpoint `join` já trata esse caso com `already_member: true`. Nenhuma duplicação ocorre.

8. **Performance:** A função itera predictions do usuário (tipicamente < 100 jogos na Copa 2026) e chama `calculate_scores_for_game` para cada jogo finished com prediction copiada. `calculate_scores_for_game` itera TODAS as predictions do jogo (em todos os grupos), mas usa `ON CONFLICT` para evitar reprocessamento desnecessário. Para um bolão de < 50 participantes com < 100 jogos, a execução síncrona no trigger é aceitável (< 1s estimado). Se performance for um problema em bolões grandes, pode-se tornar a função assíncrona via `pg_notify` + worker externo — mas isso está fora do escopo desta spec.

---

## Proteção de Rotas

Nenhuma rota nova. Os dois endpoints modificados (indiretamente pelo trigger) já são protegidos:
- `POST /api/groups/join` — requer Bearer JWT (autenticação via `auth.getUser`)
- `POST /api/invites/[id]/accept` — requer Bearer JWT + validação de `invited_user_id === user.id`

---

## Integração Supabase Realtime

Nenhum canal novo necessário. A inserção de scores via `calculate_scores_for_game` (chamado pelo trigger) gera eventos `INSERT`/`UPDATE` na tabela `scores` que já são observados pelos canais existentes:
- `ranking-scores-${groupId}` (hook `useRankingRealtime`) — o ranking do grupo ativo atualiza automaticamente quando os scores do novo membro são inseridos.
- `live-points-games-${groupId}` (hook `useLivePointsByUser`) — atualiza pontuação ao vivo.

---

## Critérios de Aceite

- [ ] Ao entrar em um grupo via link reutilizável (`POST /api/groups/join`), os palpites já existentes do usuário em outros grupos aparecem no novo grupo imediatamente (sem reload extra)
- [ ] Ao aceitar convite nominal (`POST /api/invites/[id]/accept`), o mesmo comportamento de cópia ocorre
- [ ] O ranking do novo grupo exibe o usuário recém-adicionado com pontuação calculada a partir dos jogos `finished` para os quais ele tinha palpite em outros grupos
- [ ] Nenhuma prediction é duplicada: `SELECT COUNT(*) FROM predictions WHERE user_id = $uid AND game_id = $gid AND group_id = $new_gid` retorna no máximo 1
- [ ] Usuários já membros do grupo não têm predictions ou scores alterados após a entrada de um novo membro
- [ ] Usuário sem predictions em nenhum grupo entra no grupo normalmente com 0 pontos e sem erro
- [ ] Usuário que já é membro (via `already_member: true` no join) não tem dados duplicados
- [ ] A migration é idempotente: aplicar duas vezes não causa erro
- [ ] `npm run lint` e `npm run build` passam sem erros novos
- [ ] Design segue DESIGN.md (nenhuma alteração de UI necessária — feature é transparente para o usuário)
- [ ] Funciona em mobile (sem alterações de UI)

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Trigger falha e bloqueia entrada no grupo | `copy_predictions_to_group` captura exceções internamente com `RAISE WARNING`; entrada no grupo nunca é bloqueada por falha de cópia |
| `calculate_scores_for_game` é lento para jogos com muitas predictions | Escopo do bolão (< 50 participantes, < 100 jogos) torna o risco negligenciável; adicionar índice `idx_predictions_game_id` se necessário (já existe `idx_predictions_user_game_group`) |
| Prediction mais recente não reflete a intenção do usuário no novo grupo | Comportamento explícito e documentado; usuário pode editar antes do deadline ou usar `predict-all-groups` |
| Trigger dispara em `group_members` inserido pela migration `seed_bolao_ingrisia_group` existente | A migration de seed já foi aplicada em produção antes desta feature; o trigger não existia então. Se replicada em ambiente limpo, o seed vai acionar o trigger — inofensivo, pois não há predictions para copiar naquele momento (banco vazio) |
