# Spec: Perfil com Estatísticas

**Slug:** perfil-com-estatisticas
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Criar a página `/perfil` acessível pelo usuário logado (rota protegida no dashboard), exibindo o histórico de desempenho pessoal no grupo ativo: palpites feitos vs. jogos disponíveis, taxa de acerto de vencedor, taxa de placar exato, média de pontos por jogo, sequência atual de acertos e melhor sequência histórica de acertos. Todas as estatísticas são escopadas ao usuário logado + grupo ativo.

---

## Histórias de Usuário

- Como participante do bolão, quero ver meu desempenho pessoal no grupo ativo para entender como estou me saindo na competição.
- Como participante, quero saber minha taxa de acerto de vencedor e de placar exato para avaliar a qualidade dos meus palpites.
- Como participante, quero ver minha sequência atual de acertos e a minha melhor sequência histórica para identificar meu momento de melhor fase.
- Como participante, quero saber quantos palpites fiz versus quantos jogos encerraram para ter uma noção do meu engajamento.

---

## Modelo de Dados

### Tabelas existentes utilizadas (sem alterações)

- `profiles (id uuid, name text, avatar_url text)`
- `games (id uuid, match_date timestamptz, status text, round text)`
- `predictions (id uuid, user_id uuid, game_id uuid, group_id uuid, home_score int, away_score int, submitted_at timestamptz)`
- `scores (id uuid, user_id uuid, game_id uuid, group_id uuid, points int, breakdown jsonb, calculated_at timestamptz)`
- `group_members (group_id uuid, user_id uuid, role text)`

### Funções Postgres existentes reutilizadas

- `get_streak_for_group(p_group_id uuid)` — retorna `(user_id, streak bigint)` para todos os membros. Retorna a sequência atual de acertos consecutivos de cada membro. Criada em `20260621300000_create_streak_function.sql`.

### Migrations necessárias

#### Migration: `20260621400000_create_profile_stats_function.sql`

Cria a função `get_profile_stats(p_group_id uuid, p_user_id uuid)` que retorna uma única linha com as estatísticas pessoais do usuário no grupo.

```sql
CREATE OR REPLACE FUNCTION get_profile_stats(p_group_id uuid, p_user_id uuid)
RETURNS TABLE (
  predictions_made    bigint,
  finished_games      bigint,
  winner_correct      bigint,
  exact_correct       bigint,
  total_points        bigint,
  best_streak         bigint
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
  user_scores AS (
    SELECT s.game_id,
           s.points,
           (s.breakdown->>'winner')::int AS winner_pts,
           (s.breakdown->>'exact')::int  AS exact_pts
    FROM scores s
    WHERE s.user_id = p_user_id
      AND s.group_id = p_group_id
  ),
  -- Para best_streak: série de acertos consecutivos em janela histórica
  -- Percorre jogos finished em ordem cronológica; "acerto" = score presente com winner_pts > 0
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
  -- Grupos de sequência: atribuir um "grupo de corrida" a cada linha
  -- Rows com hit=1 consecutivas formam um grupo; hit=0 quebra o grupo
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
    (SELECT COUNT(*) FROM finished)                                                AS finished_games,
    (SELECT COUNT(*) FROM user_scores WHERE winner_pts > 0)                        AS winner_correct,
    (SELECT COUNT(*) FROM user_scores WHERE exact_pts > 0)                         AS exact_correct,
    (SELECT COALESCE(SUM(points), 0) FROM user_scores)                             AS total_points,
    (SELECT best_streak FROM best)                                                  AS best_streak
$$;
```

**Nota sobre `finished_games`:** A contagem de "jogos disponíveis" é o total de jogos com `status = 'finished'` no banco (sem filtro de grupo, pois os jogos são globais). Isso reflete quantos jogos encerraram para o qual o usuário poderia ter palpitado.

**Nota sobre `best_streak`:** A lógica usa a técnica de "ilha de sequências" (gaps-and-islands) com dois `ROW_NUMBER()`. Um jogo finished sem score (ausência de palpite ou score não calculado) conta como `hit=0`, quebrando a sequência. Isso é consistente com a definição de streak já estabelecida em `get_streak_for_group`.

