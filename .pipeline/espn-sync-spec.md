Now I have all the context needed to write the spec. Let me write it.

---

# Spec: ESPN Sync

**Slug:** espn-sync
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Substituir o seed estático/placeholder de jogos por sincronização automática com a ESPN API pública (gratuita, sem autenticação). Um endpoint de administração faz UPSERT dos jogos da Copa do Mundo FIFA 2026 na tabela `games` usando o `espn_id` como chave de idempotência. Um cron Vercel aciona o sync a cada 5 minutos para manter placares e status atualizados em tempo real.

---

## Histórias de Usuário

- Como admin, quero acionar `POST /api/admin/sync-games` manualmente para importar jogos de um range de datas
- Como admin, quero que o sync seja idempotente para poder rodar quantas vezes quiser sem duplicar registros
- Como admin, quero receber um relatório de quantos jogos foram criados, atualizados ou falharam em cada execução
- Como admin, quero limpar os jogos placeholder (sem `espn_id`) ao rodar o sync com `?replace=true`
- Como participante, quero ver placares e status de jogo atualizados automaticamente (via cron a cada 5 minutos)
- Como participante, quero que times sedes (México, EUA, Canadá) apareçam em português no bolão

---

## Modelo de Dados

### Migration 008: adicionar `espn_id` à tabela `games`

**Arquivo:** `supabase/migrations/20260613000008_games_espn_id.sql`

```sql
-- Migration 008: adiciona coluna espn_id para sincronização com ESPN API
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS espn_id text;

ALTER TABLE games
  ADD CONSTRAINT games_espn_id_unique UNIQUE (espn_id);

CREATE INDEX IF NOT EXISTS games_espn_id_idx ON games (espn_id);
```

**Notas:**
- `espn_id` é `NULL` em jogos inseridos manualmente ou via seed antigo
- `UNIQUE` garante que um mesmo evento ESPN nunca seja duplicado
- A constraint `games_unique_match (home_team_code, away_team_code, match_date)` da migration 007 é mantida como fallback de idempotência para inserções sem `espn_id`

### Schema atualizado de `games`

```sql
games (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team      text NOT NULL,
  away_team      text NOT NULL,
  home_team_code char(3) NOT NULL,
  away_team_code char(3) NOT NULL,
  match_date     timestamptz NOT NULL,
  home_score     int,
  away_score     int,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'live', 'finished')),
  round          text NOT NULL,
  venue          text,
  espn_id        text UNIQUE,            -- ID do evento na ESPN (ex: "760415")
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_unique_match UNIQUE (home_team_code, away_team_code, match_date)
)
```

---

## API Endpoints

### POST /api/admin/sync-games

**Autenticação:** header `X-Admin-Secret` com o valor de `ADMIN_SECRET` (variável de ambiente). Retornar `401` se ausente ou incorreto.

**Query params:**
- `days` (opcional, inteiro ≥ 1): quantos dias sincronizar a partir de hoje. Default: `7`
- `replace` (opcional, boolean): se `true`, deleta todos os jogos sem `espn_id` antes de inserir. Default: `false`

**Lógica de execução:**

1. Validar header `X-Admin-Secret`
2. Se `replace=true`: executar `DELETE FROM games WHERE espn_id IS NULL`
3. Calcular range de datas: `[hoje, hoje + days - 1]` em UTC
4. Para cada dia do range:
   a. Fazer GET em `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`
   b. Iterar sobre `events` da resposta
   c. Mapear cada evento para o formato da tabela `games` (ver Mapeamento abaixo)
   d. Fazer UPSERT em `games` por `espn_id` com `ON CONFLICT (espn_id) DO UPDATE SET ...`
5. Retornar relatório agregado

**Mapeamento ESPN → games:**

| Campo ESPN | Campo `games` | Transformação |
|---|---|---|
| `event.id` | `espn_id` | string direto |
| `event.date` | `match_date` | ISO timestamp UTC direto |
| `competitions[0].competitors[homeAway=home].team.displayName` | `home_team` | aplicar mapa de tradução PT-BR |
| `competitions[0].competitors[homeAway=away].team.displayName` | `away_team` | aplicar mapa de tradução PT-BR |
| `competitions[0].competitors[homeAway=home].team.abbreviation` | `home_team_code` | uppercase, 3 letras |
| `competitions[0].competitors[homeAway=away].team.abbreviation` | `away_team_code` | uppercase, 3 letras |
| `competitions[0].competitors[homeAway=home].score` | `home_score` | `parseInt` ou `NULL` se `STATUS_SCHEDULED` |
| `competitions[0].competitors[homeAway=away].score` | `away_score` | `parseInt` ou `NULL` se `STATUS_SCHEDULED` |
| `event.status.type.name` | `status` | ver Mapeamento de Status |
| `competitions[0].notes[0].headline` | `round` | ex: "Group A" → "Grupo A" (ver mapa de rounds) |
| `competitions[0].venue.fullName` | `venue` | string direto, pode ser ausente |

