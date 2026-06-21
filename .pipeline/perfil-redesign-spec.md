# Spec: Redesign da Aba de Perfil

**Slug:** `perfil-redesign`
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Transformar a aba `/perfil` de uma lista seca de 6 estatísticas em um painel rico com 4 seções empilhadas verticalmente: (1) SUA CAMPANHA — herói com posição/pontos/movimento; (2) DESEMPENHO — barras ASCII, comparação com média do grupo, sequência em pílulas; (3) TROFÉUS — sistema completo de 15 medalhas com 3 estados; (4) HISTÓRICO — feed cronológico paginado com palpites e pontos, incluindo jogos "furados". Design rigorosamente fiel ao DESIGN.md (Elifoot, JetBrains Mono, tokens CSS da bandeira, sem sombras, dark only).

---

## Histórias de Usuário

- Como participante, quero ver minha posição atual e quantos pontos tenho no grupo, para saber onde estou na campanha.
- Como participante, quero ver se subi ou desci de posição desde a última rodada, para acompanhar minha evolução.
- Como participante, quero ver minhas taxas de acerto com barras visuais e comparação com a média do grupo, para contextualizar meu desempenho.
- Como participante, quero ver medalhas conquistadas e o progresso das que ainda não desbloqueei, para ter metas de jogo.
- Como participante, quero ver um feed cronológico dos jogos encerrados com meu palpite e pontos, para revisar minha campanha jogo a jogo.
- Como participante, quero ver marcados os jogos que encerrei sem palpitar, para ter consciência dos "furos".

---

## Modelo de Dados

### Tabela nova: `position_snapshots`

```sql
CREATE TABLE position_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_day    date NOT NULL,         -- dia que fechou (games.match_day)
  rank_position int NOT NULL,
  total_points  int NOT NULL,
  snapshot_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, match_day)
);

CREATE INDEX idx_position_snapshots_group_user ON position_snapshots (group_id, user_id, match_day DESC);
```

**RLS:** Leitura pública para membros do grupo; inserção exclusivamente via função `SECURITY DEFINER` (trigger). Sem UPDATE nem DELETE por usuários.

```sql
ALTER TABLE position_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read own group snapshots"
  ON position_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = position_snapshots.group_id
        AND gm.user_id = auth.uid()
    )
  );
```

### Função `record_position_snapshots(p_group_id uuid, p_match_day date)`

Grava snapshots para todos os membros de um grupo para um dado `match_day`. Deve ser idempotente via `ON CONFLICT DO NOTHING`.

```sql
CREATE OR REPLACE FUNCTION record_position_snapshots(p_group_id uuid, p_match_day date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO position_snapshots (group_id, user_id, match_day, rank_position, total_points)
  SELECT
    p_group_id,
    r.user_id,
    p_match_day,
    r.rank_position::int,
    r.total_points::int
  FROM get_ranking(p_group_id) r
  ON CONFLICT (group_id, user_id, match_day) DO NOTHING;
$$;
```

### Trigger para auto-snapshot ao fechar dia

Sempre que o último jogo de um `match_day` passa para `status = 'finished'`, gravar snapshot para todos os grupos que têm ao menos um palpite naquele dia.

```sql
CREATE OR REPLACE FUNCTION trigger_snapshot_on_day_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_day date;
  v_remaining int;
  rec record;
BEGIN
  -- Só processa quando muda para 'finished'
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;

  v_match_day := NEW.match_day;

  -- Conta jogos do mesmo dia que NÃO estão finished ainda (excluindo o próprio)
  SELECT COUNT(*) INTO v_remaining
  FROM games
  WHERE match_day = v_match_day
    AND status <> 'finished'
    AND id <> NEW.id;

  -- Se ainda há jogos não encerrados no dia, não grava snapshot
  IF v_remaining > 0 THEN
    RETURN NEW;
  END IF;

  -- Grava snapshot para cada grupo que tem palpite nesse dia
  FOR rec IN
    SELECT DISTINCT p.group_id
    FROM predictions p
    JOIN games g ON g.id = p.game_id
    WHERE g.match_day = v_match_day
  LOOP
    PERFORM record_position_snapshots(rec.group_id, v_match_day);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_on_day_close ON games;
CREATE TRIGGER trg_snapshot_on_day_close
  AFTER UPDATE OF status ON games
  FOR EACH ROW
  EXECUTE FUNCTION trigger_snapshot_on_day_close();
```