---

## Backend — Endpoints Next.js (Route Handlers)

### GET /api/profile/stats

**Arquivo:** `app/api/profile/stats/route.ts`

**Autenticação:** requerida via Bearer JWT (mesmo padrão de `/api/ranking/route.ts`)

**Query params:**
- `group_id` (opcional): UUID do grupo ativo. Se ausente, lê o cookie `bolao_active_group` do header `Cookie` via `cookies()` do Next.js. Se cookie também ausente, retorna o primeiro grupo do usuário por `joined_at ASC` (mesmo fallback de `resolveActiveGroup()`).

**Lógica:**

1. Autenticar via `supabase.auth.getUser()` com o Bearer JWT (usar `createServiceClient()` para chamadas privilegiadas, ou `createClient()` para auth).
2. Verificar que `user_id` é membro do `group_id` resolvido — caso contrário, retornar 403.
3. Chamar via `Promise.all`:
   - RPC `get_profile_stats(group_id, user_id)` — retorna as 6 métricas
   - RPC `get_streak_for_group(group_id)` — retorna streak por usuário; filtrar pelo `user_id` para extrair `current_streak`
   - Query `profiles` para buscar `name` do usuário
   - Query `group_members JOIN groups` para buscar `group_name`
4. Calcular no JavaScript:
   - `winner_rate`: `winner_correct / predictions_made` (0 se `predictions_made = 0`)
   - `exact_rate`: `exact_correct / predictions_made` (0 se `predictions_made = 0`)
   - `avg_points`: `total_points / predictions_made` (0 se `predictions_made = 0`)
5. Retornar JSON com o shape abaixo.

**Resposta de sucesso (200):**
```json
{
  "user_name": "Hamon Vitorino",
  "group_name": "Bolão da Ingrisia ABJ",
  "predictions_made": 18,
  "finished_games": 24,
  "winner_correct": 13,
  "exact_correct": 3,
  "total_points": 76,
  "winner_rate": 0.722,
  "exact_rate": 0.167,
  "avg_points": 4.22,
  "current_streak": 3,
  "best_streak": 8
}
```

**Erros possíveis:**
- `401`: não autenticado (sem Bearer JWT válido)
- `403`: usuário não é membro do grupo
- `404`: grupo não encontrado
- `500`: erro interno na RPC ou query

---

## Frontend — Componentes React

### ProfilePage

**Arquivo:** `app/(dashboard)/perfil/page.tsx`

**Tipo:** Server Component (Next.js App Router)

**Props:** nenhuma (lê searchParams e cookies internamente)

**Lógica:**
1. Autenticar via `createClient()` + `supabase.auth.getUser()`. Se não autenticado, `redirect('/login')`.
2. Ler cookie `bolao_active_group` via `cookies()`.
3. Chamar `resolveActiveGroup()` com o padrão das demais páginas do dashboard.
4. Se `'error' in activeGroup`, exibir mensagem de erro com estilo `color-error`.
5. Buscar `profile.name` do usuário logado.
6. Passar `groupId` e `userId` para o Client Component `<ProfileStats>`.

**Estados:**
- Rota protegida: redirect para `/login` se não autenticado
- Erro de grupo: mensagem `✗ VOCÊ NÃO PARTICIPA DESTE GRUPO`

---

### ProfileStats

**Arquivo:** `components/bolao/ProfileStats.tsx`

**Tipo:** Client Component (`'use client'`)

**Props:**
```typescript
interface ProfileStatsProps {
  groupId: string
  userId: string
}
```

**Estados internos:** `loading | error | populated`

**Comportamento:**
1. No mount, faz `fetch('/api/profile/stats?group_id=<groupId>')` com `Authorization: Bearer <jwt>` (obtido via `supabase.auth.getSession()`).
2. Estado `loading`: exibe `CARREGANDO...` em `color-muted`, monospace.
3. Estado `error`: exibe `✗ ERRO AO CARREGAR ESTATÍSTICAS` em `color-error`.
4. Estado `populated`: renderiza o painel de estatísticas conforme layout abaixo.