**Mapeamento de status ESPN → status bolão:**

| ESPN `status.type.name` | `status` |
|---|---|
| `STATUS_SCHEDULED` | `pending` |
| `STATUS_IN_PROGRESS` | `live` |
| `STATUS_FULL_TIME` | `finished` |
| `STATUS_FINAL` | `finished` |
| qualquer outro | `pending` |

**Mapeamento de rounds ESPN → português:**

| ESPN `notes[0].headline` | `round` |
|---|---|
| `Group A` | `Grupo A` |
| `Group B` | `Grupo B` |
| `Group C` | `Grupo C` |
| `Group D` | `Grupo D` |
| `Group E` | `Grupo E` |
| `Group F` | `Grupo F` |
| `Group G` | `Grupo G` |
| `Group H` | `Grupo H` |
| `Round of 16` | `Oitavas de Final` |
| `Quarterfinals` | `Quartas de Final` |
| `Semifinals` | `Semifinal` |
| `Third Place` | `Terceiro Lugar` |
| `Final` | `Final` |
| ausente / outro | valor original sem tradução |

**Mapa de tradução de nomes de times (ESPN inglês → português):**

| ESPN `displayName` | `home_team` / `away_team` |
|---|---|
| `Mexico` | `México` |
| `United States` | `Estados Unidos` |
| `Canada` | `Canadá` |
| `Brazil` | `Brasil` |
| `Germany` | `Alemanha` |
| `France` | `França` |
| `Spain` | `Espanha` |
| `Portugal` | `Portugal` |
| `Argentina` | `Argentina` |
| `England` | `Inglaterra` |
| `Netherlands` | `Países Baixos` |
| `Belgium` | `Bélgica` |
| `Switzerland` | `Suíça` |
| `Croatia` | `Croácia` |
| `Morocco` | `Marrocos` |
| `Senegal` | `Senegal` |
| `Japan` | `Japão` |
| `South Korea` | `Coreia do Sul` |
| `Australia` | `Austrália` |
| `Ecuador` | `Equador` |
| `Ivory Coast` | `Costa do Marfim` |
| `Czechia` | `República Tcheca` |
| `Turkey` | `Turquia` |
| `Serbia` | `Sérvia` |
| `Denmark` | `Dinamarca` |
| `Uruguay` | `Uruguai` |
| `Colombia` | `Colômbia` |
| `Peru` | `Peru` |
| `Chile` | `Chile` |
| `Paraguay` | `Paraguai` |
| `Bolivia` | `Bolívia` |
| `Venezuela` | `Venezuela` |
| `Nigeria` | `Nigéria` |
| `Ghana` | `Gana` |
| `Cameroon` | `Camarões` |
| `Tunisia` | `Tunísia` |
| `Algeria` | `Argélia` |
| `Egypt` | `Egito` |
| `Saudi Arabia` | `Arábia Saudita` |
| `Iran` | `Irã` |
| `Iraq` | `Iraque` |
| `Qatar` | `Catar` |
| `South Africa` | `África do Sul` |
| `Bosnia-Herzegovina` | `Bósnia e Herzegovina` |
| `Scotland` | `Escócia` |
| `Wales` | `País de Gales` |
| `Ukraine` | `Ucrânia` |
| `Poland` | `Polônia` |
| `Austria` | `Áustria` |
| `Sweden` | `Suécia` |
| `Norway` | `Noruega` |
| `Haiti` | `Haiti` |
| `Curacao` | `Curaçau` |
| não encontrado no mapa | valor original ESPN (fallback sem tradução) |

**UPSERT SQL:**

