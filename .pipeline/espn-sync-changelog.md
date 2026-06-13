# Changelog: ESPN Sync

**Slug:** espn-sync
**Branch:** feat/espn-sync
**Data:** 2026-06-13
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados

- `supabase/migrations/20260613000008_games_espn_id.sql` — Migration 008:
  - Adiciona coluna `espn_id text` à tabela `games` (nullable, para preservar jogos de seed/placeholder existentes com `espn_id IS NULL`)
  - Cria índice único parcial `games_espn_id_idx ON games (espn_id) WHERE espn_id IS NOT NULL` — garante unicidade apenas para registros com ESPN ID, sem impedir múltiplas linhas com `espn_id = NULL`

- `db/migrations/20260613_espn_id.sql` — Espelho da migration 008 na pasta `db/migrations/` para consistência com o histórico local

### Tipos TypeScript

- `lib/types/espn.ts` — Tipos para a ESPN Scoreboard API pública:
  - `EspnCompetitor` — representa um time em uma partida, com `homeAway`, `score` (string), e `team.displayName`/`team.abbreviation`
  - `EspnEvent` — representa um evento/partida com `id`, `date` (ISO 8601 UTC), `status.type.name`, `competitions` (array com `competitors`, `venue`, `notes`)
  - `EspnScoreboardResponse` — wrapper com `events: EspnEvent[]`
  - `SyncResult` — shape da resposta do endpoint: `{ synced, created, updated, deleted, errors }`

- `lib/types/game.ts` — Campo `espn_id: string | null` adicionado à interface `Game` (nullable por retrocompatibilidade com jogos sem ID ESPN)

### Endpoint POST /api/admin/sync-games

`app/api/admin/sync-games/route.ts`

**Autenticação dupla:**
- Header `X-Admin-Secret` comparado com `process.env.ADMIN_SECRET` (chamadas manuais de admin)
- Header `Authorization: Bearer <token>` comparado com `process.env.CRON_SECRET` (chamadas automáticas do cron Vercel)
- Retorna `401` se nenhum dos dois for válido — autenticação ocorre antes de qualquer operação no banco

**Query params:**
- `days` (default `7`): quantos dias a sincronizar a partir de hoje (UTC); `days < 1` retorna `400`
- `clean` ou `replace` (default `false`): se `true`, deleta todos os jogos com `espn_id IS NULL` antes do fetch ESPN (limpeza de placeholders)

**Lógica de execução:**
1. Valida autenticação
2. Se `?clean=true` ou `?replace=true`: executa `DELETE FROM games WHERE espn_id IS NULL` e registra `deleted` no resultado
3. Calcula range de datas: `[hoje, hoje + days - 1]` em UTC, formatando como `YYYYMMDD` para a URL da ESPN
4. Para cada dia:
   - Faz GET em `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`
   - Falha HTTP da ESPN retorna `502` imediatamente
   - Itera sobre `events`:
     - Extrai `home`/`away` competitor por `homeAway`
     - Mapeia `status.type.name` para `'pending' | 'live' | 'finished'`
     - Placar: `NULL` para `status === 'pending'` (evita inserir `"0"` ESPN como placar real), `parseInt(score)` para `live`/`finished`
     - Traduz `team.displayName` via `TEAM_NAME_MAP` (EN→PT-BR, 65 times mapeados; fallback: nome original ESPN)
     - Traduz `competitions[0].notes[0].headline` via `ROUND_MAP` (grupos A–H + fases eliminatórias; fallback: `"Copa do Mundo 2026"` se ausente)
     - Extrai `venue.fullName` (nullable)
   - UPSERT idempotente por `espn_id` via `.upsert(record, { onConflict: 'espn_id' })`
   - Falha em evento individual: registra em `errors`, loop continua (sem abortar o sync)
5. Retorna `{ synced, created, updated, deleted, errors }`

**Resposta de sucesso:**
```json
{ "synced": 11, "created": 8, "updated": 3, "deleted": 0, "errors": [] }
```

### Cron Vercel

`vercel.json` — Cron configurado para acionar `POST /api/admin/sync-games` a cada 5 minutos:
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

O Vercel injeta automaticamente `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron, autenticando via a segunda via do endpoint.

---

## Variáveis de ambiente

| Variável | Status |
|---|---|
| `ADMIN_SECRET` | Já existente |
| `SUPABASE_URL` | Já existente |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existente |
| `CRON_SECRET` | Novo — adicionar no Vercel Dashboard (Settings > Environment Variables) |

---

## Decisões técnicas

1. **Índice único parcial (`WHERE espn_id IS NOT NULL`):** Permite que múltiplas linhas com `espn_id = NULL` coexistam (jogos de seed/placeholder), enquanto garante que cada ID ESPN seja único. Um `UNIQUE` simples bloquearia mais de um placeholder.

2. **Placar NULL para `pending`:** A ESPN retorna `"0"` como `score` para jogos ainda não iniciados. Inserir `0` criaria ambiguidade com placar real `0×0`. A implementação força `NULL` quando `status === 'pending'`, alinhado à regra de negócio da spec.

3. **Autenticação dupla (admin + cron):** O mesmo endpoint serve chamadas manuais (admin via `X-Admin-Secret`) e automáticas (Vercel cron via `Authorization: Bearer`). Isso evita criar duas rotas separadas.

4. **Continuidade em falhas parciais:** Erros de estrutura ESPN ou banco em eventos individuais são registrados em `errors` sem abortar o sync. O endpoint retorna `200` mesmo com erros parciais — o `errors` array indica os eventos problemáticos.

5. **`SUPABASE_SERVICE_ROLE_KEY` sem sessão de usuário:** Endpoint admin server-side — não usa `createServerClient` com cookies de sessão, usa `createClient` direto com `service_role` para contornar RLS.

---

## Fix aplicado pelo Revisor

- **fix-1 (vercel.json schedule):** Schedule estava `*/2 * * * *` (a cada 2 min) em vez de `*/5 * * * *` (a cada 5 min) conforme spec. Corrigido para `*/5 * * * *`.

---

## Critérios de aceite verificados

- [x] Migration `20260613000008_games_espn_id.sql` criada corretamente
- [x] Índice único parcial `WHERE espn_id IS NOT NULL` (não `UNIQUE` simples)
- [x] Endpoint retorna `401` sem autenticação válida — verificado antes de qualquer operação
- [x] Aceita `X-Admin-Secret` OU `Authorization: Bearer <CRON_SECRET>`
- [x] `?days=0` e `?days=-1` retornam `400`
- [x] UPSERT usa `espn_id` como chave de conflito (idempotente)
- [x] Jogos `STATUS_SCHEDULED` inseridos com `home_score = NULL` e `away_score = NULL`
- [x] `STATUS_IN_PROGRESS` → `'live'`; `STATUS_FULL_TIME`/`STATUS_FINAL` → `'finished'`
- [x] Times traduzidos EN→PT-BR; fallback para nome original sem erro
- [x] Rounds traduzidos; fallback `"Copa do Mundo 2026"` se `notes` ausente
- [x] `?clean=true` e `?replace=true` deletam apenas `WHERE espn_id IS NULL`
- [x] Falha em evento individual não aborta o sync
- [x] `vercel.json` com cron `*/5 * * * *` (corrigido pelo Revisor)
- [x] Tipos `EspnCompetitor`, `EspnEvent`, `EspnScoreboardResponse`, `SyncResult` em `lib/types/espn.ts`
- [x] `Game.espn_id: string | null` em `lib/types/game.ts`
- [x] Sem credenciais hardcoded