**Layout de exibição (populated):**

O componente renderiza um painel estilo terminal, sem cards arredondados, sem sombras, com bordas `1px solid var(--color-border)`.

```
╔══════════════════════════════════════════════╗
║  PERFIL — HAMON VITORINO                     ║
╠══════════════════════════════════════════════╣
║  GRUPO: Bolão da Ingrisia ABJ                ║
╠══════════════════════════════════════════════╣
║  PALPITES FEITOS      18 / 24 jogos          ║
║  ACERTO DE VENCEDOR   72.2%  (13/18)         ║
║  PLACAR EXATO         16.7%  ( 3/18)         ║
║  MÉDIA DE PONTOS       4.2 pts/jogo          ║
║  SEQUÊNCIA ATUAL       3 acertos             ║
║  MELHOR SEQUÊNCIA      8 acertos             ║
╚══════════════════════════════════════════════╝
```

**Regras visuais específicas:**

- Cabeçalho (`PERFIL — NOME`) em `color-accent`, bold, uppercase, `font-size: 13px`
- Subheader (`GRUPO: NOME`) em `color-muted`, `font-size: 11px`, uppercase
- Linhas de stats: label em `color-muted` uppercase, valor em `color-text` bold
- Percentuais: `color-win` quando >= 50%, `color-muted` quando < 50%
- Separadores entre seções: `border-top: 1px solid var(--color-border)`
- `border-radius: 0` em todos os elementos
- `box-shadow: none`
- Fonte exclusivamente `JetBrains Mono, Courier New, monospace`
- `font-size: 13px` para labels, `font-size: 14px` para valores numéricos
- Coluna esquerda (labels) com `min-width: 11rem` para alinhamento em grid de duas colunas

**Formatação dos valores:**
- Percentuais: `(valor * 100).toFixed(1) + '%'` — ex: `72.2%`
- Média de pontos: `valor.toFixed(1) + ' pts/jogo'` — ex: `4.2 pts/jogo`
- Palpites feitos: `N / M jogos` onde N = `predictions_made`, M = `finished_games`
- Acerto de vencedor: `XX.X% (N/M)` onde N = `winner_correct`, M = `predictions_made`
- Placar exato: `XX.X% (N/M)` onde N = `exact_correct`, M = `predictions_made`
- Sequência atual: `N acertos` — se 0, exibir `0 acertos` em `color-muted`
- Melhor sequência: `N acertos` — se 0, exibir `0 acertos` em `color-muted`

**Supabase Realtime:** não — a página de perfil é estática (fetch único no mount, sem canal Realtime). O usuário pode recarregar a página para atualizar.

---

## Regras de Negócio

1. **Escopo de grupo**: todas as estatísticas são calculadas com `group_id = grupo_ativo`. Palpites em outros grupos do mesmo usuário não são contabilizados.

2. **`finished_games` é global por design**: conta todos os jogos com `status = 'finished'` no banco, independentemente de grupo, pois `games` é uma tabela global compartilhada. Isso representa todos os jogos que já encerraram para os quais o usuário poderia ter palpitado.

3. **`predictions_made`**: conta `predictions WHERE user_id = ? AND group_id = ?` — apenas palpites feitos pelo usuário naquele grupo específico.

4. **`winner_correct`**: conta `scores WHERE user_id = ? AND group_id = ? AND (breakdown->>'winner')::int > 0`. Inclui empates acertados (empate conta como acerto de vencedor, conforme CLAUDE.md).

5. **`exact_correct`**: conta `scores WHERE user_id = ? AND group_id = ? AND (breakdown->>'exact')::int > 0`.

6. **`avg_points`**: `total_points / predictions_made`, onde `total_points = SUM(scores.points)`. Se `predictions_made = 0`, retorna `0.0`.

7. **`current_streak`**: extraído de `get_streak_for_group()` para o `user_id` — a sequência atual de acertos consecutivos contando do jogo mais recente para trás. Valor `0` indica que o último jogo encerrado foi um erro ou sem palpite.

