# Spec: Correção — Visibilidade no Ranking

**Slug:** fix-ranking-visibility
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Investigar e corrigir o conjunto de problemas que impede o usuário cadastrado de aparecer no ranking com sua pontuação correta. A falha tem múltiplas causas identificadas por análise estática do código existente, documentadas abaixo. O Programador deve verificar o estado real de cada causa no ambiente de produção antes de aplicar correções, e documentar a causa raiz confirmada no changelog.

---

## Histórias de Usuário

- Como participante do bolão, quero ver minha posição e pontuação no ranking mesmo que nenhum jogo tenha sido encerrado ainda, para saber que estou cadastrado e participando.
- Como participante do bolão, quero aparecer no ranking com 0 pontos se ainda não tiver pontuação, para não achar que o sistema está com problema.
- Como participante do bolão, quero que meu nome fique destacado em `color-primary` no ranking para me identificar imediatamente na lista.
- Como administrador, quero que todos os participantes cadastrados apareçam no ranking (mesmo sem palpites), para ter visão completa do bolão.

---

## Diagnóstico — Causas Identificadas por Análise do Código

O Programador deve verificar cada causa no ambiente real antes de corrigir.

### Causa 1 — CRÍTICA: `get_ranking()` exclui usuários sem scores (INNER JOIN)

**Arquivo:** `supabase/migrations/20260613000005_create_ranking_view.sql`

A função `get_ranking()` e a view `ranking_view` usam:

```sql
FROM scores s
JOIN profiles p ON p.id = s.user_id
```

Isso é um `INNER JOIN`. Usuários que não têm nenhuma linha na tabela `scores` (porque nenhum jogo encerrou ainda, ou porque não fizeram palpites) são completamente excluídos do resultado. O ranking só mostra quem já tem pontos calculados.

**Impacto:** Um usuário recém-cadastrado que fez palpites mas ainda não tem jogos encerrados simplesmente não aparece no ranking. O frontend exibe "NENHUM PARTICIPANTE NO RANKING AINDA" mesmo quando há participantes.

**Correção necessária:** Mudar a query para partir de `profiles` com `LEFT JOIN` em `scores`, incluindo todos os perfis cadastrados com `COALESCE(SUM(s.points), 0)` para pontuação zero quando não há scores.

### Causa 2 — CRÍTICA: `get_ranking()` também exclui usuários sem palpites em jogos encerrados

Mesmo que um usuário tenha feito palpites, se nenhum dos jogos que ele apostou encerrou, não haverá linhas em `scores` para ele. O `INNER JOIN` novamente o exclui.

Esta causa é um subconjunto da Causa 1 e é resolvida pela mesma correção.

### Causa 3 — CONFIRMADA: `route.ts` mapeia campo `position` inexistente (resolvida na migration real)

**Arquivo:** `app/api/ranking/route.ts` — linhas 41–53

O arquivo de código (não a migration aplicada) mapeia:
```typescript
rank_position: entry.rank_position,
```

A migration em `supabase/migrations/20260613000005_create_ranking_view.sql` já usa `rank_position` como nome do campo retornado. O `route.ts` também usa `rank_position`. **Estes estão alinhados.** Porém o arquivo legado em `db/migrations/20260613_create_ranking_view.sql` usa `position` (palavra reservada). O Programador deve confirmar qual migration está aplicada no Supabase em produção.

**Verificação:** Executar no Supabase SQL Editor:
```sql
SELECT rank_position FROM get_ranking() LIMIT 1;
```
Se retornar erro, a migration antiga está aplicada e precisa ser corrigida.

### Causa 4 — POTENCIAL: RLS em `profiles` pode bloquear a função `get_ranking()`

**Arquivo:** `supabase/migrations/20260613000001_create_profiles.sql`

A política atual de `profiles` permite `SELECT` para todos (`USING (true)`). Dentro da função `get_ranking()` com `SECURITY DEFINER`, o JOIN em `profiles` é feito com permissões do owner do banco (superuser Postgres), então o RLS de `profiles` não é um bloqueio. Esta causa é improvável mas deve ser confirmada.

**Verificação:** Executar no Supabase SQL Editor como usuário anônimo:
```sql
SELECT count(*) FROM profiles;
```
Se retornar 0 quando há usuários cadastrados, há problema de RLS em `profiles`.

### Causa 5 — POTENCIAL: Realtime de `scores` não configurado

**Arquivo:** `supabase/migrations/20260613000006_realtime.sql`

A migration habilita Realtime para `scores` e `games`. Se esta migration não foi aplicada, o Realtime não funciona — mas o ranking ainda carrega corretamente no carregamento inicial. Esta causa afeta apenas atualizações automáticas, não a visibilidade inicial.

**Verificação:** A migration `006` existe em `supabase/migrations/` e deve estar aplicada. Confirmar se o hook `useRankingRealtime` recebe eventos.

### Causa 6 — POTENCIAL: Trigger `on_game_finished` não dispara corretamente

