# Spec: Correção — Carregamento do Estado Inicial nos Hooks Realtime

**Slug:** fix-initial-state-load
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Garantir que `useGameRealtime` e `useScoreRealtime` carreguem o estado atual via fetch direto ao Supabase no mount do componente, eliminando a tela vazia que ocorre ao recarregar a página enquanto aguarda o próximo evento Realtime chegar. A subscription Realtime deve continuar funcionando normalmente para atualizações subsequentes.

---

## Histórias de Usuário

- Como participante, quero ver o placar dos jogos ao vivo imediatamente ao carregar a página, sem precisar aguardar que um evento Realtime chegue espontaneamente.
- Como participante, quero que minha pontuação em um jogo encerrado apareça instantaneamente ao recarregar a página, sem depender de um evento Realtime futuro.
- Como participante, quero que atualizações em tempo real continuem chegando normalmente após o carregamento inicial.

---

## Diagnóstico do Problema

### useGameRealtime

O hook recebe `initialGame` (dados SSR) como segundo parâmetro e inicializa `useState<Game>(initialGame)`. Em teoria, o estado inicial deveria ser populado pelo Server Component antes da hidratação.

**Problema real:** O componente `GameCard` é um Client Component (`'use client'`). O `game` prop é serializado e enviado ao cliente durante SSR, mas após um **recarregamento de página com cache invalidado** ou quando o Next.js opta por uma renderização puramente client-side, o estado inicial pode não refletir os dados mais recentes do banco. O Realtime só atualizará o state quando **chegar o próximo evento UPDATE** na tabela `games` — que pode nunca chegar se o jogo não estiver em andamento naquele momento. Portanto, a prop `initialGame` resolve o problema para SSR, mas um fetch de confirmação no mount garante dados frescos em qualquer cenário.

**Cenário de falha crítico:** Jogo com status `live` cujo placar mudou após o SSR mas antes do próximo evento Realtime — o card mostrará o placar desatualizado até o próximo evento ou refresh manual.

### useScoreRealtime

O hook recebe `initialScore` (dados SSR) e inicializa `useState<Score | null>(initialScore)`. A subscription aguarda eventos `INSERT` ou `UPDATE` na tabela `scores`.

**Problema real:** Scores só são inseridos/atualizados quando um jogo encerra (trigger Postgres). Se o usuário recarregar a página com um jogo já encerrado e score já calculado, o `initialScore` do SSR deve resolver — mas um fetch de confirmação no mount garante que o score exibido é sempre o mais recente, independente de quando o SSR foi executado.

**Cenário de falha crítico:** Score calculado entre o momento do SSR e a hidratação do componente — o usuário verá "sem pontuação" até fazer um novo reload.

### Por que useRankingRealtime NÃO precisa de alteração

`useRankingRealtime` já implementa corretamente o padrão fetch-then-subscribe: chama `fetchRanking()` no início do `useEffect` (antes de criar a subscription) e re-chama quando eventos chegam. Este é exatamente o padrão que os outros hooks devem adotar. **Não alterar este hook.**

---

## Backend — Endpoints Necessários

### Endpoint existente para games

Não há endpoint `GET /api/games/:id` dedicado. O fetch inicial deve ir diretamente ao Supabase client-side via `supabase.from('games').select('*').eq('id', gameId).single()`. Isso é seguro pois a tabela `games` tem política RLS de leitura pública (ou para usuários autenticados, conforme já implementado nas features anteriores).

### Endpoint existente para scores

Não há endpoint `GET /api/scores` por jogo+usuário dedicado. O fetch inicial deve ir diretamente ao Supabase client-side via `supabase.from('scores').select('*').eq('game_id', gameId).eq('user_id', userId).maybeSingle()`.

**Decisão de design:** Usar o Supabase JS client diretamente (sem passar pela API Ruby) nos hooks client-side. Isso é consistente com o padrão já adotado em `useRankingRealtime`, que usa `supabase.auth.getSession()` e depois chama `/api/ranking` — mas para games e scores a query é simples o suficiente para não justificar uma rota Ruby intermediária.

---

## Frontend — Alterações nos Hooks

### useGameRealtime

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/lib/hooks/useGameRealtime.ts`

**Alteração:** Adicionar um `useEffect` separado que executa um fetch inicial do jogo no mount, **antes** da subscription Realtime processar o primeiro evento. O fetch deve sobrescrever o estado somente se os dados retornados do banco forem diferentes do `initialGame` (ou sempre, para garantir freshness — a abordagem mais simples é sempre setar o resultado do fetch).

**Interface de retorno:** mantida sem alteração — `{ game, lastUpdatedAt, connectionStatus }`.

**Implementação detalhada:**

```typescript
// Dentro do useEffect de subscription existente (ou em useEffect separado com [gameId]):
// Adicionar fetch inicial ao Supabase logo após criar o canal e ANTES de subscribe()

// Estrutura recomendada: dois useEffect separados
// useEffect 1: fetch inicial (executa uma vez no mount por gameId)
// useEffect 2: subscription Realtime (executa uma vez no mount por gameId, já existente)

// useEffect 1 — fetch inicial:
useEffect(() => {
  const supabase = createClient()
  supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()
    .then(({ data, error }) => {
      if (!error && data) {
        setGame(data as Game)
      }
    })
}, [gameId])

