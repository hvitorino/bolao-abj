# Fix 1: Palpites e Pontuação ao Adicionar Participante a Grupo

**Slug:** group-member-history
**Data:** 2026-06-19
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `v_pred predictions%ROWTYPE` com SELECT parcial causa mapeamento incorreto de colunas
**Arquivo:** `supabase/migrations/20260619000001_copy_predictions_on_join.sql` (linha 31)  
**Arquivo espelhado:** `db/migrations/20260619_copy_predictions_on_join.sql` (linha 31)  
**Severidade:** crítico

**Descrição:**

A função `copy_predictions_to_group` declara `v_pred predictions%ROWTYPE` mas o cursor `FOR ... IN SELECT` retorna apenas 5 colunas:

```sql
SELECT DISTINCT ON (game_id)
  user_id, game_id, home_score, away_score, submitted_at
FROM predictions
```

Em PostgreSQL, quando um cursor `FOR ... IN SELECT` itera para uma variável `%ROWTYPE`, o mapeamento é feito **por posição**, não por nome. A tabela `predictions` tem a seguinte ordem de colunas (após todas as migrations aplicadas em ordem):

1. `id` (uuid PK — criado em 20260613000003)
2. `user_id` (uuid — criado em 20260613000003)
3. `game_id` (uuid — criado em 20260613000003)
4. `home_score` (int — criado em 20260613000003)
5. `away_score` (int — criado em 20260613000003)
6. `submitted_at` (timestamptz — criado em 20260613000003)
7. `group_id` (uuid — adicionado via ADD COLUMN em 20260615120100)

O SELECT retorna 5 colunas na ordem `user_id, game_id, home_score, away_score, submitted_at`. Com `%ROWTYPE`, o mapeamento por posição resulta em:

| Posição | Coluna do SELECT | Campo do ROWTYPE mapeado | Valor real |
|---------|-----------------|--------------------------|------------|
| 1 | `user_id` | `id` | user_id do palpite |
| 2 | `game_id` | `user_id` | game_id do palpite |
| 3 | `home_score` | `game_id` | home_score numérico (cast implícito provavelmente falha) |
| 4 | `away_score` | `home_score` | away_score real |
| 5 | `submitted_at` | `away_score` | submitted_at (cast implícito provavelmente falha) |

Na melhor hipótese, o PostgreSQL levanta um erro de tipo durante o cast (int → uuid ou uuid → int), abortando a transação e impedindo que qualquer usuário entre no grupo mesmo com o tratamento de exceção (pois o erro ocorreria fora do bloco `BEGIN/EXCEPTION` individual do loop). Na pior hipótese — se os casts implícitos não falharem — os valores de `v_pred.home_score` e `v_pred.away_score` estariam incorretos no INSERT, copiando placares errados para o novo grupo.

**Correção esperada:**

Substituir a declaração de `v_pred` de `predictions%ROWTYPE` para `RECORD`. Com `RECORD`, o PostgreSQL mapeia por **nome** de coluna, e o SELECT parcial funciona corretamente:

```sql
-- ANTES (incorreto):
DECLARE
  v_pred predictions%ROWTYPE;

-- DEPOIS (correto):
DECLARE
  v_pred RECORD;
```

A mudança deve ser aplicada **em ambos os arquivos** da migration:
- `supabase/migrations/20260619000001_copy_predictions_on_join.sql` — linha 31
- `db/migrations/20260619_copy_predictions_on_join.sql` — linha 31

Nenhuma outra mudança é necessária: o `INSERT` que usa `v_pred.game_id`, `v_pred.home_score`, `v_pred.away_score` e `v_pred.submitted_at` continua funcionando corretamente após a mudança para `RECORD`.

**Referência:** O padrão correto para SELECT parcial em cursor PL/pgSQL é `RECORD`. A função `calculate_scores_for_game` usa corretamente `v_pred predictions%ROWTYPE` porque seu cursor executa `SELECT * FROM predictions` (todas as colunas). Esta nova função executa SELECT parcial, portanto exige `RECORD`.

---

## Itens OK (não precisam ser revisados novamente)

- Lógica de negócio de cópia (qual prediction copiar, critério `submitted_at DESC`, `DISTINCT ON (game_id)`) — correta
- Tratamento de erro com `RAISE WARNING` dentro de sub-bloco `BEGIN/EXCEPTION` — correto e alinhado com a spec
- `SECURITY DEFINER` em `copy_predictions_to_group` — justificado e consistente com outras funções do projeto
- Função trigger `trigger_copy_predictions_on_join` — correta
- Trigger `on_group_member_inserted` com `AFTER INSERT ON group_members FOR EACH ROW` — correto
- Idempotência da migration: `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — correto
- `ON CONFLICT (user_id, game_id, group_id) DO NOTHING` — correto para a constraint `predictions_user_game_group_unique`
- Chamada a `calculate_scores_for_game` para jogos `finished` após a cópia — correta e idempotente
- Endpoints `POST /api/groups/join` e `POST /api/invites/[id]/accept` não modificados — correto
- Nenhuma alteração de frontend — correto, a feature é transparente
- Commits em português com prefixos corretos (`chore`, `feat`) — correto
- Branch `feature/group-member-history` — correto
- Ambos os arquivos de migration (supabase/ e db/) são idênticos — correto