Se o administrador atualiza `home_score` e `away_score` sem mudar `status` para `'finished'`, o trigger não dispara e `scores` nunca é populado. Neste caso, o endpoint `POST /api/scores/calculate` deve ser chamado manualmente.

**Verificação:** Checar se há registros em `scores` no Supabase dashboard. Se `predictions` tem linhas mas `scores` está vazio, o trigger não foi disparado.

---

## Modelo de Dados

### Migrations necessárias

#### Migration nova: `fix_ranking_all_profiles`

Arquivo: `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql`

Substituir a função `get_ranking()` e a view `ranking_view` para incluir TODOS os perfis cadastrados, mesmo sem scores:

```sql
-- Atualiza view ranking_view para incluir todos os participantes (mesmo sem pontos)
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  p.id                                            AS user_id,
  p.name                                          AS participant_name,
  p.avatar_url,
  COALESCE(SUM(s.points), 0)::int                 AS total_points,
  COUNT(s.id)::int                                AS games_predicted,
  RANK() OVER (
    ORDER BY COALESCE(SUM(s.points), 0) DESC
  )::int                                          AS rank_position
FROM profiles p
LEFT JOIN scores s ON s.user_id = p.id
GROUP BY p.id, p.name, p.avatar_url
ORDER BY total_points DESC, p.name ASC;

-- Atualiza função get_ranking() com LEFT JOIN e COALESCE
CREATE OR REPLACE FUNCTION get_ranking()
RETURNS TABLE (
  user_id          uuid,
  participant_name text,
  total_points     int,
  games_predicted  int,
  rank_position    int
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    p.id                                            AS user_id,
    p.name                                          AS participant_name,
    COALESCE(SUM(s.points), 0)::int                 AS total_points,
    COUNT(s.id)::int                                AS games_predicted,
    RANK() OVER (
      ORDER BY COALESCE(SUM(s.points), 0) DESC
    )::int                                          AS rank_position
  FROM profiles p
  LEFT JOIN scores s ON s.user_id = p.id
  GROUP BY p.id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
```

**Notas sobre a migration:**
- `COALESCE(SUM(s.points), 0)` garante 0 em vez de NULL para usuários sem scores.
- `COUNT(s.id)` retorna 0 corretamente quando não há linhas (LEFT JOIN produz NULL em `s.id`, e `COUNT` de NULL = 0).
- `RANK()` sobre COALESCE garante que todos os participantes com 0 pontos ficam empatados nas últimas posições.
- `p.name ASC` como critério de desempate secundário garante ordem estável.
- `SECURITY DEFINER` mantido para contornar o RLS de `scores` (política `scores_select_own`).

---

## Backend — Endpoints Next.js Route Handler

### GET /api/ranking

**Arquivo:** `app/api/ranking/route.ts`
**Status atual:** implementado e funcionando para usuários com scores. Sem correção necessária no código — apenas a migration SQL resolve o problema de dados.

**Verificação obrigatória:** Confirmar que a tipagem TypeScript do mapeamento `entry.rank_position` está alinhada com o campo retornado pela função `get_ranking()`.

O código atual em `route.ts` linhas 41–53 mapeia `entry.rank_position`. Após a migration corrigida, a função continua retornando `rank_position` — compatível. Nenhuma alteração de código necessária neste arquivo **se** a migration real já usa `rank_position`.

**Se a migration antiga (com `position`) estiver aplicada:** A correção passa pela migration `fix_ranking_all_profiles` acima, que já usa `rank_position`. Não há necessidade de alterar `route.ts`.

### POST /api/scores/calculate (existente)

**Arquivo:** `api/scores/calculate.rb`
**Uso no contexto desta correção:** Se a causa raiz for que jogos foram finalizados sem o trigger disparar, o Programador deve documentar no changelog que o admin precisa chamar este endpoint para cada jogo encerrado sem scores.

**Nenhuma alteração de código necessária** neste endpoint.

---

## Frontend — Componentes React

### `useRankingRealtime` — sem alteração necessária

**Arquivo:** `lib/hooks/useRankingRealtime.ts`

O hook busca `/api/ranking` com JWT e assina o canal `ranking-scores`. Nenhuma alteração é necessária — o fix é na camada de dados (função SQL).

### `RankingTable` — adicionar estado para usuário sem pontos

**Arquivo:** `components/bolao/RankingTable.tsx`

**Alteração:** O estado vazio `ranking.length === 0` deve permanecer como fallback, mas após a migration corrigida ele nunca deve ocorrer enquanto houver ao menos um participante cadastrado. Verificar se o componente exibe corretamente participantes com `total_points = 0` e `games_predicted = 0`.

**Estado a validar:**
- `total_points = 0` exibido como `0` na coluna PONTOS (não como NULL ou vazio).
- `aproveitamento = 0` exibido como `0%` — verificar que `calcAproveitamento(0, 0)` retorna `0` sem divisão por zero. O código atual em `route.ts` já trata: `if (!gamesPredicted) return 0`.
- `rank_position` para múltiplos usuários com 0 pontos: todos terão `rank_position = 1` (empate no RANK). Isso é semanticamente correto e o `isLeader={entry.rank_position === 1}` destacará todos eles em `color-accent`. Avaliar se é desejável: se todos estão empatados com 0, destacar todos como líderes pode ser confuso. **Decisão de produto:** exibir `isLeader` apenas quando `total_points > 0`.

