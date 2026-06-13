# Fix 3: Navegação de Jogos

**Slug:** game-navigation
**Data:** 2026-06-13
**Rodada de revisão:** 3

---

## Problemas Encontrados

### Problema 1: Filtro por dia mistura data de Brasília com limites UTC e desloca jogos noturnos para o dia seguinte
**Arquivo:** `app/(dashboard)/jogos/page.tsx` (linhas 16-30) e `app/api/games/route.ts` (linhas 28-42)
**Severidade:** importante
**Descrição:** A data padrão e a navegação usam o dia em `America/Sao_Paulo`, mas a busca no Supabase filtra com `T00:00:00Z` até `T23:59:59Z`. Isso faz jogos a partir de 21:00 BRT caírem no dia UTC seguinte. Exemplo concreto do seed atual: `Portugal x Camarões` em `2026-06-12T00:00:00Z` é exibido na página `2026-06-12`, embora no card apareça como `11 JUN 2026 · 21:00 BRT`. O resultado é navegação por dia incorreta justamente na feature principal.
**Correção esperada:** Alinhar a semântica de data ponta a ponta. A correção preferida é calcular os limites do dia em Brasília e convertê-los para instantes UTC antes da query, usando o mesmo helper compartilhado na página `/jogos` e na route `/api/games`. Validar explicitamente que jogos como `2026-06-12T00:00:00Z`, `2026-06-13T01:00:00Z` e `2026-06-14T00:00:00Z` aparecem no dia BRT correto.

### Problema 2: Seed continua fail-open na checagem de duplicatas e pode inserir registros repetidos em caso de erro na verificação
**Arquivo:** `db/seeds/seed_games.rb` (linhas 199-217) e `db/migrations/20260613_create_games.sql` (linhas 10-31)
**Severidade:** importante
**Descrição:** Quando a verificação prévia falha, `game_exists?` retorna `false` e o script segue para `insert_game`, mesmo sem confirmar se o jogo já existe. Como a tabela `games` não tem proteção de unicidade para `(home_team_code, away_team_code, match_date)`, uma falha transitória na consulta pode gerar duplicatas silenciosas. Isso enfraquece a correção do Fix 2, que prometeu idempotência prática.
**Correção esperada:** Fazer o seed falhar fechado: se a checagem de duplicata retornar erro HTTP, abortar ou pular o insert com erro explícito. Além disso, adicionar uma proteção no banco (`UNIQUE`/índice único ou `upsert` com `on_conflict`) para que a idempotência não dependa só do fluxo da aplicação.

---

## Itens OK (não precisam ser revisados novamente)

- `GameCard`: fallback `0 × 0` para jogos `live` sem placar e horário visível nos estados `pending`, `live` e `finished`.
- `lib/date.ts`: validação estrita de datas reais no formato `YYYY-MM-DD` foi centralizada corretamente e elimina casos como `2026-02-31`.
- Documentação do seed (`.pipeline/game-navigation-changelog.md`, `CHANGELOG.md`, `CLAUDE.md` e spec) agora deixa claro que o dataset é placeholder/fictício até existir fonte verificável.
