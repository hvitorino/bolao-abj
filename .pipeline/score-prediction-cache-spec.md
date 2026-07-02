# Spec: Cache Centralizado de Placar e Palpites

**Slug:** score-prediction-cache
**Data:** 2026-07-01
**Status:** spec

---

## Objetivo

Centralizar a atualização de placares ao vivo e palpites em dois caches module-level (`ScoreCache` + `PredictionCache`), eliminando a duplicação atual de 6 hooks com queries redundantes nas tabelas `games`, `predictions` e `scores`. Placar usa Realtime + Polling 30s gerenciado por status do jogo. Palpites usam Realtime + Polling 60s como fallback. Ranking passa a ser puramente derivado dos caches, sem buscas próprias.

---

## Histórias de Usuário

- Como participante, quero que os palpites de outros participantes no meu grupo sejam atualizados instantaneamente (via Realtime) quando alguém submete ou edita um palpite, em vez de esperar até 10 segundos pelo próximo ciclo de polling.
- Como participante, quero navegar entre datas no calendário sem que os dados dos jogos já visitados sejam refetchados do zero — mantendo cache em memória das datas já carregadas.
- Como usuário, quero que o placar ao vivo atualize rapidamente (Realtime), com polling de fallback de 30s caso o WebSocket caia.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma tabela nova. Apenas configuração de Realtime na tabela existente `predictions`.

### Migrations necessárias

**Migration:** `supabase/migrations/20260701_enable_realtime_predictions.sql`

```sql
-- 1. Habilita REPLICA IDENTITY FULL para predictions (essencial para payload.new completo nos eventos)
ALTER TABLE predictions REPLICA IDENTITY FULL;

-- 2. Adiciona predictions à publicação supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
  END IF;
END $$;
```

Este é o mesmo padrão já aplicado em `games` e `scores` na migration `20260614193000_fix_realtime_final.sql`.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. A feature é 100% client-side + Supabase Realtime.

---

## Frontend — Componentes React

### ScoreCache (module-level singleton)

**Arquivo:** `lib/cache/score-cache.ts`

Cache global com carregamento sob demanda por data. Compartilhado entre todas as instâncias do hook — `GameCard`, `PalpitesLiveCard`, `SidePanel`, `RankingTable` leem do mesmo cache.

**Estratégia por status do jogo:**

| Status | Comportamento |
|--------|---------------|
| `finished` | Sem canal, sem polling. Dado estático, servido do fetch inicial. |
| `pending` | Sem canal, sem polling. Agenda `setTimeout` para `match_date - 5min`. Ao disparar, registra o jogo para ticker. |
| `live` | Realtime (instantâneo) + Polling 30s (fallback). Ao transitar para `finished`, desativa o ticker. |

**Mecanismos de atualização:**

| Mecanismo | Gatilho | Frequência | Função |
|-----------|---------|------------|--------|
| Supabase Realtime | `UPDATE` em `games` | Instantâneo | Caminho primário — atualiza `home_score`, `away_score`, `status` |
| Polling | `setInterval` por jogo live | 30s | Fallback — cobre perda de eventos Realtime (sleep, rede) |
| Timer de início | `setTimeout` por jogo pending | `match_date - 5min` | Ativa o ticker quando o jogo deve começar |
| Fetch inicial | `ensureDate(date)` | Sob demanda | Popula o cache com todos os jogos da data |

**Interface interna (não exportada como classe, mas como funções + hook):**

```typescript
// Tipos
interface CachedGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
  round: string
  phase: string
}

interface LiveGameScore extends CachedGame {
  lastUpdatedAt: Date | null
  connectionStatus: 'connecting' | 'connected' | 'error'
}

// Cache interno (module-level, não exportado)
const scoreCache: Map<string, CachedGame[]> = new Map()  // date → games[]
const liveTimers: Map<string, ReturnType<typeof setInterval>> = new Map()  // gameId → timer
const pendingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()  // gameId → timer
```

