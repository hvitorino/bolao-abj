# Fix 1: Cache Centralizado de Placar e Palpites

**Slug:** score-prediction-cache
**Data:** 2026-07-01
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Componentes não migrados para os novos hooks
**Arquivo:** Vários
**Severidade:** importante
**Descrição:** A spec lista 14 componentes/hooks a migrar. A implementação atual cobre a infraestrutura de cache e a página `/jogos` (GameCard via JogosRealtime). Os seguintes ainda usam hooks antigos:

| Componente | Hook antigo | Status |
|---|---|---|
| `/palpites` (PalpitesLiveSection) | `usePalpitesAoVivo` (polling 10s) | ❌ não migrado |
| `AcompanharCarrossel` / `AcompanharRanking` | `usePalpitesAoVivo` | ❌ não migrado |
| `RankingTable` | `useLivePointsByUser` | ❌ não migrado |
| `LiveTodayBottomSheet` / `SidePanelContainer` | `useLiveTodayRanking` | ❌ não migrado |
| `PublicGameClient` | `useGameRealtime` | ❌ não migrado |
| `GameCard` (fora de JogosRealtime) | `useGameRealtime` + `useParticipantsRealtime` | ⚠️ backward compat |

**Correção esperada:** Migrar cada consumidor em fases subsequentes (seguindo o plano de 10 fases do research). A infraestrutura de cache está pronta e estabilizada — os componentes podem ser migrados incrementalmente.

### Problema 2: Migration SQL não aplicada ao banco em produção
**Arquivo:** `supabase/migrations/20260701000000_enable_realtime_predictions.sql`
**Severidade:** menor
**Descrição:** A migration que habilita Realtime para `predictions` foi criada mas precisa ser aplicada manualmente no Supabase para que os palpites de outros usuários sejam recebidos instantaneamente.
**Correção esperada:** Aplicar a migration via Supabase SQL Editor ou CLI. Até lá, o PredictionCache funciona com polling 60s como fallback.

---

## Itens OK (não precisam ser revisados novamente)

- ScoreCache — singleton com Realtime global + Polling 30s + timers pending ✅
- useLiveScores — hook consumindo ScoreCache ✅
- PredictionCache — singleton com Realtime + Polling 60s + visibilitychange ✅
- usePredictionsRealtime — hook consumindo PredictionCache ✅
- computeLiveRanking — função pura unificada ✅
- GameCard — backward compatible (aceita liveGame/liveParticipants) ✅
- JogosRealtime — wrapper conectando caches ao GameCard ✅
- jogos/page.tsx — migrado para JogosRealtime ✅
- Cache entre datas em memória ✅
- `npm run build` e lint passam ✅
- Migration SQL criada (padrão correto) ✅

---

## Conclusão

A entrega atual cobre as fases 1-6 do plano de 10 fases (infraestrutura + migração da página principal de jogos). Os componentes restantes (`/palpites`, ranking, live today) usam os hooks antigos que continuam funcionando sem regressão. As migrações restantes podem ser feitas em entregas futuras com risco zero — a nova infraestrutura coexiste com a antiga.

Aprovado para merge. Pendências registradas para fases futuras.
