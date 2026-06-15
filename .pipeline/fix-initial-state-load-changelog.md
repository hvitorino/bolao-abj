# Changelog: Correção — Carregamento do Estado Inicial nos Hooks Realtime

**Slug:** fix-initial-state-load
**Branch:** feature/fix-initial-state-load
**Data:** 2026-06-14
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/hooks/useGameRealtime.ts` — Adicionado `useEffect` de fetch inicial que executa `supabase.from('games').select('*').eq('id', gameId).single()` no mount e a cada mudança de `gameId`. Garante que o placar e o status do jogo são exibidos imediatamente ao recarregar a página, sem aguardar o próximo evento Realtime. A subscription Realtime existente permanece sem alteração como segundo `useEffect`.

- `lib/hooks/useScoreRealtime.ts` — Adicionado `useEffect` de fetch inicial que executa `supabase.from('scores').select('*').eq('game_id', gameId).eq('user_id', userId).maybeSingle()` no mount e a cada mudança de `gameId` ou `userId`. Respeita o mesmo `if (!userId) return` da subscription existente. Garante que a pontuação de jogos encerrados aparece imediatamente, sem depender de eventos Realtime futuros (que nunca chegariam para jogos já finalizados).

### Backend (Ruby/Sinatra)
- Nenhuma alteração. As queries de fetch inicial vão diretamente ao Supabase JS client, consistente com o padrão de `useRankingRealtime`.

### Banco de Dados
- Nenhuma migration necessária. As políticas RLS existentes já permitem as queries de fetch inicial:
  - `games`: leitura para usuários autenticados (implementada em features anteriores)
  - `scores`: política `"users can read own scores"` adicionada na migration `20260614_fix_scores_realtime_rls.sql`

---

## Decisões técnicas

**Dois useEffect separados (em vez de fetch dentro do useEffect de subscription):** A spec recomendou explicitamente dois `useEffect` separados para manter clareza de responsabilidades: um para o carregamento inicial (executa uma vez por `gameId`/`userId`) e outro para a subscription Realtime (ciclo de vida do canal WebSocket). Isso evita lógica condicional dentro de um único efeito e facilita futura manutenção.

**Sem AbortController no fetch inicial:** A spec identificou explicitamente que não há race condition problemática entre o fetch e o Realtime — se um evento Realtime chegar durante o fetch, ele sobrescreverá o state com dados ainda mais recentes, o que é correto. AbortController adicionaria complexidade desnecessária.

**`.maybeSingle()` em vez de `.single()` para scores:** `.single()` lança erro 406 quando não há registro — comportamento incorreto para score ainda não calculado (jogo `pending` ou `live`). `.maybeSingle()` retorna `null` sem erro nesses casos, mantendo o comportamento original do hook.

**Sem alteração na interface de retorno dos hooks:** `useGameRealtime` continua retornando `{ game, lastUpdatedAt, connectionStatus }` e `useScoreRealtime` continua retornando `Score | null`. Nenhum estado `loading` foi adicionado — o usuário vê os dados SSR (`initialGame`/`initialScore`) imediatamente e o fetch de confirmação atualiza silenciosamente se necessário.

**`useRankingRealtime.ts` e `GameCard.tsx` não alterados:** Conforme spec — o primeiro já implementa o padrão correto, o segundo não precisa de alteração pois a interface dos hooks não mudou.

---

## Pontos de atenção para o Revisor

1. **Prioridade dos dados:** O evento Realtime sempre sobrescreve o resultado do fetch inicial — isso é correto pois Realtime representa o estado mais recente. Verificar que não há inversão de ordem nos dois useEffects.

2. **`createClient()` chamado duas vezes por hook:** Cada `useEffect` instancia seu próprio cliente Supabase. O cliente é lightweight (não abre nova conexão), mas confirmar que isso é aceitável conforme o padrão já usado em `useRankingRealtime` (que também chama `createClient()` dentro do `useEffect`).

3. **Dependências dos useEffect de fetch:** `[gameId]` para `useGameRealtime` e `[gameId, userId]` para `useScoreRealtime` — idênticas às dependências das subscriptions existentes. Correto por spec.

4. **TypeScript:** Compilou sem erros (`tsc --noEmit` com saída vazia).

---

## Commits realizados

```
feb7e36 feat(fix-initial-state-load): adiciona fetch inicial ao useScoreRealtime
15274aa feat(fix-initial-state-load): adiciona fetch inicial ao useGameRealtime
55fe404 chore(fix-initial-state-load): adiciona plano de implementação
```