### Função `get_group_avg_points(p_group_id uuid)`

Retorna a média de pontos por jogo encerrado de todos os membros do grupo.

```sql
CREATE OR REPLACE FUNCTION get_group_avg_points(p_group_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    CASE
      WHEN COUNT(s.id) = 0 THEN 0
      ELSE ROUND(SUM(s.points)::numeric / COUNT(DISTINCT (s.user_id, s.game_id))::numeric, 2)
    END
  FROM scores s
  WHERE s.group_id = p_group_id;
$$;
```

### Função `get_profile_history(p_group_id uuid, p_user_id uuid, p_limit int, p_offset int)`

Feed cronológico paginado de jogos encerrados para a seção HISTÓRICO.

```sql
CREATE OR REPLACE FUNCTION get_profile_history(
  p_group_id uuid,
  p_user_id  uuid,
  p_limit    int DEFAULT 20,
  p_offset   int DEFAULT 0
)
RETURNS TABLE (
  game_id       uuid,
  match_day     date,
  home_team     text,
  away_team     text,
  home_score    int,
  away_score    int,
  pred_home     int,        -- NULL se furou
  pred_away     int,        -- NULL se furou
  points        int,        -- 0 se furou
  breakdown     jsonb,      -- NULL se furou
  is_miss       boolean     -- TRUE se jogou sem palpite
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    g.id                                          AS game_id,
    g.match_day,
    g.home_team,
    g.away_team,
    g.home_score,
    g.away_score,
    p.home_score                                  AS pred_home,
    p.away_score                                  AS pred_away,
    COALESCE(s.points, 0)                         AS points,
    s.breakdown,
    (p.id IS NULL)                                AS is_miss
  FROM games g
  LEFT JOIN predictions p
    ON p.game_id = g.id
   AND p.user_id = p_user_id
   AND p.group_id = p_group_id
  LEFT JOIN scores s
    ON s.game_id = g.id
   AND s.user_id = p_user_id
   AND s.group_id = p_group_id
  WHERE g.status = 'finished'
  ORDER BY g.match_day DESC, g.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
```

### Migrations necessárias

1. `20260622000001_create_position_snapshots.sql` — tabela `position_snapshots` + RLS + índice
2. `20260622000002_create_snapshot_functions.sql` — função `record_position_snapshots` + trigger `trg_snapshot_on_day_close`
3. `20260622000003_create_group_avg_points.sql` — função `get_group_avg_points`
4. `20260622000004_create_profile_history.sql` — função `get_profile_history`

---

## Backend — Endpoints Next.js Route Handlers

A escolha por Route Handlers (em vez de Server Components diretos) segue o padrão estabelecido em `/app/api/profile/stats/route.ts`: autenticação via Bearer JWT, service client para bypass de RLS, e respostas JSON consumidas pelo componente client-side. O componente `ProfileStats` atual já é `'use client'` e consulta `/api/profile/stats` — o redesign mantém esse padrão para não quebrar o fluxo de loading/error estabelecido.

### GET /api/profile/campaign

Retorna dados da seção SUA CAMPANHA: posição atual, pontos totais, movimento de posição.

**Autenticação:** requerida (Bearer JWT)

**Query params:** `group_id` (UUID)

**Resposta de sucesso (200):**
```json
{
  "rank_position": 3,
  "total_points": 47,
  "participant_count": 8,
  "leader_points": 58,
  "next_above_points": 51,
  "position_delta": 2,
  "position_delta_label": "▲2 desde a última rodada",
  "is_leader": false
}
```

**Lógica de `position_delta`:**
1. Buscar posição atual via `get_ranking(p_group_id)` para o `user_id`.
2. Buscar o snapshot mais recente de `position_snapshots` onde `group_id = p_group_id AND user_id = p_user_id` ordenado por `match_day DESC LIMIT 1`.
3. `delta = snapshot.rank_position - current_rank_position` (positivo = subiu, negativo = desceu).
4. Se não há snapshot, `position_delta = null` e `position_delta_label = "sem rodadas encerradas"`.
5. Label: `delta > 0 → "▲{delta} desde a última rodada"`, `delta < 0 → "▼{abs(delta)} desde a última rodada"`, `delta = 0 → "= mesma posição"`.