Canal Realtime: um único canal global para `games` (evento `UPDATE`, sem filtro de `game_id`), eliminando os N canais atuais. Cada atualização dispara callback que atualiza apenas a entrada correspondente no cache.

### useLiveScores hook

**Arquivo:** `lib/hooks/useLiveScores.ts`

```typescript
function useLiveScores(selectedDate: string): {
  games: LiveGameScore[]
  loading: boolean
  isLive: (gameId: string) => boolean
  getScore: (gameId: string) => { home_score: number | null; away_score: number | null; status: string }
}
```

**Estados:** loading | populated | error
**Comportamento:**
- No primeiro acesso a uma data, chama `ensureDate(date)` que faz fetch de todos os jogos da data
- Datas já visitadas retornam do cache imediatamente (sem loading)
- Jogos `live` têm polling 30s gerenciado centralmente (não por componente)
- Se 3 componentes observam o mesmo jogo live, só há 1 `setInterval` no cache
- Realtime: 1 canal global para tabela `games`, evento `UPDATE`

### PredictionCache (module-level singleton)

**Arquivo:** `lib/cache/prediction-cache.ts`

Cache global com Realtime + Polling de baixa frequência.

**Estratégia:**
- **Realtime:** `postgres_changes` na tabela `predictions`, filtro por `group_id`. INSERT/UPDATE/DELETE invalidam e disparam refetch.
- **Polling:** 60s, só ativo enquanto houver jogos `pending` na data. `visibilitychange` (voltar de sleep) força refetch + reseta o polling.
- **Por que 60s?** Palpites não mudam durante o jogo (estão trancados). A janela crítica é antes do jogo começar, e mesmo ali 60s é aceitável porque o Realtime cobre o caso comum instantaneamente.

**Interface interna:**

```typescript
// Tipos
interface CachedPrediction {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

// Cache interno
const predictionCache: Map<string, Map<string, CachedPrediction>> = new Map()  // date → gameId:userId → pred
```

### usePredictionsRealtime hook

**Arquivo:** `lib/hooks/usePredictionsRealtime.ts`

```typescript
function usePredictionsRealtime(groupId: string, selectedDate: string): {
  predictionsByGame: Map<string, Map<string, Prediction>>
  myPredictions: Map<string, Prediction>
  loading: boolean
  hasData: boolean
}
```

**Estados:** loading | populated | empty
**Comportamento:**
- No primeiro acesso, busca todos os palpites da data para o grupo
- Datas já visitadas retornam do cache imediatamente
- Realtime: 1 canal por grupo (`predictions-{groupId}`), filtro `group_id=eq.{groupId}`
- Polling 60s fallback, só ativo quando há jogos `pending` na data
- `visibilitychange` força refetch + reseta polling

### computeLiveRanking (função pura)

**Arquivo:** `lib/ranking-derived.ts`

```typescript
function computeLiveRanking(
  scores: Map<string, CachedGame>,          // gameId → CachedGame
  predictions: Map<string, Map<string, CachedPrediction>>,  // gameId → userId → pred
  members: { user_id: string; name: string }[]
): {
  userId: string
  name: string
  totalPoints: number          // official (finished) + live (partial)
  rankPosition: number
  hasLivePoints: boolean
  gamesDetail: GameScoreEntry[]  // mesmo formato de usePalpitesAoVivo
}[]
```

Unifica a lógica que hoje está espalhada em:
- `usePalpitesAoVivo` (linhas 249–275: cálculo de `todayPointsByUser`)
- `RankingTable.applyLivePoints` (linhas 77–105)
- `useLivePointsByUser` (inteiro: fetch de jogos live + cálculo client-side)
- `useLiveTodayRanking` (linhas 147–233: pontos oficiais + parciais)

---

## Regras de Negócio

### Gerenciamento de polling por status

- **finished:** nunca faz polling. Dado é estático.
- **live:** polling 30s + Realtime ativo. Ao transitar para `finished` (detectado via Realtime ou polling), desativa o ticker.
- **pending:** sem polling. Timer único (`setTimeout`) agenda ativação para `match_date - 5min`. Ao disparar, adiciona o jogo ao ticker de `live`.

