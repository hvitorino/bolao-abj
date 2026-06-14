# Spec: Placares em Tempo Real (Realtime)

**Slug:** live-scores-realtime
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Garantir que os placares na aba de jogos e o ranking se atualizem automaticamente via Supabase Realtime, sem reload de página. As features anteriores (`live-scores`, `scoring`, `ranking`) já implementaram a espinha dorsal dos hooks Realtime, mas faltam:

1. Migration SQL executável que habilita `REPLICA IDENTITY FULL` e adiciona `games` e `scores` à publicação Realtime (hoje as instruções estão apenas em comentários de migrations)
2. Timestamp de "última atualização" visível no `GameCard` para jogos ao vivo (exigido por DESIGN.md)
3. Timestamp de "última atualização" visível no `RankingTable`
4. Reforço do estado da conexão Realtime nos hooks (channel status: `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT`)
5. Garantia de que o hook `useGameRealtime` propaga corretamente a transição `pending → live` com placar `0 × 0`

---

## Histórias de Usuário

- Como participante do bolão, quero ver o placar de um jogo ao vivo atualizar automaticamente em menos de 2 segundos quando o administrador altera o placar no banco, para acompanhar a partida sem recarregar a página
- Como participante do bolão, quero ver quando foi a última atualização de um placar ao vivo, para saber se os dados estão frescos
- Como participante do bolão, quero ver o ranking atualizar automaticamente quando um jogo encerra e pontuações são calculadas, para acompanhar minha posição em tempo real
- Como participante do bolão, quero que a conexão Realtime seja encerrada corretamente ao sair da página, para não haver consumo desnecessário de recursos

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma tabela nova. Alterações são configurações de replicação Postgres.

### Migrations necessárias

**Arquivo:** `db/migrations/20260614_enable_realtime_publications.sql`

Esta migration consolida as configurações Realtime que estavam apenas comentadas nas migrations de `live-scores` e `scoring`. Deve ser executada manualmente no SQL Editor do Supabase para ambientes já existentes, e incluída no setup de novos ambientes.

```sql
-- Migration: 20260614_enable_realtime_publications.sql
-- Habilita o Supabase Realtime para as tabelas games e scores.
-- REPLICA IDENTITY FULL garante que payload.new contém o registro completo no UPDATE.
--
-- Executar no SQL Editor do Supabase (requer permissão de superuser).
-- Idempotente: pode ser executada múltiplas vezes sem efeito colateral.

-- 1. REPLICA IDENTITY FULL para games
ALTER TABLE games REPLICA IDENTITY FULL;

-- 2. REPLICA IDENTITY FULL para scores
ALTER TABLE scores REPLICA IDENTITY FULL;

-- 3. Adicionar games à publicação supabase_realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;

-- 4. Adicionar scores à publicação supabase_realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;
```

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. O endpoint `PATCH /api/admin/games/[id]` já existe (feature `live-scores`) e propaga mudanças via WAL automaticamente.

---

## Frontend — Componentes React

### useGameRealtime (modificado)

**Arquivo:** `lib/hooks/useGameRealtime.ts`

**Mudanças em relação à versão atual:**

1. Adicionar `lastUpdatedAt: Date | null` ao estado retornado — atualizado a cada evento Realtime recebido
2. Adicionar `connectionStatus: 'connecting' | 'connected' | 'error'` — derivado do status do canal Supabase
3. Atualizar o tipo de retorno de `Game` para um objeto com os três campos

**Assinatura nova:**
```typescript
interface GameRealtimeState {
  game: Game
  lastUpdatedAt: Date | null
  connectionStatus: 'connecting' | 'connected' | 'error'
}

function useGameRealtime(gameId: string, initialGame: Game): GameRealtimeState
```

**Implementação:**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Game } from '@/lib/types/game'

interface GameRealtimeState {
  game: Game
  lastUpdatedAt: Date | null
  connectionStatus: 'connecting' | 'connected' | 'error'
}