**`leader_points`:** pontos do 1º colocado. **`next_above_points`:** pontos do participante na posição imediatamente acima. Se o usuário for líder, ambos são `null` e `is_leader = true`.

**Erros possíveis:**
- 401: não autenticado
- 403: não é membro do grupo
- 500: erro interno

### GET /api/profile/performance

Retorna dados da seção DESEMPENHO. Agrega o endpoint existente `/api/profile/stats` + média do grupo.

**Autenticação:** requerida (Bearer JWT)

**Query params:** `group_id` (UUID)

**Resposta de sucesso (200):**
```json
{
  "predictions_made": 22,
  "finished_games": 24,
  "winner_correct": 15,
  "exact_correct": 3,
  "total_points": 47,
  "winner_rate": 0.681,
  "exact_rate": 0.136,
  "avg_points": 2.136,
  "group_avg_points": 2.8,
  "avg_delta": -0.664,
  "current_streak": 4,
  "best_streak": 6
}
```

**Lógica:** Chama `get_profile_stats`, `get_streak_for_group`, e `get_group_avg_points` em paralelo via `Promise.all`. `avg_delta = avg_points - group_avg_points`.

**Nota:** O endpoint existente `/api/profile/stats` retorna um subconjunto desses campos. O novo endpoint `/api/profile/performance` o substitui e adiciona `group_avg_points` e `avg_delta`. O componente `ProfileStats` será substituído pelo redesign — o endpoint `/api/profile/stats` pode ser deprecado mas não removido nesta feature para evitar regressão em outros consumidores (verificar se há outros).

**Erros possíveis:**
- 401: não autenticado
- 403: não é membro do grupo
- 500: erro interno

### GET /api/profile/trophies

Retorna o estado dos 15 troféus para o usuário no grupo.

**Autenticação:** requerida (Bearer JWT)

**Query params:** `group_id` (UUID)

**Resposta de sucesso (200):**
```json
{
  "trophies": [
    {
      "id": "estreia",
      "name": "ESTREIA",
      "status": "unlocked",
      "unlocked_at": "2026-06-11T15:30:00Z",
      "progress": null,
      "progress_max": null,
      "secret": false
    },
    {
      "id": "profeta",
      "name": "PROFETA",
      "status": "locked",
      "unlocked_at": null,
      "progress": 3,
      "progress_max": 5,
      "secret": false
    },
    {
      "id": "zebreiro",
      "name": "???",
      "status": "secret",
      "unlocked_at": null,
      "progress": null,
      "progress_max": null,
      "secret": true
    }
  ]
}
```

**Lógica:** Ver seção "Sistema de Troféus" abaixo para a derivação de cada um dos 15.

**Erros possíveis:**
- 401: não autenticado
- 403: não é membro do grupo
- 500: erro interno

### GET /api/profile/history

Feed cronológico paginado de jogos encerrados.

**Autenticação:** requerida (Bearer JWT)

**Query params:** `group_id` (UUID), `limit` (int, default 20, max 50), `offset` (int, default 0)

**Resposta de sucesso (200):**
```json
{
  "items": [
    {
      "game_id": "uuid",
      "match_day": "2026-06-14",
      "home_team": "BRA",
      "away_team": "ARG",
      "home_score": 3,
      "away_score": 1,
      "pred_home": 3,
      "pred_away": 1,
      "points": 8,
      "breakdown": {"winner": 3, "exact": 5, "winner_score": 0, "diff": 0, "loser_score": 0, "goleada": 0},
      "is_miss": false,
      "trophy_unlocked_id": "cravada"
    }
  ],
  "total": 48,
  "has_more": true
}
```

**`trophy_unlocked_id`:** ID do troféu desbloqueado naquele jogo específico, se houver. Calculado no backend comparando a data de conquista de cada troféu com o `match_day` do jogo. Se múltiplos troféus foram desbloqueados no mesmo dia, retornar apenas o de maior raridade (ordem de prioridade: placar_exato > sequencia > outros). Retorna `null` se nenhum.