### Ativação do ticker

Quando um jogo `pending` atinge `match_date - 5min`:
1. O timer dispara
2. O jogo é registrado no conjunto de jogos monitorados
3. Polling 30s começa (se ainda não começou)
4. Quando o status mudar para `live` (detectado por Realtime ou polling), transita para o comportamento `live`
5. Quando status mudar para `finished`, remove do ticker

### Realtime para predictions

- 1 canal por `groupId`: `predictions-{groupId}`, filtro `group_id=eq.{groupId}`
- Eventos: INSERT, UPDATE, DELETE
- Ao receber qualquer evento, invalida o cache da data correspondente e refetch
- Migration necessária: `ALTER TABLE predictions REPLICA IDENTITY FULL; ALTER PUBLICATION supabase_realtime ADD TABLE predictions;`

### Invalidação de cache

- ScoreCache: nunca invalidado — atualizações chegam via Realtime ou polling
- PredictionCache: invalidado via Realtime (evento em `predictions`) ou polling
- Ambos sobrevivem à navegação entre datas (mantidos em memória)
- Limpeza: apenas ao trocar de `groupId` (todo o cache é descartado)

---

## Proteção de Rotas

Nenhuma rota nova. Toda a lógica é client-side dentro de componentes já protegidos pelo layout `(dashboard)`.

---

## Integração Supabase Realtime

### Canal: games (global)

- **Tabela:** `games`
- **Eventos:** UPDATE
- **Canal:** `live-scores-global` (nome único, sem filtro de game_id)
- **Ação:** atualiza `CachedGame` correspondente no `ScoreCache` via `game.id`

### Canal: predictions (por grupo)

- **Tabela:** `predictions`
- **Eventos:** INSERT, UPDATE, DELETE
- **Canal:** `predictions-{groupId}`
- **Filtro:** `group_id=eq.{groupId}`
- **Ação:** invalida cache da data + refetch assíncrono

---

## Critérios de Aceite

- [ ] `ScoreCache` (`lib/cache/score-cache.ts`) criado como module-level singleton
- [ ] `useLiveScores` hook substitui `useGameRealtime` em `GameCard` — 1 canal Realtime global em vez de N canais
- [ ] `PredictionCache` (`lib/cache/prediction-cache.ts`) criado com Realtime + Polling 60s
- [ ] `usePredictionsRealtime` hook criado — palpites de outros usuários chegam instantaneamente via Realtime
- [ ] `computeLiveRanking` (`lib/ranking-derived.ts`) unifica cálculo de ranking derivado client-side
- [ ] Migration SQL criada: `ALTER TABLE predictions REPLICA IDENTITY FULL` + `ALTER PUBLICATION`
- [ ] `GameCard` migrado para `useLiveScores` — remove `useGameRealtime` + `useScoreRealtime`
- [ ] `PalpitesLiveSection` / `usePalpitesAoVivo` migrado para `useLiveScores` + `usePredictionsRealtime` — remove polling 10s
- [ ] `RankingTable` / `useLivePointsByUser` migrado para `computeLiveRanking` — remove hook próprio
- [ ] `LiveTodayBottomSheet` / `useLiveTodayRanking` migrado para `computeLiveRanking` — remove hook próprio
- [ ] `useParticipantsRealtime` refatorado para consumir `PredictionCache` em vez de fetch próprio
- [ ] Hooks obsoletos removidos: `useGameRealtime`, `useScoreRealtime`, `usePalpitesAoVivo`, `useLivePointsByUser`, `useLiveTodayRanking`
- [ ] Cache entre datas mantido em memória (sem refetch ao navegar)
- [ ] Design segue DESIGN.md (sem alterações visuais — apenas refatoração de dados)
- [ ] Funciona em mobile (coluna única)
- [ ] `npm run lint` e `npm run build` passam sem erros
