# Changelog: Palpites e Pontuação ao Adicionar Participante a Grupo

**Slug:** group-member-history
**Branch:** feature/group-member-history
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `supabase/migrations/20260619000001_copy_predictions_on_join.sql` (espelhada em `db/migrations/20260619_copy_predictions_on_join.sql`) — migration com três partes:

  1. **`copy_predictions_to_group(p_user_id uuid, p_group_id uuid)`** (`SECURITY DEFINER`, `LANGUAGE plpgsql`) — função que copia as predictions mais recentes do usuário (por `submitted_at DESC`, `DISTINCT ON (game_id)`) de qualquer outro grupo para `p_group_id`, usando `ON CONFLICT (user_id, game_id, group_id) DO NOTHING` para garantir idempotência. Cada INSERT é envolvido em um bloco `BEGIN/EXCEPTION` individual: erros pontuais geram `RAISE WARNING` sem abortar o loop nem reverter a entrada no grupo. Após a cópia, chama `calculate_scores_for_game(g.id)` para cada jogo `finished` que agora tem prediction do usuário no novo grupo — reutilizando a função existente, idempotente por `ON CONFLICT (prediction_id) DO UPDATE`.

  2. **`trigger_copy_predictions_on_join()`** (`LANGUAGE plpgsql`) — função trigger que chama `copy_predictions_to_group(NEW.user_id, NEW.group_id)` e retorna `NEW`.

  3. **`on_group_member_inserted`** — trigger `AFTER INSERT ON group_members FOR EACH ROW`, precedido de `DROP TRIGGER IF EXISTS` para garantir idempotência da migration.

### Backend (Next.js Route Handlers)

Nenhuma alteração. O trigger Postgres é a camada de execução; os dois endpoints que fazem `INSERT INTO group_members` (`POST /api/groups/join` e `POST /api/invites/[id]/accept`) disparam o trigger automaticamente sem precisar de nenhuma chamada explícita.

### Frontend (Next.js/React)

Nenhuma alteração. A feature é transparente para o frontend: dados replicados aparecem imediatamente em todas as superfícies (ranking, jogos, meus-palpites) via os filtros por `group_id` já existentes.

---

## Decisões técnicas

1. **Trigger AFTER INSERT versus chamada explícita nos Route Handlers.** A spec justifica a escolha do trigger: cobre ambos os pontos de entrada de `group_members` (link reutilizável e convite nominal) de forma atômica. A alternativa de chamar `copy_predictions_to_group` diretamente em cada Route Handler exigiria manutenção em dois lugares e arriscaria divergência futura se um terceiro ponto de entrada for adicionado. O padrão de trigger é consistente com `on_game_finished` / `trigger_calculate_scores()` já presente no projeto.

2. **Tratamento de erro no loop de INSERT: `RAISE WARNING` em vez de propagar exceção.** Se `copy_predictions_to_group` lançasse uma exceção não tratada, o INSERT em `group_members` seria revertido (transação atômica do trigger) e o usuário não entraria no grupo — comportamento inaceitável. A spec é explícita: entrada no grupo tem prioridade sobre completude do histórico. Cada INSERT está em um sub-bloco `BEGIN/EXCEPTION` próprio, de modo que erros pontuais (ex: FK temporariamente inválida, violação inesperada) geram um aviso no log sem afetar o fluxo principal.

3. **`SECURITY DEFINER` em `copy_predictions_to_group`.** A função lê e insere em `predictions` via `service_role` lógico (sem bypassar integridade referencial), necessário porque a RLS de `predictions` (policy `predictions_select_group_scoped`) limitaria a leitura de predictions de outros grupos pelo usuário autenticado. O padrão é consistente com `calculate_scores_for_game`, `is_group_member` e `is_group_admin` já definidos no projeto.

