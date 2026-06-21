# Spec: Correção — Estatísticas e Troféus na Aba de Perfil

**Slug:** fix-perfil-stats-trophies
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Corrigir dois problemas independentes na aba `/perfil`:

1. **Estatísticas distorcidas:** as taxas de acerto de vencedor, placar exato e média de pontos dividem pelo total de palpites enviados (incluindo jogos ainda `pending`), quando o denominador correto são apenas palpites em jogos `finished` ou `live` — únicos para os quais o resultado é conhecido.

2. **Troféus inacessíveis:** troféus classificados como `secret` escondem nome e descrição atrás de "🔒 ???"; troféus de qualquer status têm a descrição colapsada atrás de clique; desbloqueados ficam em grid separado dos demais. O redesign exige que todos os 15 troféus sejam visíveis no mesmo grid uniforme, com descrição sempre exposta.

---

## Histórias de Usuário

- Como participante, quero ver minhas taxas de acerto calculadas somente sobre jogos cujo resultado já saiu, para que os percentuais reflitam minha performance real e não sejam artificialmente rebaixados por palpites em jogos que ainda não aconteceram.
- Como participante, quero ver todos os troféus do sistema (desbloqueados e não-desbloqueados) com nome e descrição sempre visíveis, para saber quais conquistas existem e como obtê-las.

---

## Modelo de Dados

### Tabelas modificadas

Nenhuma tabela nova é criada. A migration modifica apenas a função `get_profile_stats`.

### Migration necessária

**Arquivo:** `supabase/migrations/20260622000005_fix_profile_stats_active_denominator.sql`

A migration recria `get_profile_stats` adicionando o campo `active_predictions_made` — contagem de palpites do usuário em jogos com `status IN ('finished', 'live')`. O campo `predictions_made` existente é mantido (conta todos os palpites, útil como métrica de engajamento).

```sql
CREATE OR REPLACE FUNCTION get_profile_stats(p_group_id uuid, p_user_id uuid)
RETURNS TABLE (
  predictions_made        bigint,
  active_predictions_made bigint,
  finished_games          bigint,
  winner_correct          bigint,
  exact_correct           bigint,
  total_points            bigint,
  best_streak             bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH finished AS (
    SELECT g.id, g.match_date
    FROM games g
    WHERE g.status = 'finished'
    ORDER BY g.match_date ASC, g.id ASC
  ),
  user_predictions AS (
    SELECT p.game_id, p.id AS prediction_id
    FROM predictions p
    WHERE p.user_id = p_user_id
      AND p.group_id = p_group_id
  ),
  active_user_predictions AS (
    SELECT p.game_id
    FROM predictions p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = p_user_id
      AND p.group_id = p_group_id
      AND g.status IN ('finished', 'live')
  ),
  user_scores AS (
    SELECT s.game_id,
           s.points,
           (s.breakdown->>'winner')::int AS winner_pts,
           (s.breakdown->>'exact')::int  AS exact_pts
    FROM scores s
    WHERE s.user_id = p_user_id
      AND s.group_id = p_group_id
  ),
  game_results AS (
    SELECT
      f.id AS game_id,
      ROW_NUMBER() OVER (ORDER BY f.match_date ASC, f.id ASC) AS rn,
      CASE
        WHEN us.winner_pts > 0 THEN 1
        ELSE 0
      END AS hit
    FROM finished f
    LEFT JOIN user_scores us ON us.game_id = f.id
  ),
  streak_groups AS (
    SELECT
      game_id,
      rn,
      hit,
      rn - ROW_NUMBER() OVER (PARTITION BY hit ORDER BY rn) AS grp
    FROM game_results
  ),
  best AS (
    SELECT COALESCE(MAX(cnt), 0) AS best_streak
    FROM (
      SELECT grp, COUNT(*) AS cnt
      FROM streak_groups
      WHERE hit = 1
      GROUP BY grp
    ) runs
  )
  SELECT
    (SELECT COUNT(*) FROM user_predictions)                                        AS predictions_made,
    (SELECT COUNT(*) FROM active_user_predictions)                                 AS active_predictions_made,
    (SELECT COUNT(*) FROM finished)                                                AS finished_games,
    (SELECT COUNT(*) FROM user_scores WHERE winner_pts > 0)                        AS winner_correct,
    (SELECT COUNT(*) FROM user_scores WHERE exact_pts > 0)                         AS exact_correct,
    (SELECT COALESCE(SUM(points), 0) FROM user_scores)                             AS total_points,
    (SELECT best_streak FROM best)                                                  AS best_streak
$$;
```

**Observação:** a migration usa `CREATE OR REPLACE` — é idempotente e não edita migrations já aplicadas. `active_predictions_made` inclui jogos `live` porque esses têm resultado parcial/oficial e o usuário pode ter pontuação parcial associada; excluí-los distorceria a taxa durante o dia de jogo.