```sql
INSERT INTO games
  (espn_id, home_team, away_team, home_team_code, away_team_code,
   match_date, home_score, away_score, status, round, venue)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (espn_id) DO UPDATE SET
  home_team      = EXCLUDED.home_team,
  away_team      = EXCLUDED.away_team,
  home_team_code = EXCLUDED.home_team_code,
  away_team_code = EXCLUDED.away_team_code,
  match_date     = EXCLUDED.match_date,
  home_score     = EXCLUDED.home_score,
  away_score     = EXCLUDED.away_score,
  status         = EXCLUDED.status,
  round          = EXCLUDED.round,
  venue          = EXCLUDED.venue
WHERE
  games.espn_id IS NOT DISTINCT FROM EXCLUDED.espn_id;
```

**Resposta de sucesso (200):**

```json
{
  "synced": 11,
  "created": 8,
  "updated": 3,
  "deleted": 0,
  "errors": []
}
```

**Resposta com erros parciais (200 — sync continuou mesmo com falhas individuais):**

```json
{
  "synced": 9,
  "created": 7,
  "updated": 2,
  "deleted": 0,
  "errors": [
    { "espn_id": "760418", "message": "missing competitors data" }
  ]
}
```

**Erros globais:**

| Situação | Status | Body |
|---|---|---|
| Header ausente ou incorreto | `401` | `{ "error": "Unauthorized" }` |
| `days` não é inteiro positivo | `400` | `{ "error": "days must be a positive integer" }` |
| Falha total na ESPN API | `502` | `{ "error": "ESPN API unavailable", "detail": "..." }` |
| Falha no Supabase | `500` | `{ "error": "Database error", "detail": "..." }` |

**Arquivo:** `app/api/admin/sync-games/route.ts`

**Cliente Supabase:** usar `createClient` do `@supabase/supabase-js` com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (sem contexto de request — este é um endpoint admin, não precisa de sessão de usuário).

---

## Cron Vercel

**Arquivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/admin/sync-games",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Autenticação do cron:** Vercel injeta o header `Authorization: Bearer <CRON_SECRET>` automaticamente nas chamadas de cron. O endpoint `sync-games` deve aceitar tanto `X-Admin-Secret: <ADMIN_SECRET>` (chamadas manuais) quanto `Authorization: Bearer <CRON_SECRET>` (chamadas do cron Vercel).

**Lógica de autenticação do endpoint:**

```typescript
const adminSecret = request.headers.get('x-admin-secret')
const cronAuth = request.headers.get('authorization')

const isAdmin = adminSecret === process.env.ADMIN_SECRET
const isCron = cronAuth === `Bearer ${process.env.CRON_SECRET}`

if (!isAdmin && !isCron) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Variáveis de ambiente necessárias:**

| Variável | Descrição |
|---|---|
| `ADMIN_SECRET` | Já existente — segredo para chamadas manuais de admin |
| `SUPABASE_URL` | Já existente |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existente |
| `CRON_SECRET` | Novo — gerado pelo Vercel para autenticar chamadas de cron (definido em Vercel > Settings > Environment Variables) |

---

## Tipos TypeScript

**Arquivo:** `lib/types/espn.ts`

```typescript
export interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score: string
  team: {
    displayName: string
    abbreviation: string
  }
}

export interface EspnEvent {
  id: string
  date: string // ISO 8601 UTC
  status: {
    type: {
      name:
        | 'STATUS_SCHEDULED'
        | 'STATUS_IN_PROGRESS'
        | 'STATUS_FULL_TIME'
        | 'STATUS_FINAL'
        | string
      shortDetail: string
    }
  }
  competitions: Array<{
    competitors: EspnCompetitor[]
    venue?: {
      fullName: string
    }
    notes?: Array<{
      headline: string
    }>
  }>
}

export interface EspnScoreboardResponse {
  events: EspnEvent[]
}