**`total`:** total de jogos encerrados no grupo (para o botão "ver mais").

**Erros possíveis:**
- 401: não autenticado
- 403: não é membro do grupo
- 422: `limit` fora do intervalo 1–50
- 500: erro interno

---

## Sistema de Troféus — Os 15

Todos calculados no Route Handler `/api/profile/trophies` via queries ao Supabase com `serviceClient`. A maioria usa dados já existentes em `scores.breakdown` e `predictions`. Os que dependem de `position_snapshots` só ficam disponíveis após o primeiro snapshot gravado.

### Definições e lógica de derivação

| # | ID | Nome | Critério | Estado inicial | Progresso mensurável |
|---|---|---|---|---|---|
| 1 | `estreia` | ESTREIA | 1º palpite enviado (qualquer jogo do grupo) | secret | não |
| 2 | `abriu_o_placar` | ABRIU O PLACAR | 1º acerto de vencedor (`breakdown->winner > 0`) | secret | não |
| 3 | `cravada` | CRAVADA | 1º placar exato (`breakdown->exact > 0`) | locked+progress | sim (N/5) |
| 4 | `rei_da_goleada` | REI DA GOLEADA | 1º bônus de goleada (`breakdown->goleada > 0`) | secret | não |
| 5 | `embalado` | EMBALADO | sequência de 3 acertos de vencedor consecutivos | locked+progress | sim (N/3) |
| 6 | `em_chamas` | EM CHAMAS | sequência de 5 | locked+progress | sim (N/5) |
| 7 | `imparavel` | IMPARÁVEL | sequência de 8 | locked+progress | sim (N/8) |
| 8 | `profeta` | PROFETA | 5 placares exatos no total | locked+progress | sim (N/5) |
| 9 | `vidente` | VIDENTE | 25 acertos de vencedor no total | locked+progress | sim (N/25) |
| 10 | `artilheiro` | ARTILHEIRO | 100 pontos acumulados no grupo | locked+progress | sim (N/100) |
| 11 | `perfeito_na_rodada` | PERFEITO NA RODADA | acertou o vencedor de TODOS os jogos de um `match_day` (ao menos 2 jogos naquele dia) | secret | não |
| 12 | `fiel` | FIEL | palpitou em TODOS os jogos de um `match_day` (ao menos 2 jogos naquele dia) | locked+progress | não (binário por rodada) |
| 13 | `cartola` | CARTOLA | já ocupou o 1º lugar em ao menos um snapshot de `position_snapshots` | secret | não |
| 14 | `zebreiro` | ZEBREIRO | acertou o vencedor num jogo em que a maioria do grupo errou (mais de 50% dos membros com palpite erraram) | secret | não |
| 15 | `podio` | PÓDIO | fechou uma rodada (match_day com snapshot) no top 3 | secret | não |

**Estado "secret":** a UI exibe `🔒 ???` e "troféu secreto" sem revelar o critério. Após desbloqueio, exibe nome + critério completo + data.

**Estado "locked+progress":** exibe nome, critério com dica, e barra/contagem de progresso.

**Estado "unlocked":** exibe `✓`, nome e data de conquista.

### Queries SQL por troféu

**estreia** — `unlocked_at` = `MIN(submitted_at)` em `predictions WHERE user_id = p_user_id AND group_id = p_group_id`

**abriu_o_placar** — `unlocked_at` = data do jogo do primeiro score com `breakdown->>'winner'::int > 0` (via `games.match_date`)

**cravada** — `unlocked_at` = data do primeiro score com `breakdown->>'exact'::int > 0`. `progress` = `COUNT(*)` de scores com `exact > 0`; goal = 5.

**rei_da_goleada** — `unlocked_at` = data do primeiro score com `breakdown->>'goleada'::int > 0`.

**embalado / em_chamas / imparavel** — Derivar do `best_streak` já calculado em `get_profile_stats`. Se `best_streak >= 3`, EMBALADO desbloqueado. Se `>= 5`, EM CHAMAS. Se `>= 8`, IMPARÁVEL. `progress` = `best_streak` no momento. `unlocked_at`: buscar via `get_profile_history` completo (sem paginação, só game_ids) + reconstrução da sequência cronologicamente para achar o jogo exato onde atingiu o threshold — implementar como CTE recursiva ou no JavaScript iterando o histórico completo.