**Correção em `RankingTable.tsx`:** Alterar a prop `isLeader` passada para `RankingRow`:

```tsx
// Antes:
isLeader={entry.rank_position === 1}

// Depois:
isLeader={entry.rank_position === 1 && entry.total_points > 0}
```

### `RankingRow` — sem alteração necessária

**Arquivo:** `components/bolao/RankingRow.tsx`

O componente renderiza corretamente valores numéricos `0`. Nenhuma alteração necessária.

### Página `/ranking` — sem alteração necessária

**Arquivo:** `app/(dashboard)/ranking/page.tsx`

A página já passa `currentUserId={user.id}` corretamente. Nenhuma alteração necessária.

---

## Regras de Negócio

### Participantes no ranking

1. **Todos os perfis cadastrados em `profiles` devem aparecer no ranking**, mesmo sem palpites e mesmo sem jogos encerrados.
2. Usuário sem palpites ou sem jogos encerrados: `total_points = 0`, `games_predicted = 0`, `aproveitamento = 0%`.
3. **Ordenação:** `total_points DESC`, `participant_name ASC` como desempate.
4. **Líder visual** (`►`, `color-accent`): somente o participante na posição 1 COM `total_points > 0`. Se todos têm 0 pontos, nenhum é destacado como líder.
5. **Usuário atual** (`color-primary`, sufixo `(VOCÊ)`): identificado por `user_id === currentUserId` — independente da pontuação.

### Aproveitamento

- Fórmula: `Math.round(total_points / (games_predicted * 9) * 100)`.
- Se `games_predicted === 0`: aproveitamento = `0` (sem divisão por zero).
- Exibido como `0%` quando o usuário não tem jogos encerrados.

### Cálculo de scores (trigger)

- O trigger `on_game_finished` na tabela `games` dispara `calculate_scores_for_game()` quando `status` muda para `'finished'` com placar definido.
- Se placar/status foi atualizado fora desta condição (ex: admin atualizou só o placar em jogo já `finished`), o admin deve chamar manualmente `POST /api/scores/calculate` com o `game_id`.
- Este fluxo **não muda** com esta correção — a correção é apenas para exibir usuários com 0 pontos.

---

## Proteção de Rotas

Sem alterações. A rota `/ranking` já é protegida pelo layout do dashboard com redirect para `/login` se não autenticado. O endpoint `/api/ranking` já valida JWT Bearer token.

---

## Integração Supabase Realtime

Sem alterações no código. A migration `supabase/migrations/20260613000006_realtime.sql` já configura `REPLICA IDENTITY FULL` e `ALTER PUBLICATION` para `scores`. Verificar se está aplicada no ambiente de produção.

---

## Plano de Diagnóstico para o Programador

Execute estas queries no Supabase SQL Editor **antes** de aplicar qualquer correção, e registre os resultados no changelog:

```sql
-- 1. Quantos perfis existem?
SELECT count(*) FROM profiles;

-- 2. Quantos palpites existem?
SELECT count(*) FROM predictions;

-- 3. Quantos scores existem?
SELECT count(*) FROM scores;

-- 4. A função get_ranking() retorna dados?
SELECT * FROM get_ranking();

-- 5. Há jogos com status 'finished'?
SELECT id, home_team, away_team, status, home_score, away_score
FROM games WHERE status = 'finished';

-- 6. O campo rank_position existe na função?
SELECT rank_position FROM get_ranking() LIMIT 1;
-- Se der erro "column rank_position does not exist", a migration antiga (com 'position') está aplicada.
```

Com base nesses resultados, o Programador saberá qual combinação de causas está ativa e aplicará apenas as correções necessárias.

---

## Critérios de Aceite

- [ ] Usuário logado vê sua própria entrada no ranking com destaque `(VOCÊ)` em `color-primary`
- [ ] Usuário com `total_points = 0` aparece no ranking com `0 pontos` e `0%` aproveitamento
- [ ] Todos os participantes cadastrados em `profiles` aparecem no ranking (verificar com ao menos 2 usuários cadastrados)
- [ ] Ranking não exibe "NENHUM PARTICIPANTE NO RANKING AINDA" enquanto houver usuários cadastrados
- [ ] Líder (`►`, `color-accent`) destacado apenas quando `total_points > 0`
- [ ] Ranking atualiza automaticamente via Supabase Realtime quando um jogo é encerrado
- [ ] Endpoint `GET /api/ranking` retorna array com todos os participantes, incluindo os com 0 pontos
- [ ] Causa raiz documentada no changelog com resultados das queries de diagnóstico
- [ ] Migration `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` criada e aplicada no Supabase
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (coluna única, sem overflow horizontal)
- [ ] Nenhuma regressão nas features existentes: predictions, scoring, live-scores continuam funcionando
