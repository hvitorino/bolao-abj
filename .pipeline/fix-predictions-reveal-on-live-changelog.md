# Changelog: Correção — Revelação de Palpites ao Vivo

**Slug:** fix-predictions-reveal-on-live
**Branch:** feature/fix-predictions-reveal-on-live
**Data:** 2026-06-17
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js Route Handler)
- `app/api/participants-predictions/route.ts` — novo endpoint GET autenticado que retorna `user_id, game_id, home_score, away_score` de todos os palpites do grupo para um jogo específico. Usa o cliente Supabase com JWT do usuário autenticado para que a RLS se aplique automaticamente (palpites de terceiros só são visíveis quando o jogo é `live` ou `finished`). Retorna 401 sem autenticação, 400 para parâmetros inválidos ou ausentes, 500 em erro do banco.

### Frontend (Next.js/React)
- `lib/hooks/useParticipantsRealtime.ts` — novo hook `"use client"` que gerencia o estado de `ParticipantEntry[]` com dois comportamentos complementares:
  1. **Mount com jogo já live/finished:** dispara fetch imediato via `/api/participants-predictions` para revelar palpites sem esperar evento Realtime.
  2. **Transição pending → live via Realtime:** subscreve ao canal `game-participants-<gameId>` na tabela `games` (evento UPDATE) e dispara fetch quando `payload.new.status === 'live'`.
  - Merge preserva todos os campos SSR (`name`, `points`, `breakdown`, `hasPrediction`) — apenas atualiza `prediction` quando `home_score`/`away_score` não forem null.
  - `hasFetchedForLive` (ref) garante idempotência: fetch ocorre apenas uma vez por ciclo de vida do componente.
  - Nunca esvazia o array antes do fetch concluir — dados SSR mantidos como fallback durante carregamento.

- `components/games/GameCard.tsx` — integrado o novo hook:
  - Import de `useParticipantsRealtime` adicionado.
  - `liveParticipants` obtido via `useParticipantsRealtime(game.id, groupId, participants, game.status)`.
  - Substituídas as duas ocorrências de `participants` por `liveParticipants` (toggle de visibilidade e `GameParticipantsList`).
  - A prop `participants` original do componente não foi alterada — continua sendo `ParticipantEntry[]` recebida do SSR; apenas o dado passado para baixo agora é gerenciado localmente pelo hook.

---

## Decisões técnicas

**Canal Realtime separado:** o hook usa o canal `game-participants-${gameId}` (não `game-${gameId}`, usado por `useGameRealtime`). Ambos observam o mesmo evento (UPDATE em `games`), mas gerenciam estados independentes. O Supabase suporta múltiplos canais com nomes distintos para o mesmo evento sem conflito.

**`useRef` para `hasFetchedForLive`:** usamos `useRef` em vez de `useState` para a flag de idempotência, pois mudar a flag não deve disparar re-render — ela é uma variável de controle interna.

**Sem polling extra:** o hook não adiciona polling — já existe polling de fallback em `useGameRealtime` a cada 30s para cobrir lacunas de Realtime. O hook de participantes apenas reage a eventos de status, sem sobrepor essa lógica.

**RLS como barreira primária:** o endpoint não usa `service_role`. Se o fetch chegar com o jogo ainda `pending` (race condition), a RLS retorna `home_score`/`away_score` como null para terceiros, e o merge trata null como ausência de prediction — sem vazamento de dados.

**`mergeWithPredictions` com check de null:** a função de merge verifica explicitamente `payload.home_score === null || payload.away_score === null` antes de atualizar — garante que race conditions não substituam `OCULTO` por um prediction vazio.

---

## Pontos de atenção para o Revisor

1. **Segurança do endpoint:** verificar que a autenticação com Bearer JWT é obrigatória e que o cliente é instanciado com o JWT do usuário (não service_role) — RLS deve ser a barreira.
2. **Idempotência:** verificar que `hasFetchedForLive` (ref) impede fetches duplicados quando múltiplos eventos Realtime chegam para o mesmo jogo.
3. **Sem flash de estado vazio:** confirmar que `mergeWithPredictions` nunca retorna array vazio — sempre preserva o estado anterior.
4. **Regressão em prediction-visibility:** verificar que jogos `pending` continuam exibindo OCULTO/PENDENTE corretamente (hook só faz fetch quando `initialGameStatus !== 'pending'` ou quando Realtime envia `status === 'live'`).
5. **Limpeza de subscriptions:** o canal `game-participants-${gameId}` é removido via `supabase.removeChannel(channel)` no cleanup do `useEffect`.
6. **Lint pré-existente:** o error em `group-switcher.tsx` e os 4 warnings em `jogos/page.tsx`/`RankingTable.tsx` são todos anteriores a esta feature — nenhum erro novo introduzido.

---

## Commits realizados

```
bcc0022 feat(fix-predictions-reveal-on-live): integra useParticipantsRealtime no GameCard
e3fe18b feat(fix-predictions-reveal-on-live): cria hook useParticipantsRealtime para revelação automática de palpites
f585e3e feat(fix-predictions-reveal-on-live): cria Route Handler GET /api/participants-predictions
9048611 chore(fix-predictions-reveal-on-live): adiciona plano de implementação
```
