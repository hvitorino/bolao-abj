# Score & Prediction Cache — Proposta de Arquitetura

## Resumo

Centralizar a atualização de placares ao vivo e palpites em dois caches module-level (ScoreCache + PredictionCache), eliminando a duplicação atual de 6 hooks com queries redundantes. Placar usa Realtime + Polling 30s gerenciado por status do jogo. Palpites usam Realtime + Polling 60s como fallback. Ranking passa a ser puramente derivado dos caches, sem buscas próprias.

---

## 1. Diagnóstico da Situação Atual

### 1.1 Hooks existentes e suas responsabilidades

| Hook | Escopo | Mecanismo | Atualiza Placar? | Atualiza Palpite? |
|---|---|---|---|---|
| `useGameRealtime` | 1 jogo | Realtime + polling 30s | ✅ | ❌ |
| `useScoreRealtime` | 1 jogo, 1 user | Realtime (scores) | ❌ (só pontuação) | ❌ |
| `usePalpitesAoVivo` | Todos jogos do dia | **Polling 10s** | ✅ | ✅ (via poll) |
| `useLiveTodayRanking` | Todos jogos hoje | Realtime (games+scores) | ✅ | ❌ |
| `useLivePointsByUser` | Jogos live globais | Realtime (games) | ✅ | ❌ |
| `useParticipantsRealtime` | 1 jogo | Evento único na transição | ❌ | ✅ (uma vez) |

### 1.2 Problemas identificados

1. **Duplicação de queries** — `usePalpitesAoVivo`, `useLiveTodayRanking` e `useLivePointsByUser` batem nas mesmas tabelas (`games`, `predictions`, `scores`) com escopos diferentes, gerando tráfego redundante.

2. **Mecanismo inconsistente** — `useGameRealtime` usa Realtime + polling, `usePalpitesAoVivo` usa só polling (10s) sem Realtime nenhum, `useLiveTodayRanking` usa Realtime com debounce mas não cobre predictions.

3. **Palpites nunca são reativos** — Nenhum hook assina `postgres_changes` na tabela `predictions`. Se o usuário A submete um palpite, o usuário B só vê no próximo ciclo de polling (até 10s depois).

4. **Múltiplos canais Supabase por jogo** — `GameCard` cria 3 canais Realtime (`game-{id}`, `score-{id}-{userId}`, e indiretamente `useParticipantsRealtime`). Numa página com 4+ jogos, são 12+ canais WebSocket simultâneos.

5. **Sem cache entre datas** — Ao navegar entre datas no date picker, todos os dados são refetchados do zero. O cache em memória não sobrevive à troca de `selectedDate`.

---

## 2. Arquitetura Proposta