4. **Idempotência da migration.** `CREATE OR REPLACE FUNCTION` (duas funções) + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` garante que aplicar a migration duas vezes não causa erro nem duplica o trigger.

5. **Nenhuma nova tabela nem coluna.** O schema existente suporta a feature inteiramente. A constraint `UNIQUE(user_id, game_id, group_id)` em `predictions` (criada pela migration `enforce_group_id_not_null` da feature `grupos`) é o mecanismo central de idempotência da cópia.

6. **Lint e build.** `npm run lint` apresenta 2 erros pré-existentes na branch `main` (`group-switcher.tsx` e `GroupChatWidget.tsx`) — confirmados via execução de lint na `main` antes de qualquer mudança desta feature. Esta feature não introduz nenhum erro novo (nenhum arquivo TypeScript/React foi modificado). `npm run build` passa sem erros.

---

## Pontos de atenção para o Revisor

1. **Migration não executada contra banco real nesta sessão.** A migration foi escrita por leitura cuidadosa comparada linha a linha com as migrations existentes (especialmente `group_scoped_scoring_trigger` e `create_groups_and_members`). Recomendar aplicar em ambiente de homologação antes de produção.

2. **Trigger dispara no seed existente (`seed_bolao_ingrisia_group`) em ambiente limpo.** A migration de seed insere memberships em `group_members`. O trigger não existia quando o seed foi aplicado em produção. Em ambiente limpo (banco zerado), se as migrations forem reaplicadas em ordem e `20260619000001` for aplicada antes de `20260615120200_seed_bolao_ingrisia_group`, o trigger dispara no seed — mas é inofensivo, pois não há predictions para copiar naquele momento (banco zerado). A ordem correta de aplicação (timestamp) já garante isso: `20260619` > `20260615`.

3. **Performance em bolões grandes.** Para o escopo atual (< 50 participantes, < 100 jogos da Copa 2026), a execução síncrona no trigger é aceitável. Cada chamada a `calculate_scores_for_game` já tem o jogo carregado em memória e itera as predictions com `FOR v_pred IN SELECT`. O índice `idx_predictions_user_game_group` (`user_id, game_id, group_id`) já cobre a query de inserção/lookup; o índice `idx_predictions_game_id` (`game_id`) — se existente — cobre o loop interno de `calculate_scores_for_game`. Recomendar verificar se `idx_predictions_game_id` existe em produção (via `\d predictions`); se não existir, pode ser adicionado em migration separada.

4. **`DISTINCT ON (game_id)` + `ORDER BY game_id, submitted_at DESC`.** PostgreSQL exige que o primeiro campo no `ORDER BY` seja o mesmo campo do `DISTINCT ON`. O `submitted_at DESC` como segundo critério garante que, para o mesmo `game_id`, o palpite mais recente seja selecionado — comportamento especificado na regra de negócio #1 da spec.

5. **Verificar se `calculate_scores_for_game` já existe antes de aplicar.** A migration de trigger de pontuação da feature `grupos` (`20260615120500`) usa `CREATE OR REPLACE FUNCTION` — portanto a função já existe em produção e será chamada corretamente por `copy_predictions_to_group`. Não há risco de referência a função inexistente.

---

## Correções Fix 1

### Problema corrigido

**`v_pred predictions%ROWTYPE` com SELECT parcial causa mapeamento incorreto de colunas** (severidade: crítico)

A função `copy_predictions_to_group` declarava `v_pred predictions%ROWTYPE`, mas o cursor `FOR ... IN SELECT` retornava apenas 5 colunas (`user_id, game_id, home_score, away_score, submitted_at`) de uma tabela com 7 colunas. Em PostgreSQL, `%ROWTYPE` com SELECT parcial usa mapeamento por posição — os valores ficavam nos campos errados (ex: `user_id` mapeado para `id`, `game_id` mapeado para `user_id`, etc.), causando erros de cast `uuid↔int` ou valores incorretos no INSERT.

**Correção aplicada:** substituída a declaração de `v_pred predictions%ROWTYPE` por `v_pred RECORD` em ambos os arquivos de migration. Com `RECORD`, o PostgreSQL mapeia por nome de coluna, e o SELECT parcial funciona corretamente. O padrão `RECORD` é o correto para cursores com SELECT parcial; `%ROWTYPE` é adequado apenas quando o SELECT retorna todas as colunas (como em `calculate_scores_for_game`, que usa `SELECT *`).

**Arquivos corrigidos:**
- `supabase/migrations/20260619000001_copy_predictions_on_join.sql` — linha 31
- `db/migrations/20260619_copy_predictions_on_join.sql` — linha 31

---

## Commits realizados

```
c7ad3bc chore(group-member-history): adiciona plano de implementação
819467d feat(group-member-history): adiciona trigger de cópia de palpites ao entrar em grupo
6d08620 fix(group-member-history): corrige mapeamento de colunas em copy_predictions_to_group
```