**Implementação de `unlocked_at` para sequências (simplificado):** Como derivar a data exata de desbloqueio de uma sequência via SQL é complexo, usar a seguinte heurística aceitável: `unlocked_at` = `match_date` do jogo na posição `threshold` da maior sequência (`best_streak`). Calcular via query retornando `game_id` e `rn` da sequência vencedora da função `get_streak_for_group` adaptada para histórico individual. Ver subseção abaixo.

**profeta** — `progress` = `COUNT(*)` de scores com `exact > 0`. `unlocked_at` = data do 5º placar exato. Query: `SELECT match_date FROM games g JOIN scores s ON s.game_id = g.id WHERE s.user_id = p_user_id AND s.group_id = p_group_id AND (s.breakdown->>'exact')::int > 0 ORDER BY g.match_date ASC LIMIT 1 OFFSET 4`.

**vidente** — `progress` = `COUNT(*)` de scores com `winner > 0`. `unlocked_at` = data do 25º acerto. Mesmo padrão do profeta com `OFFSET 24`.

**artilheiro** — `progress` = `SUM(points)`. `unlocked_at` = data do jogo que levou o total acima de 100. Query: soma acumulada ordenada por data, encontrar primeiro jogo onde `running_total >= 100`.

```sql
-- Exemplo de CTE para artilheiro
WITH cumulative AS (
  SELECT g.match_date,
         SUM(s.points) OVER (ORDER BY g.match_date ASC, g.id ASC) AS running_total
  FROM scores s
  JOIN games g ON g.id = s.game_id
  WHERE s.user_id = p_user_id AND s.group_id = p_group_id
)
SELECT MIN(match_date) FROM cumulative WHERE running_total >= 100;
```

**perfeito_na_rodada** — Para cada `match_day` com `>= 2` jogos `finished`: verificar se `COUNT(games) = COUNT(scores com winner > 0)` para o usuário. `unlocked_at` = data do primeiro `match_day` em que isso ocorreu.

**fiel** — Para cada `match_day` com `>= 2` jogos `finished`: verificar se `COUNT(predictions do usuário naquele dia) = COUNT(games finished naquele dia)`. `unlocked_at` = data do primeiro `match_day` em que isso ocorreu.

**cartola** — `SELECT COUNT(*) > 0 FROM position_snapshots WHERE group_id = p_group_id AND user_id = p_user_id AND rank_position = 1`. `unlocked_at` = `MIN(snapshot_at)` quando `rank_position = 1`.

**zebreiro** — Jogo onde o usuário acertou o vencedor E a maioria do grupo errou. "Maioria" = mais de 50% dos membros que palpitaram naquele jogo erraram o vencedor.
```sql
-- Lógica:
-- Para cada game onde o usuário tem winner > 0:
--   contar total de palpites do grupo naquele game
--   contar palpites do grupo com winner > 0 no score
--   se (erros / total) > 0.5, é zebreiro
```
`unlocked_at` = data do jogo mais antigo que satisfaz o critério.

**podio** — `SELECT COUNT(*) > 0 FROM position_snapshots WHERE group_id = p_group_id AND user_id = p_user_id AND rank_position <= 3`. `unlocked_at` = `MIN(snapshot_at)` quando `rank_position <= 3`.

### Organização no Route Handler

O handler `/api/profile/trophies` executa as queries necessárias em paralelo (usando `Promise.all`) e monta o array de 15 objetos com estado, progresso e `unlocked_at`. A ordenação da resposta: desbloqueados primeiro (por data), depois locked com progresso, depois secretos.

---

## Frontend — Componentes React

### Arquitetura da página

`app/(dashboard)/perfil/page.tsx` continua sendo um Server Component que apenas resolve o grupo ativo e passa `groupId` + `userId` ao novo componente container. O componente container `PerfilDashboard` é `'use client'` e orquestra as 4 seções.

