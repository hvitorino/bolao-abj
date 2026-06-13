# Plan: ESPN Sync

**Feature:** espn-sync
**Data:** 2026-06-13
**Status:** done

---

## Tarefas

- [x] **Migration 008** — `supabase/migrations/20260613000008_games_espn_id.sql`
  - Adiciona `espn_id text` à tabela `games`
  - Cria índice único parcial `games_espn_id_idx` (WHERE espn_id IS NOT NULL)

- [x] **Migration db/** — `db/migrations/20260613_espn_id.sql`
  - Espelho da migration Supabase para consistência com a pasta db/

- [x] **Tipos ESPN** — `lib/types/espn.ts`
  - `EspnCompetitor`, `EspnEvent`, `EspnScoreboardResponse`, `SyncResult`

- [x] **Atualização do tipo Game** — `lib/types/game.ts`
  - Campo `espn_id: string | null` adicionado à interface `Game`

- [x] **Endpoint POST /api/admin/sync-games** — `app/api/admin/sync-games/route.ts`
  - Autenticação dupla: X-Admin-Secret (manual) ou Authorization: Bearer CRON_SECRET (cron)
  - Query params: `days` (default 7), `clean`/`replace` (default false)
  - Limpeza de placeholders com `?clean=true` ou `?replace=true`
  - Fetch ESPN por dia (YYYYMMDD), mapeamento completo para schema `games`
  - UPSERT idempotente por `espn_id`
  - Tradução de nomes de times (EN→PT-BR) e fases (EN→PT-BR)
  - Placar NULL para jogos pendentes, inteiro para live/finished
  - Continuidade em falhas parciais (erros registrados, loop continua)
  - Resposta com `{ synced, created, updated, deleted, errors }`

- [x] **Cron Vercel** — `vercel.json`
  - Cron a cada 2 minutos apontando para `/api/admin/sync-games`
  - Vercel injeta `Authorization: Bearer CRON_SECRET` automaticamente

---

## Variáveis de ambiente necessárias

| Variável | Descrição | Status |
|---|---|---|
| `ADMIN_SECRET` | Segredo para chamadas manuais admin | Já existente |
| `SUPABASE_URL` | URL do projeto Supabase | Já existente |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (sem RLS) | Já existente |
| `CRON_SECRET` | Gerado pelo Vercel para autenticar crons | **Novo — adicionar no Vercel Dashboard** |

---

## Notas de implementação

- O endpoint usa `createClient` do `@supabase/supabase-js` diretamente com `SUPABASE_SERVICE_ROLE_KEY` (sem sessão de usuário — seguro para uso em rota admin server-side).
- Limpeza de placeholders ocorre **antes** do fetch ESPN (operação destrutiva intencional, conforme spec).
- O cron sincroniza sempre `days=7` (próximos 7 dias) sem deletar jogos — apenas cria/atualiza.
- Nomes de times não encontrados no mapa de tradução são inseridos com nome original ESPN (sem erro).