export interface SyncResult {
  synced: number
  created: number
  updated: number
  deleted: number
  errors: Array<{ espn_id: string; message: string }>
}
```

**Extensão de `lib/types/game.ts`** (adicionar campo `espn_id`):

```typescript
export interface Game {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: GameStatus
  round: string
  venue: string | null
  espn_id: string | null  // novo campo
  created_at: string
}
```

---

## Regras de Negócio

1. **Idempotência por `espn_id`**: O UPSERT usa `espn_id` como chave. Rodar o sync múltiplas vezes para o mesmo range de datas é seguro — não gera duplicatas.

2. **Placar em jogos `pending`**: Quando `status` é `STATUS_SCHEDULED`, `home_score` e `away_score` devem ser `NULL` (não `0`), pois a ESPN retorna `"0"` para placares não iniciados. A lógica de mapeamento deve forçar `NULL` quando o status for `pending`.

3. **Scores ao vivo**: Quando `status` é `live`, o placar retornado pela ESPN pode ser `"0"` legítimo. Neste caso, inserir `0` (não `NULL`).

4. **Fallback de `round`**: Se `competitions[0].notes` estiver ausente ou vazio, usar `"Copa do Mundo 2026"` como valor default de `round`.

5. **Fallback de tradução**: Nomes de times não encontrados no mapa de tradução são inseridos com o valor original em inglês da ESPN, sem erro. O log de `errors` não inclui ausências no mapa de tradução — apenas falhas de estrutura de dados ou banco.

6. **Limpeza de placeholders (`replace=true`)**: Ao deletar jogos sem `espn_id`, a operação ocorre **antes** do fetch ESPN. Se o fetch falhar após a deleção, os placeholders terão sido removidos. Este comportamento é intencional — a operação `replace` é destrutiva e deve ser usada apenas quando o admin tem certeza de que a ESPN API está acessível.

7. **Range de datas em UTC**: O parâmetro `days` conta dias a partir de `00:00:00 UTC` de hoje. O formato para a ESPN é `YYYYMMDD` (sem separador).

8. **Continuidade em falhas parciais**: Uma falha ao processar um evento ESPN individual (estrutura inválida, campo ausente, erro de banco) não aborta o sync. O evento é registrado em `errors` e o loop continua.

9. **Escopo do cron**: O cron usa os defaults (`days=7`, `replace=false`), sincronizando sempre a janela dos próximos 7 dias. Isso garante que placares ao vivo e recém-encerrados sejam atualizados a cada 5 minutos.

10. **Sem criação de novos campos pelo cron**: O cron nunca deleta jogos. Apenas cria ou atualiza. A deleção de placeholders requer chamada manual com `?replace=true`.

---

## Critérios de Aceite

- [ ] Migration `20260613000008_games_espn_id.sql` criada em `supabase/migrations/` e aplicável via `npx supabase db push` sem erros
- [ ] Coluna `espn_id text UNIQUE` adicionada à tabela `games` sem quebrar constraints existentes
- [ ] `POST /api/admin/sync-games` retorna `401` sem header `X-Admin-Secret` válido
- [ ] `POST /api/admin/sync-games` retorna `401` sem `Authorization: Bearer <CRON_SECRET>` válido
- [ ] `POST /api/admin/sync-games` aceita autenticação por `X-Admin-Secret` OU por `Authorization: Bearer`
- [ ] Chamada com `?days=3` sincroniza exatamente os próximos 3 dias (hoje + 2 seguintes)
- [ ] Chamada sem `?days` usa default de 7 dias
- [ ] `?days=0` ou `?days=-1` retornam `400`
- [ ] Dois syncs seguidos para o mesmo range não duplicam jogos (idempotência via UPSERT em `espn_id`)
- [ ] Jogos `STATUS_SCHEDULED` são inseridos com `home_score = NULL` e `away_score = NULL`
- [ ] Jogos `STATUS_IN_PROGRESS` são mapeados para `status = 'live'`
- [ ] Jogos `STATUS_FULL_TIME` e `STATUS_FINAL` são mapeados para `status = 'finished'`
- [ ] Times com mapeamento no dicionário aparecem em português (ex: "Brazil" → "Brasil", "Mexico" → "México")
- [ ] Times sem mapeamento aparecem com o nome original da ESPN (sem erro)
- [ ] Rounds são traduzidos corretamente (ex: "Group A" → "Grupo A", "Final" → "Final")
- [ ] `?replace=true` deleta todos os jogos com `espn_id IS NULL` antes do fetch ESPN
- [ ] Chamada sem `?replace` (ou `?replace=false`) não deleta nenhum jogo existente
- [ ] Resposta JSON contém `synced`, `created`, `updated`, `deleted` e `errors`
- [ ] Falha em evento ESPN individual não aborta o sync — evento vai para `errors` e loop continua
- [ ] `vercel.json` configurado com cron `*/5 * * * *` apontando para `/api/admin/sync-games`
- [ ] Variável `CRON_SECRET` documentada como necessária em `.env.local.example` ou equivalente
- [ ] Tipo `Game` em `lib/types/game.ts` inclui campo `espn_id: string | null`
- [ ] Tipos ESPN definidos em `lib/types/espn.ts`
- [ ] Endpoint não usa `createClient` com sessão de usuário — usa `SUPABASE_SERVICE_ROLE_KEY` diretamente
- [ ] Sem credenciais hardcoded no código-fonte