### `PerfilDashboard`
**Arquivo:** `components/bolao/perfil/PerfilDashboard.tsx`
**Props:**
```typescript
interface PerfilDashboardProps {
  groupId: string
  userId: string
}
```
**Responsabilidade:** Orquestrar os 4 painéis. Fazer fetch de `/api/profile/campaign`, `/api/profile/performance`, `/api/profile/trophies` e os primeiros 20 itens de `/api/profile/history` **em paralelo** no `useEffect` inicial. Cada seção recebe seu próprio estado de loading/error separado — se CAMPANHA falha, DESEMPENHO ainda aparece.

**Estado:**
```typescript
type SectionState<T> = { status: 'loading' } | { status: 'error'; message?: string } | { status: 'populated'; data: T }
```

### `CampaignPanel`
**Arquivo:** `components/bolao/perfil/CampaignPanel.tsx`
**Props:**
```typescript
interface CampaignPanelProps {
  state: SectionState<CampaignData>
}

interface CampaignData {
  rank_position: number
  total_points: number
  participant_count: number
  leader_points: number | null
  next_above_points: number | null
  position_delta: number | null
  position_delta_label: string
  is_leader: boolean
}
```

**Wireframe:**
```
┌─ SUA CAMPANHA ──────────────────────────────┐
│                                              │
│        #3        47 PTS                      │
│     POSIÇÃO     NO GRUPO                     │
│                                              │
│  LÍDER  58  (-11)      PRÓXIMO  51  (-4)     │
│                                              │
│  ▲2 DESDE A ÚLTIMA RODADA                    │
└─────────────────────────────────────────────┘
```

**Regras de cor:**
- `#1` → `color-accent`; demais posições → `color-text`
- `position_delta > 0` → label em `color-win`; `< 0` → `color-error`; `= 0` → `color-muted`
- Variante líder: linha inferior mostra `LÍDER 🟡 · +{delta} SOBRE O 2º`

**Estado loading:** exibir linha em `color-muted` com `CARREGANDO...`
**Estado error:** exibir `✗ ERRO AO CARREGAR CAMPANHA` em `color-error`

### `PerformancePanel`
**Arquivo:** `components/bolao/perfil/PerformancePanel.tsx`
**Props:**
```typescript
interface PerformancePanelProps {
  state: SectionState<PerformanceData>
}

interface PerformanceData {
  predictions_made: number
  finished_games: number
  winner_correct: number
  exact_correct: number
  total_points: number
  winner_rate: number
  exact_rate: number
  avg_points: number
  group_avg_points: number
  avg_delta: number
  current_streak: number
  best_streak: number
}
```

**Wireframe:**
```
┌─ DESEMPENHO ────────────────────────────────┐
│ ACERTO DE VENCEDOR   68%  ███████░░░  (15/22)│
│ PLACAR EXATO         12%  █░░░░░░░░░  (3/22) │
│ MÉDIA DE PONTOS      3.4 pts/jogo            │
│                      grupo 2.8  ▲ +0.6       │
│ SEQUÊNCIA            ●●●●○  4 atual · 6 melhor│
└─────────────────────────────────────────────┘
```

**Função `renderBar(rate: number, width: number = 10): string`:**
```typescript
function renderBar(rate: number, width: number = 10): string {
  const filled = Math.round(rate * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
```

**Regras de cor das barras:**
- `winner_rate >= 0.5` → barra em `color-win`; `< 0.5` → `color-muted`
- `exact_rate >= 0.5` → `color-win`; `< 0.5` → `color-muted`

**Sequência em pílulas:** `current_streak` pílulas `●` em `color-win` + pílulas `○` em `color-muted` até completar `max(current_streak, best_streak, 5)`. Exibir no máximo 10 pílulas para não transbordar no mobile.

**Comparação média:**
- `avg_delta > 0` → `▲ +{delta.toFixed(1)}` em `color-win`
- `avg_delta < 0` → `▼ {delta.toFixed(1)}` em `color-error`
- `avg_delta = 0` → `= grupo` em `color-muted`