export function useGameRealtime(gameId: string, initialGame: Game): GameRealtimeState {
  const [game, setGame] = useState<Game>(initialGame)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new as Game)
          setLastUpdatedAt(new Date())
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { game, lastUpdatedAt, connectionStatus }
}
```

**Nota sobre retrocompatibilidade:** O `GameCard` usa `useGameRealtime` e precisa ser atualizado para destruturar o retorno `{ game: liveGame, lastUpdatedAt, connectionStatus }` em vez de usar o retorno direto anterior (`const liveGame = useGameRealtime(...)`).

---

### GameCard (modificado)

**Arquivo:** `components/games/GameCard.tsx`

**Props (sem mudança na interface):**
```typescript
interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  userId?: string
}
```

**Mudanças:**

1. Atualizar a desestruturação do hook `useGameRealtime`:
   ```typescript
   // Antes:
   const liveGame = useGameRealtime(game.id, game)

   // Depois:
   const { game: liveGame, lastUpdatedAt } = useGameRealtime(game.id, game)
   ```

2. No footer do card, quando `isLive`, adicionar indicador de última atualização logo após o horário BRT:
   ```
   ██ AO VIVO ██  ·  15:00 BRT  ·  atualizado há 23s
   ```
   - O texto "atualizado há Xs" só aparece quando `lastUpdatedAt !== null`
   - Quando `lastUpdatedAt` é null (nenhuma atualização recebida ainda), não exibir nada
   - Formato: "atualizado há Xs" (segundos) se < 60s; "atualizado há Xmin" se >= 60s
   - Cor: `var(--color-muted)`, `fontSize: '11px'`
   - Separador `·` entre horário e timestamp

3. Helper de formatação do elapsed time:
   ```typescript
   function formatElapsed(date: Date): string {
     const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
     if (seconds < 60) return `${seconds}s`
     return `${Math.floor(seconds / 60)}min`
   }
   ```
   Este helper deve ser chamado dentro do JSX com `lastUpdatedAt` como argumento. Para que o texto seja atualizado periodicamente (sem recálculo forçado), o componente deve usar um `useState` de tick de 10s via `setInterval` no `useEffect`:
   ```typescript
   const [tick, setTick] = useState(0)
   useEffect(() => {
     const interval = setInterval(() => setTick(t => t + 1), 10_000)
     return () => clearInterval(interval)
   }, [])
   ```
   O `tick` não precisa ser usado explicitamente — sua atualização causa re-render que recalcula `formatElapsed(lastUpdatedAt)`. O `setInterval` deve ser criado apenas quando `isLive` para economizar recursos:
   ```typescript
   useEffect(() => {
     if (!isLive) return
     const interval = setInterval(() => setTick(t => t + 1), 10_000)
     return () => clearInterval(interval)
   }, [isLive])
   ```

**Comportamentos de estado:**

| Estado | Badge | Placar | Horário | Timestamp |
|--------|-------|--------|---------|-----------|
| `pending` | PENDENTE · HH:MM BRT | `- × -` em `color-muted` | sim | não |
| `live` | ██ AO VIVO ██ (blink, color-live) | `N × N` em `color-accent` (28px bold) | sim | sim (se recebeu update) |
| `finished` | ENCERRADO · HH:MM BRT | `N × N` em `color-accent` | sim | não |

---

### useRankingRealtime (modificado)

**Arquivo:** `lib/hooks/useRankingRealtime.ts`

**Mudanças em relação à versão atual:**

Adicionar `lastUpdatedAt: Date | null` ao objeto retornado — atualizado a cada refetch disparado pelo evento Realtime.

**Assinatura nova:**
```typescript
function useRankingRealtime(): {
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
  lastUpdatedAt: Date | null
}
```

**Implementação:** Na função `fetchRanking`, ao definir `setRanking(data)`, também chamar `setLastUpdatedAt(new Date())`. O estado `lastUpdatedAt` começa em `null` e é atualizado apenas após o primeiro fetch bem-sucedido disparado por evento Realtime (não pelo fetch inicial de carregamento).

Separar o timestamp do fetch inicial do fetch por evento:
```typescript
// Dentro do callback do canal Realtime:
() => {
  fetchRanking().then(() => setLastUpdatedAt(new Date()))
}
```

Alternativamente (mais simples): `setLastUpdatedAt(new Date())` dentro do `fetchRanking` após `setRanking(data)`, mas apenas se `data !== ranking` (evitar timestamp falso no load inicial). A opção mais simples e segura é atualizar sempre após fetchRanking — o load inicial também conta como "última atualização".

**Implementação recomendada (simples e correta):**
```typescript
// Após setRanking(data):
setLastUpdatedAt(new Date())
```

---

### RankingTable (modificado)

**Arquivo:** `components/bolao/RankingTable.tsx`

**Mudanças:**

1. Desestruturar `lastUpdatedAt` do hook:
   ```typescript
   const { ranking, loading, error, lastUpdatedAt } = useRankingRealtime()
   ```

2. No header da tabela, ao lado do indicador `● AO VIVO`, adicionar o timestamp de última atualização quando `lastUpdatedAt !== null`:
   ```
   RANKING — BOLÃO DO CARTOLA ABJ          ● AO VIVO · 14:32:05
   ```
   - Formato: `HH:MM:SS` em horário local do usuário
   - Cor: `var(--color-muted)`, `fontSize: '11px'`
   - Separador `·` entre `● AO VIVO` e o timestamp
   - Quando `lastUpdatedAt === null`, exibir apenas `● AO VIVO` sem timestamp

**Helper de formatação:**
```typescript
function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
```

---

## Regras de Negócio

1. **Latência alvo:** < 2 segundos desde o UPDATE no banco até a atualização na tela. Esse SLA é garantido pela arquitetura WAL do Supabase Realtime — nenhuma lógica adicional de polling é necessária.

2. **Graceful degradation:** Se a subscription Realtime falhar (`CHANNEL_ERROR` ou `TIMED_OUT`), o componente continua exibindo o último estado conhecido. Não exibir mensagem de erro ao usuário final (a falha é silenciosa). O `connectionStatus: 'error'` existe apenas para possível uso futuro em dashboards de diagnóstico.

3. **Cleanup obrigatório:** `supabase.removeChannel(channel)` deve ser chamado no retorno do `useEffect` de todos os hooks. Isso já está implementado em `useGameRealtime`, `useRankingRealtime` e `useScoreRealtime` — verificar que permanece correto após as modificações.

4. **Tick de atualização no GameCard:** O `setInterval` de 10s no `GameCard` (para atualizar o texto "atualizado há Xs") deve ser criado apenas quando `isLive === true` e limpo no cleanup. Não criar `setInterval` desnecessário para jogos `pending` ou `finished`.

5. **Transição `pending → live`:** Quando o admin faz `PATCH` mudando `status: 'live'` com `home_score: 0, away_score: 0`, o `GameCard` deve:
   - Mudar a borda para `color-live`
   - Exibir o badge `██ AO VIVO ██` com `.blink`
   - Exibir `0 × 0` em `color-accent`
   - Iniciar o `setInterval` de tick
   Isso já é coberto pelo fluxo atual de `useGameRealtime` + derivações de `liveGame.status` — a spec confirma que não há lógica adicional necessária.

6. **`REPLICA IDENTITY FULL` é pré-requisito:** Sem esta configuração no Supabase, `payload.new` no evento UPDATE pode estar incompleto (apenas os campos alterados). A migration `20260614_enable_realtime_publications.sql` é o entregável principal desta feature no lado do banco.

---

## Proteção de Rotas

Nenhuma rota nova. Todos os componentes modificados (`GameCard`, `RankingTable`) já estão em rotas protegidas pelo middleware existente em `app/(dashboard)/layout.tsx`.

---

## Integração Supabase Realtime

### Canal `game-${gameId}` (um por GameCard)

- **Tabela:** `games`
- **Evento:** `UPDATE`
- **Filtro:** `id=eq.${gameId}`
- **Ao receber:** `setGame(payload.new as Game)` + `setLastUpdatedAt(new Date())`
- **Callback de status:** `setConnectionStatus('connected' | 'error')` via segundo argumento do `.subscribe()`
- **Cleanup:** `supabase.removeChannel(channel)` no retorno do `useEffect`

### Canal `ranking-scores` (singleton por instância de RankingTable)

- **Tabela:** `scores`
- **Evento:** `*` (INSERT, UPDATE, DELETE)
- **Filtro:** nenhum (escuta toda a tabela — o RLS não se aplica ao Realtime com service_role implícito do canal)
- **Ao receber:** refetch de `/api/ranking` via `fetchRanking()` + `setLastUpdatedAt(new Date())`
- **Cleanup:** `supabase.removeChannel(channel)` no retorno do `useEffect`

### Canal `score-${gameId}-${userId}` (um por GameCard com userId)

- **Tabela:** `scores`
- **Evento:** `*`
- **Filtro:** `game_id=eq.${gameId}`
- **Ao receber:** `setScoreState(payload.new as Score)` se `payload.new.user_id === userId`
- **Cleanup:** `supabase.removeChannel(channel)` no retorno do `useEffect`
- **Nota:** Já implementado em `useScoreRealtime`. Nenhuma mudança necessária.

---

## Critérios de Aceite

- [ ] Migration `db/migrations/20260614_enable_realtime_publications.sql` criada e idempotente
- [ ] `useGameRealtime` retorna `{ game, lastUpdatedAt, connectionStatus }` em vez de `Game` diretamente
- [ ] `GameCard` desestrutura corretamente o novo retorno de `useGameRealtime` (sem quebra de tipos)
- [ ] Quando um jogo ao vivo recebe update via Realtime, o texto "atualizado há Xs" aparece no footer do card
- [ ] O texto "atualizado há Xs" é atualizado a cada ~10s (sem reload) enquanto o jogo está ao vivo
- [ ] O `setInterval` de tick é limpo ao desmontar o `GameCard` ou quando `isLive` muda para `false`
- [ ] `useRankingRealtime` retorna `lastUpdatedAt: Date | null` no objeto de retorno
- [ ] `RankingTable` exibe `● AO VIVO · HH:MM:SS` com timestamp quando `lastUpdatedAt !== null`
- [ ] Badge `██ AO VIVO ██` pisca (CSS `.blink`) e borda do card muda para `color-live` quando `status === 'live'`
- [ ] Placar em `color-accent` (#FFDF00) para jogos `live` e `finished`
- [ ] Jogos `pending` exibem `- × -` em `color-muted` (sem timestamp de atualização)
- [ ] `supabase.removeChannel(channel)` chamado no cleanup de todos os hooks modificados
- [ ] Nenhum `console.error` de channel leak ao navegar entre dias no `DayNavigator`
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (coluna única, texto truncado adequadamente no footer do card)
```
