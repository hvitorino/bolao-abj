# Changelog: Live Scores

**Slug:** live-scores
**Branch:** feature/live-scores
**Data:** 2026-06-13
**Status:** aprovado

---

## O que foi implementado

### Hook React (Supabase Realtime)

- `lib/hooks/useGameRealtime.ts` — Hook `useGameRealtime(gameId, initialGame)` que:
  - Mantém `gameState` em `useState<Game>(initialGame)` (estado inicial vindo do SSR)
  - No `useEffect`, cria subscription Supabase Realtime para o canal `game-${gameId}` filtrando `id=eq.${gameId}` na tabela `games`, evento `UPDATE`
  - Ao receber evento, chama `setGameState(payload.new as Game)` para atualizar o estado local
  - No cleanup do `useEffect`, chama `supabase.removeChannel(channel)` para evitar memory leak
  - Retorna `gameState` atualizado em tempo real
  - Dependência do `useEffect`: apenas `[gameId]` (subscription criada uma única vez por gameId)

### Frontend (Next.js/React)

- `components/games/GameCard.tsx` — Modificado para:
  - Importar `useGameRealtime` de `@/lib/hooks/useGameRealtime`
  - Chamar `const liveGame = useGameRealtime(game.id, game)` antes das derivações de estado
  - Usar `liveGame` em vez de `game` para todas as referências a dados renderizados no JSX (status, scores, times, rodada, data, horário, sede)
  - Props `game` e `prediction` mantidas sem alteração de interface
  - Lógica de `isPending`, `isLive`, `isFinished`, `hasScore` derivada de `liveGame` (reagindo a mudanças em tempo real)
  - Estrutura e design existentes preservados integralmente

- `app/globals.css` — Animação `blink` já existia e estava correta conforme DESIGN.md:
  ```css
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .blink { animation: blink 1s step-end infinite; }
  ```
  Nenhuma alteração necessária.

### Backend (Ruby/Sinatra)

- `api/admin/games/[id].rb` — Vercel Function em Ruby/Rack com método PATCH:
  - **Autenticação:** header `X-Admin-Secret` comparado com `ENV['ADMIN_SECRET']` — retorna 401 se ausente ou inválido
  - **Validação de ID:** regex UUID v4 (`/\A[0-9a-f]{8}-...\z/i`) — retorna 400 se inválido
  - **Validação de body:** aceita `home_score` (Integer >= 0), `away_score` (Integer >= 0), `status` ('pending'|'live'|'finished') — todos opcionais mas pelo menos um obrigatório
  - **Verificação de existência:** GET via service_role antes do PATCH — retorna 404 se jogo não existe
  - **Execução:** PATCH via Supabase REST API com `service_role` + `Prefer: return=representation`
  - **Propagação Realtime:** O UPDATE no banco dispara automaticamente o Supabase Realtime via WAL replication — nenhuma lógica adicional necessária
  - CORS configurado para `PATCH, OPTIONS` com header `X-Admin-Secret` exposto
  - Constantes com nomes distintos (`SUPABASE_URL_ADMIN`, `SUPABASE_SERVICE_KEY`, `ADMIN_SECRET`) para evitar conflito com arquivos Ruby carregados no mesmo processo Vercel

### Banco de Dados

Nenhuma migration SQL adicional. A tabela `games` já existe com todos os campos necessários.

**Configuração Supabase Realtime necessária (executar manualmente no SQL Editor):**
```sql
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
```

---

## Decisões técnicas

1. **Canal por jogo (`game-${gameId}`):** Cada `GameCard` subscreve ao seu próprio canal filtrado por `id=eq.${gameId}`. Isso evita que atualizações de um jogo causem re-renders em cards de outros jogos. O custo é N conexões WebSocket simultâneas (uma por card visível), o que é aceitável para o volume do bolão.

2. **`REPLICA IDENTITY FULL`:** Necessário para que o Supabase Realtime envie os valores completos do novo registro no evento UPDATE. Sem isso, `payload.new` pode estar incompleto e o estado local ficaria desincronizado.

3. **`useEffect` com `[gameId]` como dependência:** A subscription é criada uma vez por `gameId`. Se o componente receber um `gameId` diferente (improvável no contexto atual), a subscription é limpa e recriada corretamente.

4. **`game` como `initialGame` no hook:** O estado SSR (prop `game`) é usado como valor inicial do `useState`. Isso garante que o card renderize corretamente no servidor e no primeiro render cliente, sem flash de conteúdo vazio.

5. **Constantes com sufixo `_ADMIN` no endpoint Ruby:** Para evitar conflito de nomes constantes Ruby com `predictions.rb` caso o Vercel carregue múltiplos handlers no mesmo processo, as constantes foram nomeadas `SUPABASE_URL_ADMIN`, `SUPABASE_SERVICE_KEY` e `ADMIN_SECRET`.

6. **Sem JWT no endpoint admin:** O endpoint usa `ADMIN_SECRET` compartilhado em vez de JWT de usuário. Isso simplifica a operação administrativa (script bash, curl, ferramenta interna) sem exigir login via Supabase Auth.

7. **`Net::HTTP::Patch`:** Ruby stdlib `net/http` suporta PATCH via `Net::HTTP::Patch` — não é necessário gem adicional.

---

## Pontos de atenção para o Revisor

1. **Subscription cleanup:** Verificar que `supabase.removeChannel(channel)` é chamado no retorno do `useEffect` (evitar memory leak quando o componente desmonta ou o usuário troca de dia no navigator).

2. **ADMIN_SECRET vazio:** Se `ENV['ADMIN_SECRET']` estiver vazio (ambiente não configurado), a condição `ADMIN_SECRET.empty?` retorna 401 para qualquer requisição, protegendo o endpoint mesmo sem configuração. Verificar se esse comportamento é o desejado.

3. **Realtime não ativado no Supabase:** A feature funciona no frontend (sem erro), mas sem `ALTER TABLE games REPLICA IDENTITY FULL` e `ALTER PUBLICATION supabase_realtime ADD TABLE games`, os eventos UPDATE não chegam aos clientes. A configuração é manual — não está no código.

4. **`'use client'` no topo do hook:** O arquivo `useGameRealtime.ts` contém `'use client'` no topo. Isso é necessário pois o hook usa `useState` e `useEffect`. Verificar que o GameCard (já Client Component) importa o hook corretamente.

5. **Linter:** Verificar que o import de `useGameRealtime` não gera warnings de lint na build (ex: cyclic imports, unused vars).

---

## Commits realizados

```
82d1ca7 feat(live-scores): adiciona endpoint PATCH /api/admin/games/[id] com validação ADMIN_SECRET
0d6a6b5 feat(live-scores): integra hook useGameRealtime no GameCard para placares em tempo real
d1e037f feat(live-scores): adiciona hook useGameRealtime com subscription Supabase Realtime
2807f9b chore(live-scores): adiciona plano de implementação
```