### `TrophiesPanel`
**Arquivo:** `components/bolao/perfil/TrophiesPanel.tsx`
**Props:**
```typescript
interface TrophiesPanelProps {
  state: SectionState<TrophiesData>
}

interface Trophy {
  id: string
  name: string           // "???" se secret e locked
  status: 'unlocked' | 'locked' | 'secret'
  unlocked_at: string | null  // ISO 8601
  progress: number | null
  progress_max: number | null
  secret: boolean
}

interface TrophiesData {
  trophies: Trophy[]
}
```

**Wireframe:**
```
┌─ TROFÉUS  ·  7 / 15 ────────────────────────┐
│ ✓ ESTREIA          ✓ ABRIU O PLACAR          │
│ ✓ CRAVADA          ✓ REI DA GOLEADA          │
│ ✓ EMBALADO         ✓ CARTOLA   ✓ ZEBREIRO    │
│ ─────────────────────────────────────────────│
│ ✗ PROFETA          3/5 ███░░  placares exatos │
│ ✗ EM CHAMAS        4/5 ████░  sequência       │
│ ✗ ARTILHEIRO      47/100 pts                  │
│ 🔒 ???             troféu secreto             │
└─────────────────────────────────────────────┘
```

**Layout:** desbloqueados em grid 2 colunas. Separador `──────`. Locked em lista (1 por linha com progress). Secretos agrupados abaixo dos locked.

**Interação de expansão:** clicar/tocar em um troféu abre uma linha expandida com a descrição completa. Usar `useState<string | null>(expandedId)`. Sem modal — expansão inline accordion.

**Critérios de exibição por estado:**
- `unlocked`: `✓ {name}` em `color-win`. Expandido: `{critério} · {data formatada DD MMM YYYY}`.
- `locked`: `✗ {name}` em `color-muted`. Expandido: `{dica do critério}` + barra de progresso `{progress}/{max} {renderBar(progress/max, 5)}` em `color-muted`.
- `secret`: `🔒 ???` em `color-muted`. Expandido: `troféu secreto — desbloqueie para descobrir`.

**Dicas de critério por troféu (string constante no frontend):**
```typescript
const TROPHY_HINTS: Record<string, string> = {
  cravada: 'placares exatos',
  embalado: 'sequência de acertos',
  em_chamas: 'sequência de acertos',
  imparavel: 'sequência de acertos',
  profeta: 'placares exatos',
  vidente: 'acertos de vencedor',
  artilheiro: 'pts acumulados',
  fiel: 'palpitou em todos os jogos do dia',
}
```

### `HistoryPanel`
**Arquivo:** `components/bolao/perfil/HistoryPanel.tsx`
**Props:**
```typescript
interface HistoryPanelProps {
  state: SectionState<HistoryData>
  onLoadMore: () => void
  loadingMore: boolean
  trophies: Trophy[]  // para o inline trophy badge
}

interface HistoryItem {
  game_id: string
  match_day: string      // YYYY-MM-DD
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  pred_home: number | null
  pred_away: number | null
  points: number
  breakdown: Record<string, number> | null
  is_miss: boolean
  trophy_unlocked_id: string | null
}

interface HistoryData {
  items: HistoryItem[]
  total: number
  has_more: boolean
}
```

**Wireframe:**
```
┌─ HISTÓRICO ─────────────────────────────────┐
│ ▼ 14 JUN                                     │
│   BRA 3×1 ARG   vc 3×1   +8  ✓ CRAVADA       │
│   FRA 0×0 ALE   vc 1×0   +0                  │
│ ▼ 13 JUN                                     │
│   ESP 2×0 POR   vc 2×1   +3                  │
│   ENG 1×1 USA   -- FUROU --  color-muted      │
│ [              VER MAIS              ]         │
└─────────────────────────────────────────────┘
```

**Agrupamento por dia:** agrupar `items` por `match_day`. Cabeçalho do dia: `▼ {DD MMM}` em `color-accent`. Para cada jogo na linha:
- Resultado: `{home_code} {home_score}×{away_score} {away_code}` — times usando `home_team` (3 chars uppercase).
- Se não é miss: `vc {pred_home}×{pred_away}` + `+{points}` em `color-win` se `points > 0`, senão `+0` em `color-muted`.
- Se is_miss: `-- FUROU --` em `color-muted`/`color-error`.
- Se `trophy_unlocked_id`: exibir `✓ {TROPHY_NAMES[trophy_unlocked_id]}` em `color-win` após os pontos.

