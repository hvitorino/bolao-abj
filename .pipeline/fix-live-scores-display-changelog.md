# Changelog: Correção — Exibição e Atualização de Placar em Tempo Real

**Slug:** fix-live-scores-display
**Branch:** feature/fix-live-scores-display
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `db/migrations/20260614_fix_scores_realtime_rls.sql` — Nova migration que adiciona política RLS `"users can read own scores"` na tabela `scores` para SELECT por usuário autenticado (`USING (user_id = auth.uid())`). Sem esta política, o Supabase Realtime pode bloquear eventos de INSERT/UPDATE antes de entregá-los ao canal do cliente, mesmo com o filtro `game_id=eq.${gameId}`. A migration usa `CREATE POLICY IF NOT EXISTS` para ser idempotente.

### Frontend (Next.js/React)

- `lib/hooks/useGameRealtime.ts` — Adicionada guarda defensiva no callback do evento `UPDATE` do Realtime. Antes de chamar `setGame`, valida que `payload.new` contém pelo menos os campos essenciais `id` e `status`. Se o payload chegar incompleto (comportamento possível quando `REPLICA IDENTITY FULL` não está ativo no banco), o estado local é preservado em vez de ser sobrescrito com um objeto vazio, evitando que o placar "zere" na tela do usuário.

- `lib/hooks/useScoreRealtime.ts` — Adicionado early return no início do `useEffect` quando `userId` está vazio ou `undefined`. Antes, o hook criava uma subscription com `userId = ''`, resultando em um canal com nome inválido (`score-${gameId}-`) e uma subscription que nunca corresponderia corretamente ao usuário. O early return garante que nenhuma subscription é criada até que um `userId` válido esteja disponível — a subscription é criada automaticamente quando `userId` muda de `''` para o UUID real (dependência `[gameId, userId]` do `useEffect`).

---

## Decisões técnicas

1. **Validação de `payload.new` por campos essenciais:** A guarda usa `newGame.id && newGame.status !== undefined` — `id` é o identificador primário (falsy apenas se objeto vazio) e `status` usa `!== undefined` porque pode ser a string `'live'`, `'pending'` ou `'finished'` mas nunca `undefined` num payload válido. Esta combinação é suficiente para distinguir um payload completo de um objeto `{}` produzido por falta de `REPLICA IDENTITY FULL`.

2. **Early return com `if (!userId) return`:** O retorno sem cleanup é intencional — se `!userId` é verdadeiro, nenhum `supabase.removeChannel(channel)` precisa ser retornado porque nenhum canal foi criado. Quando `userId` passa a existir, o `useEffect` re-executa (por causa da dependência `[gameId, userId]`) e cria a subscription normalmente com cleanup correto.

3. **Sem alteração em `GameCard.tsx`:** A lógica de `scoreText` (`hasScore ? ... : isLive ? '0 × 0' : '- × -'`) está correta. O zero como placar válido é tratado corretamente pelo operador `!== null`.

4. **Sem alteração em `lib/scoring.ts`:** A verificação de `calculateScore` usa comparações estritas (`===`, `!==`, `>`, `<`) em parâmetros tipados como `number` (não `number | null`). O `ScoreDisplay` só é renderizado no `GameCard.tsx` dentro de uma guarda `liveGame.home_score !== null && liveGame.away_score !== null`, então valores `null` nunca chegam à função de cálculo. Nenhuma verificação falsy problemática encontrada.

5. **Sem alteração em `GameParticipantsList.tsx`:** Componente Server Component puro. Recebe dados via prop SSR. Nenhum hook, nenhuma verificação de score que pudesse ter comportamento falsy. Confirmado conforme spec.

---

## Pontos de atenção para o Revisor

1. **Migration RLS deve ser executada manualmente no Supabase:** O arquivo `db/migrations/20260614_fix_scores_realtime_rls.sql` deve ser executado no SQL Editor do Supabase (ambiente de produção) após a migration `20260614_enable_realtime_publications.sql`. Verificar se já existe alguma política com o mesmo nome antes de executar (a migration usa `IF NOT EXISTS` para ser idempotente).

2. **Migration de Realtime (`20260614_enable_realtime_publications.sql`) ainda é pré-requisito:** Esta feature corrige o código defensivo para o caso onde o Realtime não está configurado, mas o Realtime em si só funcionará se a migration de publicações tiver sido executada. O Revisor deve confirmar (ou recomendar que o time confirme) no dashboard Supabase que `REPLICA IDENTITY FULL` está ativo para `games` e `scores`.

3. **Cleanup em `useScoreRealtime` quando `!userId`:** O early return sem retorno de função de cleanup é correto — nenhum canal foi criado. Confirmar que o linter TypeScript não levanta erro por retorno inconsistente no `useEffect` (o hook retorna `undefined` implicitamente quando entra no early return, o que é válido para `useEffect`).

4. **`payload.new as Partial<Game>`:** A mudança de `payload.new as Game` para `payload.new as Partial<Game>` é um cast mais honesto com a realidade — o payload pode chegar incompleto. Após a validação dos campos essenciais, fazemos `newGame as Game` para satisfazer o `setGame`. Confirmar que não há warnings TypeScript neste ponto.

---

## Commits realizados

```
abd2658 fix(fix-live-scores-display): adiciona early return em useScoreRealtime quando userId está vazio
f4366aa fix(fix-live-scores-display): adiciona guarda defensiva em payload.new no useGameRealtime
8109532 feat(fix-live-scores-display): adiciona migration RLS para leitura de scores via Realtime
5982a43 chore(fix-live-scores-display): adiciona plano de implementação
```