---

## Backend — Endpoints

### GET /api/profile/performance

**Arquivo:** `app/api/profile/performance/route.ts`

**Mudança:** substituir o denominador das três taxas de `predictionsMade` por `activePredictionsMade`.

```typescript
// Antes (linha 81):
const predictionsMade = Number(stats.predictions_made)

// Depois — adicionar:
const activePredictionsMade = Number(stats.active_predictions_made)

// Cálculo das taxas (linhas 88-90) — substituir denominador:
const winnerRate = activePredictionsMade > 0 ? winnerCorrect / activePredictionsMade : 0
const exactRate  = activePredictionsMade > 0 ? exactCorrect / activePredictionsMade : 0
const avgPoints  = activePredictionsMade > 0 ? totalPoints / activePredictionsMade : 0
```

**Resposta JSON:** adicionar campo `active_predictions_made` mantendo `predictions_made` (engajamento).

```json
{
  "predictions_made": 20,
  "active_predictions_made": 12,
  "finished_games": 10,
  "winner_correct": 7,
  "exact_correct": 2,
  "total_points": 45,
  "winner_rate": 0.583,
  "exact_rate": 0.167,
  "avg_points": 3.750,
  "group_avg_points": 3.20,
  "avg_delta": 0.550,
  "current_streak": 3,
  "best_streak": 5
}
```

**Verificação de hasData no frontend:** o `PerformancePanel` usa `data.predictions_made > 0` para decidir se exibe os valores ou "—". Isso deve ser atualizado para `data.active_predictions_made > 0`.

**Denominação exibida no panel:** a fração exibida ao lado da barra (ex: `(7/20)`) deve passar a exibir `active_predictions_made` no denominador: `(winner_correct/active_predictions_made)`. A lógica visual está em `PerformancePanel.tsx` linhas 144–148 e 163–167 — substituir `data.predictions_made` por `data.active_predictions_made`.

---

### GET /api/profile/stats

**Arquivo:** `app/api/profile/stats/route.ts`

**Mudança:** mesma lógica — extrair `active_predictions_made` de `stats` e usá-lo como denominador.

```typescript
const activePredictionsMade = Number(stats.active_predictions_made)

const winnerRate = activePredictionsMade > 0 ? winnerCorrect / activePredictionsMade : 0
const exactRate  = activePredictionsMade > 0 ? exactCorrect / activePredictionsMade : 0
const avgPoints  = activePredictionsMade > 0 ? totalPoints / activePredictionsMade : 0
```

**Resposta JSON:** adicionar `active_predictions_made` mantendo `predictions_made`.

---

## Frontend — Componentes React

### PerformancePanel

**Arquivo:** `components/bolao/perfil/PerformancePanel.tsx`

**Interface `PerformanceData`:** adicionar campo:
```typescript
active_predictions_made: number
```

**Mudanças de lógica:**

1. `hasData`: mudar condição de `data.predictions_made > 0` para `data.active_predictions_made > 0`.
2. Fração no ACERTO DE VENCEDOR: substituir `data.predictions_made` por `data.active_predictions_made`.
3. Fração no PLACAR EXATO: mesma substituição.
4. Não alterar a exibição de `predictions_made` em outros lugares — o campo de contagem de palpites enviados (se houver no painel) permanece como engajamento total.

**Estados:** loading | error | populated — sem mudança estrutural.

**Comportamento:** sem alteração visual — apenas os números ficam corretos.

---

### TrophiesPanel

**Arquivo:** `components/bolao/perfil/TrophiesPanel.tsx`

**Remoção completa:**
- Estado `expandedId` (e todo o `useState` associado)
- Função `toggle`
- Separação em três listas (`unlocked`, `locked`, `secret`)
- Grid de 2 colunas para desbloqueados
- Separador entre seções
- Componente interno `TrophyRow` (substituído por renderização inline no grid único)
- Toda lógica de `expandedId === trophy.id` que escondia/mostrava descrição

**Nova estrutura de renderização:**

Todos os troféus renderizados em um único `div` com `display: grid; grid-template-columns: 1fr` (lista vertical, sem grid 2 colunas — mais espaço para a descrição sempre visível).

Para cada troféu, renderizar um elemento não-clicável (sem `onClick`, sem `role="button"`, sem `tabIndex`):

**Troféu desbloqueado** (`status === 'unlocked'`):
```
┌─────────────────────────────────────────────┐
│ ✓ NOME DO TROFÉU       · 14 JUN 2026       │   ← color-win, data em color-win
│   primeiro placar exato                     │   ← color-muted, 11px
└─────────────────────────────────────────────┘
```
- Nome: `color-win`, bold, uppercase
- Data de desbloqueio: `color-win`, alinhada à direita na mesma linha do nome
- Descrição (`TROPHY_CRITERIA[trophy.id]`): `color-muted`, 11px, sempre visível

