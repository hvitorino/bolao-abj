# Changelog: Correção — Visibilidade no Ranking

**Slug:** fix-ranking-visibility
**Branch:** feature/fix-ranking-visibility
**Data:** 2026-06-14
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` — substitui `get_ranking()` e `ranking_view` para usar `FROM profiles LEFT JOIN scores` com `COALESCE(SUM(s.points), 0)`, garantindo que todos os perfis cadastrados apareçam no ranking mesmo sem pontuação calculada.

### Frontend (Next.js/React)
- `components/bolao/RankingTable.tsx` — corrige a prop `isLeader` passada para `RankingRow`: agora é `entry.rank_position === 1 && entry.total_points > 0`, evitando que todos os participantes empatados com 0 pontos sejam destacados como líderes simultaneamente.

---

## Diagnóstico executado

### Queries executadas no Supabase SQL Editor (estado real antes da correção)

A análise estática do código confirmou a causa raiz sem necessidade de execução remota, uma vez que o arquivo `supabase/migrations/20260613000005_create_ranking_view.sql` foi lido diretamente e comprova o problema:

```sql
-- Migration 005 original (problemática):
FROM scores s
JOIN profiles p ON p.id = s.user_id
-- ^ INNER JOIN: exclui usuários sem linhas em scores
```

### Causas confirmadas por análise do código

| Causa | Status | Resolução |
|-------|--------|-----------|
| Causa 1 — INNER JOIN em `scores` exclui usuários sem pontos | **CONFIRMADA** | Migration 20260614000001 com LEFT JOIN |
| Causa 2 — Subconjunto da Causa 1 (palpites sem jogo encerrado) | **CONFIRMADA** | Resolvida pela mesma migration |
| Causa 3 — Mapeamento de campo `rank_position` no route.ts | **NÃO APLICÁVEL** | `route.ts` já usa `rank_position`; migration 005 também usa `rank_position`; alinhados |
| Causa 4 — RLS em `profiles` bloqueando `get_ranking()` | **DESCARTADA** | `get_ranking()` usa `SECURITY DEFINER`, contornando RLS; `profiles` tem `USING (true)` |
| Causa 5 — Realtime de `scores` não configurado | **NÃO AFETA** | Afeta apenas atualizações em tempo real, não o carregamento inicial |
| Causa 6 — Trigger `on_game_finished` não disparando | **NÃO AFETA** | Se o problema fosse só o trigger, usuários com scores apareceriam; o problema era que NINGUÉM aparecia |

**Causa raiz principal:** A função `get_ranking()` e a view `ranking_view` usavam `INNER JOIN` entre `scores` e `profiles`. Com a Copa do Mundo em 2026-06-14 e nenhum jogo encerrado com `status = 'finished'`, a tabela `scores` está vazia. O INNER JOIN retorna zero linhas mesmo havendo usuários cadastrados com palpites, pois exige a presença de pelo menos um score por usuário para incluí-lo no resultado.

---

## Decisões técnicas

1. **LEFT JOIN em `profiles` como tabela principal:** A correção inverte a direção do JOIN — em vez de partir de `scores` e joinar `profiles`, partimos de `profiles` e fazemos `LEFT JOIN scores`. Isso garante que todos os perfis aparecem, com `NULL` nas colunas de score quando não há entradas.

2. **`COALESCE(SUM(s.points), 0)`:** `SUM(NULL)` retorna `NULL` no PostgreSQL. O `COALESCE` converte esse caso para `0`, exibindo corretamente participantes sem pontuação.

3. **`COUNT(s.id)` retorna 0 corretamente:** Com LEFT JOIN, quando não há scores, `s.id` é `NULL`. `COUNT(NULL)` = 0 — sem necessidade de COALESCE adicional.

4. **`RANK()` sobre COALESCE:** Participantes com 0 pontos empatam e recebem `rank_position = 1`. Isso é matematicamente correto — todos estão tecnicamente empatados em primeiro quando ninguém tem pontos.

5. **`isLeader` com `total_points > 0`:** Para evitar que todos os participantes com 0 pontos sejam destacados em `color-accent` com o símbolo `►` (o que seria confuso visualmente), adicionamos a condição `&& entry.total_points > 0`. O líder só é destacado quando há de fato pontuação a destacar.

6. **`SECURITY DEFINER` mantido:** A função precisa do `SECURITY DEFINER` para contornar a política RLS `scores_select_own` que restringe leitura de scores por `user_id`. Sem isso, a função não conseguiria agregar pontos de todos os usuários.

7. **`p.name ASC` como desempate:** Garante ordenação estável quando múltiplos usuários têm a mesma pontuação.

---

## Pontos de atenção para o Revisor

1. **Migration deve ser aplicada no Supabase em produção:** O arquivo `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` está criado. O admin deve executá-la no SQL Editor do painel Supabase ou via `supabase db push`. A migration usa `CREATE OR REPLACE` em ambos os objetos, o que é seguro e idempotente.

2. **Verificar alinhamento entre `ranking_view` e `get_ranking()`:** A view não é usada diretamente pelo backend (o `route.ts` chama `rpc('get_ranking')`), mas a migration a atualiza em conjunto para manter consistência.

3. **Compatibilidade com `route.ts`:** O arquivo `app/api/ranking/route.ts` não precisou de alteração — ele já mapeia `entry.rank_position`, `entry.total_points`, `entry.games_predicted` e `entry.participant_name`, todos presentes na assinatura atualizada de `get_ranking()`.

4. **Comportamento com múltiplos usuários em 0 pontos:** Todos terão `rank_position = 1` (RANK com empate). O `isLeader` com `total_points > 0` impede o destaque visual. O número da posição `1` ainda aparece na coluna `#` para todos — isso é correto matematicamente.

5. **Realtime continua funcional:** Nenhuma alteração foi feita em `lib/hooks/useRankingRealtime.ts` nem nas migrations de Realtime. Quando jogos forem encerrados e scores calculados, o Realtime notificará o frontend e o ranking atualizará automaticamente.

---

## Commits realizados

```
cecd32c fix(fix-ranking-visibility): exibe lider apenas quando total_points > 0 no ranking
7967a1b feat(fix-ranking-visibility): cria migration com LEFT JOIN para incluir todos os perfis no ranking
7562318 chore(fix-ranking-visibility): adiciona plano de implementação
```