8. **`best_streak`**: calculado por `get_profile_stats()` — a maior janela de acertos consecutivos em toda a história de jogos encerrados. Usa lógica de gaps-and-islands em SQL. Inclui somente jogos `finished`. Jogo sem palpite (ausência em `scores`) conta como quebra de sequência, consistente com a definição de `get_streak_for_group`.

9. **Divisão por zero**: quando `predictions_made = 0`, `winner_rate`, `exact_rate` e `avg_points` são todos `0`. Exibir `—` (traço) em vez de `0%` ou `0.0` nos percentuais quando não há palpites, para evitar ambiguidade (zero acertos vs. sem dados).

10. **Autorização**: o endpoint `/api/profile/stats` valida membership do usuário no grupo via query em `group_members`. Um usuário não pode ver o perfil de outro usuário via este endpoint (o `user_id` é sempre o do JWT, nunca de query param externo).

---

## Proteção de Rotas

- `/perfil` é uma rota dentro do grupo `(dashboard)` do Next.js App Router, que já tem proteção no `layout.tsx` via `supabase.auth.getUser()` + `redirect('/login')`.
- A página `perfil/page.tsx` deve repetir a verificação de autenticação (padrão das demais páginas do dashboard) e chamar `resolveActiveGroup()`.
- O endpoint `GET /api/profile/stats` deve autenticar via Bearer JWT (`Authorization: Bearer <jwt>`) — sem depender de cookie de sessão. Seguir o padrão de `app/api/ranking/route.ts`.

---

## Integração Supabase Realtime

Não aplicável — a página de perfil não usa Realtime. Os dados são carregados uma vez no mount do Client Component. Para ver dados atualizados, o usuário recarrega a página.

---

## Navegação: Link no Menu

Adicionar entrada em `app/(dashboard)/nav-links.tsx`:

```typescript
{ href: '/perfil', label: 'PERFIL' },
```

Inserir após `{ href: '/configuracoes', label: 'CONFIG' }` ou onde o Programador julgar melhor dentro do array `NAV_ITEMS`, mantendo coerência de ordenação com os demais itens. A label deve ser `PERFIL` (sem o nome do usuário, para manter o padrão de labels curtas do menu).

**Atenção:** o menu já tem 6 itens com scroll horizontal em mobile. Adicionar um 7º item é viável dado que o menu usa `overflowX: auto` — verificar que nenhum item existente some em viewport estreita.

---

## Critérios de Aceite

- [ ] Página `/perfil` acessível quando logado — redirect para `/login` quando não autenticado
- [ ] Link `PERFIL` aparece na barra de navegação (`nav-links.tsx`) e fica ativo quando em `/perfil`
- [ ] Página exibe nome do usuário logado no cabeçalho (`PERFIL — NOME`)
- [ ] Página exibe nome do grupo ativo (`GRUPO: NOME`)
- [ ] Estatística `PALPITES FEITOS` exibe `N / M jogos` corretamente
- [ ] Estatística `ACERTO DE VENCEDOR` exibe percentual com breakdown `(N/M)`
- [ ] Estatística `PLACAR EXATO` exibe percentual com breakdown `(N/M)`
- [ ] Estatística `MÉDIA DE PONTOS` exibe valor com uma casa decimal + `pts/jogo`
- [ ] Estatística `SEQUÊNCIA ATUAL` exibe o valor retornado por `get_streak_for_group` para o usuário
- [ ] Estatística `MELHOR SEQUÊNCIA` exibe o maior streak histórico calculado por `get_profile_stats`
- [ ] Quando `predictions_made = 0`, percentuais exibem `—` em vez de `0.0%`
- [ ] Migration `20260621400000_create_profile_stats_function.sql` cria a função `get_profile_stats` sem erros
- [ ] Endpoint `GET /api/profile/stats` retorna 401 sem JWT válido
- [ ] Endpoint retorna 403 se o usuário não for membro do `group_id`
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, sem border-radius excessivo, sem sombras, sem ícones decorativos, dense, uppercase nos labels
- [ ] Funciona em mobile (coluna única, viewport 375px) sem scroll horizontal
- [ ] `npm run lint` e `npm run build` passam sem erros novos