**Troféu não-desbloqueado** (`status === 'locked'` **ou** `status === 'secret'`):
```
┌─────────────────────────────────────────────┐
│ ✗ NOME DO TROFÉU       3/5 ███░░            │   ← color-muted (barra se houver progresso)
│   critério para desbloquear                 │   ← color-muted, 11px
└─────────────────────────────────────────────┘
```
- Nome: `color-muted`, uppercase
- Barra de progresso (`progress/progress_max` + `renderBar`): exibida à direita do nome quando `progress !== null && progress_max`
- Descrição (`TROPHY_CRITERIA[trophy.id]`): `color-muted`, 11px, sempre visível
- Troféus `secret` são tratados exatamente como `locked`: exibem nome real e descrição real, sem "🔒 ???". O campo `secret: boolean` do tipo `Trophy` não tem mais uso na renderização.

**Props e tipos:** nenhuma mudança na interface `Trophy` ou `TrophiesData` — apenas a renderização muda.

**Cursor:** `cursor: default` em todos os elementos de troféu (sem `pointer`).

**Header:** mantém o contador `{unlocked.length} / {trophies.length}` — o cálculo de `unlocked` ainda ocorre, apenas para o contador do header. O restante da separação em listas é eliminado.

**Bordas entre troféus:** `borderBottom: '1px solid var(--color-border)'` em cada item, exceto o último.

**Padding:** `0.5rem 1rem` por item (ligeiramente mais que o atual `0.4rem` para acomodar a descrição sempre visível sem ficar apertado).

---

## Regras de Negócio

### Denominador correto das taxas

```
active_predictions_made = COUNT(predictions WHERE game.status IN ('finished', 'live'))

winner_rate = winner_correct / active_predictions_made   (quando active_predictions_made > 0)
exact_rate  = exact_correct  / active_predictions_made
avg_points  = total_points   / active_predictions_made
```

Jogos `pending` são excluídos do denominador porque o resultado não é conhecido — incluí-los mascara o desempenho real do participante.

Jogos `live` são incluídos porque têm placar em andamento e podem ter `scores` parciais já calculados (feature `live-scoring`). Excluí-los criaria inconsistência durante o dia de jogo.

### Troféus secretos

O conceito de `secret` é eliminado apenas na camada de exibição. O backend continua retornando `status: 'secret'` se aplicável — o frontend passa a tratar `secret` como `locked`. Nenhuma mudança no endpoint `/api/profile/trophies` ou na lógica de avaliação de troféus.

### Exibição de progresso

Barra de progresso (`renderBar`) é exibida somente para troféus não-desbloqueados com `progress !== null && progress_max !== null`. Troféus desbloqueados não exibem barra.

---

## Proteção de Rotas

Sem alteração. Os endpoints `/api/profile/performance` e `/api/profile/stats` já requerem Bearer JWT e verificam membership no grupo. Nenhuma rota nova é criada.

---

## Integração Supabase Realtime

Sem alteração. Esta feature não adiciona nem modifica subscrições Realtime.

---

## Critérios de Aceite

- [ ] Novo campo `active_predictions_made` retornado pela função Postgres `get_profile_stats`
- [ ] Migration `20260622000005_fix_profile_stats_active_denominator.sql` criada e aplicável via `supabase-migration`
- [ ] `GET /api/profile/performance` retorna `active_predictions_made` e usa esse campo como denominador de `winner_rate`, `exact_rate` e `avg_points`
- [ ] `GET /api/profile/stats` aplica a mesma correção de denominador
- [ ] `PerformanceData` tem campo `active_predictions_made: number`
- [ ] `PerformancePanel` usa `active_predictions_made` na condição `hasData` e nas frações exibidas
- [ ] `TrophiesPanel` não tem mais `expandedId`, `toggle`, separação em listas nem grid de 2 colunas
- [ ] Todos os 15 troféus aparecem no mesmo grid vertical único, independente do status
- [ ] Troféus com `status === 'secret'` exibem nome e descrição reais (tratados como `locked`)
- [ ] Descrição de cada troféu (`TROPHY_CRITERIA[trophy.id]`) visível sem nenhum clique
- [ ] Troféus desbloqueados exibem ✓ em `color-win` + data de desbloqueio
- [ ] Troféus não-desbloqueados exibem ✗ em `color-muted` + barra de progresso quando disponível
- [ ] Sem `cursor: pointer` nos itens de troféu (não são clicáveis)
- [ ] Design segue DESIGN.md: JetBrains Mono, tokens `var(--color-*)`, sem sombras, dark only, monospace denso
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
- [ ] Funciona em mobile (coluna única, descrição legível)