**Botão "VER MAIS":** exibido se `has_more`. Ao clicar, incrementa `offset` em 20 e chama `/api/profile/history` com novos params. Os novos itens são **concatenados** ao array existente (não substituem). O botão muda para `CARREGANDO...` durante o fetch (`loadingMore`).

**Formato de data do cabeçalho:** `new Date(match_day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()` — ex: `14 JUN`.

---

## Plano de Migração do Componente Atual

O `ProfileStats.tsx` atual é um Client Component que busca `/api/profile/stats` e renderiza 6 linhas de stats. O redesign o substitui completamente. Passos:

1. Criar `components/bolao/perfil/` (novo diretório).
2. Implementar os 4 novos painéis dentro desse diretório.
3. Criar `components/bolao/perfil/PerfilDashboard.tsx` que os orquestra.
4. Atualizar `app/(dashboard)/perfil/page.tsx` para importar `PerfilDashboard` em vez de `ProfileStats`.
5. Manter `ProfileStats.tsx` e `/api/profile/stats` no codebase sem remoção — deprecados mas não deletados, para segurança durante o review. O Revisor decide se apaga.

---

## Proteção de Rotas

- `/perfil` já exige autenticação via `supabase.auth.getUser()` no Server Component — manter.
- Todos os novos Route Handlers (`/api/profile/campaign`, `/api/profile/performance`, `/api/profile/trophies`, `/api/profile/history`) usam o padrão Bearer JWT já estabelecido em `/api/profile/stats/route.ts`.
- Verificação de membership antes de qualquer query de dados — retornar 403 se não for membro.

---

## Integração Supabase Realtime

Esta feature **não usa Realtime**. Os dados do perfil são estáticos no momento do carregamento da página (posição, histórico, troféus). Atualização em tempo real não é requisito desta feature — o usuário pode dar refresh manual. O Realtime já existe na página de ranking.

---

## Critérios de Aceite

- [ ] A aba `/perfil` exibe as 4 seções: SUA CAMPANHA, DESEMPENHO, TROFÉUS, HISTÓRICO
- [ ] SUA CAMPANHA exibe posição, pontos, distância para o líder e para o próximo acima
- [ ] SUA CAMPANHA exibe movimento de posição (`▲N / ▼N / =`) quando há ao menos um snapshot
- [ ] SUA CAMPANHA exibe variante de líder quando o usuário está em 1º lugar
- [ ] Migration `position_snapshots` criada com RLS correta
- [ ] Trigger grava snapshot automaticamente ao fechar último jogo de um `match_day`
- [ ] Função `record_position_snapshots` é idempotente (ON CONFLICT DO NOTHING)
- [ ] DESEMPENHO exibe barras ASCII (`███░░░`) para acerto de vencedor e placar exato
- [ ] DESEMPENHO exibe comparação de média com o grupo com seta de direção e cor correta
- [ ] DESEMPENHO exibe sequência em pílulas `●●●●○` com atual e melhor
- [ ] TROFÉUS exibe contagem `X / 15` no cabeçalho
- [ ] TROFÉUS exibe `✓` para desbloqueados, `✗` com progresso para locked, `🔒 ???` para secretos
- [ ] TROFÉUS: clicar expande inline com descrição/data (sem modal)
- [ ] HISTÓRICO agrupa jogos por dia com cabeçalho `▼ DD MMM`
- [ ] HISTÓRICO mostra palpite do usuário e pontos por jogo
- [ ] HISTÓRICO marca jogos sem palpite como `-- FUROU --`
- [ ] HISTÓRICO exibe selo de troféu inline quando troféu foi desbloqueado naquele jogo
- [ ] HISTÓRICO inicia com 20 jogos e tem botão "VER MAIS" funcional (paginação offset)
- [ ] Loading state por seção independente (erro em uma seção não bloqueia as outras)
- [ ] Design segue DESIGN.md: JetBrains Mono, tokens CSS, sem sombras, sem SVGs decorativos
- [ ] Funciona em mobile (coluna única, maxWidth 600px)
- [ ] `ProfileStats.tsx` e `/api/profile/stats` mantidos (deprecados, não deletados)
```