```
┌──────────────────────────────────────────────────────────────┐
│                      MODULE-LEVEL CACHE                      │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │   ScoreCache        │    │   PredictionCache        │    │
│  │   (placares)        │    │   (palpites)             │    │
│  │                     │    │                          │    │
│  │  games: Map<id,     │    │  predictions:            │    │
│  │    {score, status,  │    │    Map<gameId,           │    │
│  │     match_date}>    │    │      Map<userId, pred>>  │    │
│  │                     │    │                          │    │
│  │  Realtime: 1 canal  │    │  Realtime: 1 canal       │    │
│  │  Polling: gerido    │    │  Polling: 60s (pending)  │    │
│  │  por status do jogo │    │                          │    │
│  └────────┬────────────┘    └───────────┬──────────────┘    │
│           │                             │                    │
│           └──────────┬──────────────────┘                    │
│                      ▼                                       │
│         ┌─────────────────────────┐                         │
│         │  calculateLiveScore()   │  (já existe!)           │
│         │  Pontuação = placares   │                         │
│         │  + palpites em live    │                         │
│         └─────────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 ScoreCache — Serviço Central de Placares

Cache global com carregamento sob demanda por data. Compartilhado entre todas as instâncias do hook — `GameCard`, `PalpitesLiveCard`, `SidePanel`, `RankingTable` leem do mesmo cache.

**Estratégia por status do jogo:**

| Status | Comportamento |
|---|---|
| `finished` | Sem canal, sem polling. Dado estático no cache, servido do fetch inicial. |
| `pending` | Sem canal, sem polling. Agenda `setTimeout` para `match_date - 5min`. Ao disparar, registra o jogo para ticker. |
| `live` | Realtime (instantâneo) + Polling 30s (fallback). Ao transitar para `finished`, desativa o ticker. |

**Mecanismos de atualização:**

| Mecanismo | Gatilho | Frequência | Função |
|---|---|---|---|
| Supabase Realtime | `UPDATE` em `games` | Instantâneo | Caminho primário — atualiza `home_score`, `away_score`, `status` |
| Polling | `setInterval` por jogo live | 30s | Fallback — cobre perda de eventos Realtime (sleep, rede) |
| Timer de início | `setTimeout` por jogo pending | `match_date - 5min` | Ativa o ticker quando o jogo deve começar |
| Fetch inicial | `ensureDate(date)` | Sob demanda | Popula o cache com todos os jogos da data |

**Interface do hook:**

```typescript
function useLiveScores(selectedDate: string): {
  games: LiveGameScore[]              // jogos da data, reativos
  loading: boolean
  isLive: (gameId: string) => boolean
  getScore: (gameId: string) => { home_score, away_score, status }
}
```

Canal Realtime: um único canal global para `games` (`event: 'UPDATE'`, sem filtro de `game_id`), eliminando os N canais atuais. Cada atualização atualiza apenas a entrada correspondente no cache.

### 2.2 PredictionCache — Palpites Reativos

Cache global com Realtime + Polling de baixa frequência.

**Estratégia:**

- **Realtime:** `postgres_changes` na tabela `predictions`, filtro por `group_id`. INSERT/UPDATE/DELETE invalidam e disparam refetch.
- **Polling:** 60s, só ativo enquanto houver jogos `pending` na data. `visibilitychange` (voltar de sleep) força refetch + reseta o polling.
- **Por que 60s?** Palpites não mudam durante o jogo (estão trancados). A janela crítica é antes do jogo começar, e mesmo ali 60s é aceitável porque o Realtime cobre o caso comum instantaneamente.

**Interface do hook:**

```typescript
function usePredictionsRealtime(groupId: string, selectedDate: string): {
  predictionsByGame: Map<string, Map<string, Prediction>>  // gameId → userId → pred
  myPredictions: Map<string, Prediction>                    // atalho p/ currentUserId
  loading: boolean
}
```

Canal Realtime: um canal por grupo (`predictions-{groupId}`), filtro `group_id=eq.{groupId}`. Configuração necessária:

```sql
ALTER TABLE predictions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
```

### 2.3 Ranking Derivado (Client-Side)

O ranking do dia (`PalpitesRanking`) e o ranking geral (`RankingTable`) passam a ser puramente derivados do `ScoreCache` + `PredictionCache`, sem buscas próprias.

A lógica de agregação que hoje está espalhada em `usePalpitesAoVivo` (linhas 249–275) e `RankingTable.applyLivePoints` (linhas 77–105) é unificada numa função pura:

```typescript
function computeLiveRanking(
  scores: Map<string, GameScore>,
  predictions: Map<string, Map<string, Prediction>>,
  members: Member[]
): RankingEntry[]
```

---

## 3. Plano de Migração

| Fase | O quê | Impacto |
|---|---|---|
| 1 | Criar `ScoreCache` (module-level singleton) | Novo arquivo `lib/cache/score-cache.ts`. Sem quebrar nada existente. |
| 2 | Criar `useLiveScores` hook | Novo hook em `lib/hooks/useLiveScores.ts`. Coexiste com hooks antigos. |
| 3 | Criar `PredictionCache` + migration Realtime | `lib/cache/prediction-cache.ts` + migration SQL para habilitar `predictions` no Realtime. |
| 4 | Criar `usePredictionsRealtime` hook | `lib/hooks/usePredictionsRealtime.ts`. |
| 5 | Migrar `GameCard` | Remove `useGameRealtime` + `useScoreRealtime`. Passa a usar `useLiveScores`. |
| 6 | Migrar `PalpitesLiveSection` / `usePalpitesAoVivo` | Remove polling 10s. Usa `useLiveScores` + `usePredictionsRealtime`. |
| 7 | Migrar `RankingTable` / `useLivePointsByUser` | Remove hook próprio. Pontos live vêm do ranking derivado. |
| 8 | Migrar painel Live Today / `useLiveTodayRanking` | Remove hook próprio. |
| 9 | Remover hooks obsoletos | Limpeza final: `useGameRealtime`, `useScoreRealtime`, `usePalpitesAoVivo`, `useLivePointsByUser`, `useLiveTodayRanking`. |
| 10 | Adicionar `usePredictionsRealtime` ao `GameCard` | Substitui o fetch único do `useParticipantsRealtime` (transição pending→live) por dados já disponíveis no cache. |

---

## 4. Tabela Comparativa: Antes × Depois

| Aspecto | Antes | Depois |
|---|---|---|
| Canais Realtime (tabela `games`) | N canais (1 por jogo por hook) | 1 canal global |
| Canais Realtime (tabela `predictions`) | 0 (não existia) | 1 canal por grupo |
| Polling de placar | 30s por `GameCard` + 10s por `usePalpitesAoVivo` | 30s centralizado, só jogos live |
| Polling de palpites | 10s (`usePalpitesAoVivo`) | 60s fallback, só se há pending |
| Cache entre datas | Inexistente (refetch ao trocar) | Mantido em memória |
| Duplicação de queries | 3 hooks batem nas mesmas tabelas | 2 fontes de verdade |
| Atualização de palpites entre usuários | Até 10s de delay | Instantânea (Realtime) |

---

## 5. Premissas e Decisões

- **Cache híbrido (global + escopo por data):** o cache é compartilhado entre todas as instâncias do hook. Navegar entre datas não perde o cache das datas já visitadas. Polling é gerenciado por jogo, não por componente — se 3 componentes observam o mesmo jogo live, só há 1 `setInterval`.

- **Realtime + Polling para palpites:** escolhido sobre "apenas Realtime" pela resiliência a perda de conexão (sleep do celular, troca de rede). Polling 60s é suficiente porque palpites não mudam durante jogos live/finished.

- **`useParticipantsRealtime` mantido:** a transição pending→live que revela palpites ocultos continua usando o hook existente, mas passa a consumir dados do `PredictionCache` em vez de fazer fetch próprio. A lógica de "buscar uma vez na transição" permanece válida.

- **Migration SQL necessária:** habilitar `predictions` para Supabase Realtime (`REPLICA IDENTITY FULL` + `ALTER PUBLICATION`). Mesmo padrão já aplicado em `scores` (migration `20260614_enable_realtime_publications.sql`).

- **`calculateLiveScore` existente é mantido:** a função pura que calcula pontuação parcial client-side não muda. Apenas passa a ser alimentada pelos caches centralizados em vez de queries diretas.