// useEffect 2 — subscription Realtime (código existente, sem alteração)
```

**Estados de loading:** O hook já inicializa com `initialGame` (dados SSR), então não há estado vazio durante o fetch inicial — o usuário vê os dados SSR imediatamente e o fetch de confirmação atualiza silenciosamente se necessário. Não adicionar estado `loading` ao hook.

**Tratamento de erro no fetch:** Se o fetch falhar (rede, RLS), o hook continua exibindo `initialGame`. Não propagar o erro para o componente — o Realtime subscription continua ativo como fallback.

### useScoreRealtime

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/lib/hooks/useScoreRealtime.ts`

**Alteração:** Adicionar um `useEffect` separado que executa fetch inicial do score no mount (quando `gameId` e `userId` estiverem disponíveis).

**Interface de retorno:** mantida sem alteração — `Score | null`.

**Implementação detalhada:**

```typescript
// useEffect 1 — fetch inicial:
useEffect(() => {
  if (!userId) return

  const supabase = createClient()
  supabase
    .from('scores')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (!error && data) {
        setScoreState(data as Score)
      }
    })
}, [gameId, userId])

// useEffect 2 — subscription Realtime (código existente, sem alteração)
```

**Uso de `.maybeSingle()`:** Retorna `null` (sem erro) quando não há registro — comportamento correto para score ainda não calculado. Não usar `.single()` pois lançaria erro 406 quando não há resultado.

**Tratamento de erro no fetch:** Se o fetch falhar, o hook continua com `initialScore`. Não propagar o erro.

---

## Regras de Negócio

1. **Prioridade dos dados:** O resultado do fetch inicial tem prioridade sobre `initialGame`/`initialScore` (pode ter dados mais recentes). O evento Realtime tem prioridade sobre o fetch inicial (é sempre o mais recente quando chega).

2. **Sem race condition entre fetch e Realtime:** Como o fetch é uma query Supabase e o Realtime é uma subscription WebSocket, a chegada de um evento Realtime durante o fetch pode sobrescrever o estado — isso é correto pois o evento Realtime sempre representa o estado mais recente. Não é necessário cancelamento do fetch (AbortController) neste caso.

3. **Dependências dos useEffects:** Ambos os `useEffect` de fetch inicial devem ter `[gameId]` (para `useGameRealtime`) e `[gameId, userId]` (para `useScoreRealtime`) como dependências — idêntico às subscriptions existentes. Isso garante re-fetch quando o usuário navega para um jogo diferente.

4. **Early return para userId vazio:** O `useEffect` de fetch inicial em `useScoreRealtime` deve respeitar o mesmo early return `if (!userId) return` já presente na subscription — não executar query com `userId` vazio.

5. **Sem alteração em GameCard.tsx:** O componente `GameCard.tsx` não precisa de nenhuma alteração — os hooks continuam expondo a mesma interface.

6. **Sem alteração em useRankingRealtime.ts:** Este hook já implementa o padrão correto.

---

## Componentes Afetados

### GameCard
**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/components/games/GameCard.tsx`
**Alteração:** Nenhuma. O componente consome `useGameRealtime` e `useScoreRealtime` via interface existente.

### GameParticipantsList
**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/components/bolao/GameParticipantsList.tsx`
**Alteração:** Nenhuma. É Server Component, não usa hooks Realtime.

---

## Integração Supabase Realtime

Os hooks continuam usando as subscriptions existentes sem alteração:

**useGameRealtime:**
- Tabela: `games`
- Evento: `UPDATE`
- Canal: `game-${gameId}`
- Filtro: `id=eq.${gameId}`

**useScoreRealtime:**
- Tabela: `scores`
- Evento: `*` (INSERT e UPDATE)
- Canal: `score-${gameId}-${userId}`
- Filtro: `game_id=eq.${gameId}`

O fetch inicial e a subscription coexistem no mesmo hook sem conflito: o fetch popula o estado na montagem, e a subscription mantém o estado sincronizado com mudanças futuras.

---

## Modelo de Dados

Nenhuma tabela nova ou migração SQL necessária. As queries de fetch inicial usam as tabelas existentes:

- `games`: SELECT * WHERE id = gameId
- `scores`: SELECT * WHERE game_id = gameId AND user_id = userId

As políticas RLS existentes já permitem estas queries:
- `games`: leitura pública ou para usuários autenticados (conforme implementado em features anteriores)
- `scores`: política `"users can read own scores"` adicionada em `fix-live-scores-display` (migration `20260614_fix_scores_realtime_rls.sql`)

---

## Critérios de Aceite

- [ ] Ao recarregar `/jogos`, o placar de jogos com status `live` é exibido imediatamente (sem aguardar evento Realtime)
- [ ] Ao recarregar `/jogos`, a pontuação de jogos `finished` é exibida imediatamente no ScoreDisplay
- [ ] O badge `██ AO VIVO ██` aparece imediatamente no mount para jogos com status `live`
- [ ] O Realtime continua atualizando placar e pontuação após o carregamento inicial (eventos subsequentes funcionam)
- [ ] `useGameRealtime` tem dois `useEffect` separados: um para fetch inicial, um para subscription (ou o fetch está dentro do useEffect de subscription, executado antes do subscribe)
- [ ] `useScoreRealtime` tem dois `useEffect` separados: um para fetch inicial, um para subscription
- [ ] O fetch inicial em `useScoreRealtime` respeita `if (!userId) return`
- [ ] Nenhuma alteração em `GameCard.tsx`, `GameParticipantsList.tsx` ou `useRankingRealtime.ts`
- [ ] Nenhuma migração SQL necessária
- [ ] Nenhum estado `loading` adicional exposto pelos hooks (os hooks continuam com a mesma interface de retorno)
- [ ] TypeScript compila sem erros (`tsc --noEmit`)
- [ ] Sem regressão nas features existentes: palpites, edição, ranking, pontuação
