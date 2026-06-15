# Changelog: Placares em Tempo Real (Realtime)

**Slug:** live-scores-realtime
**Branch:** feature/live-scores-realtime
**Data:** 2026-06-14
**Status:** aprovado

---

## Correções e Melhorias (Pós-implementação inicial)

### Resiliência de Payload e RLS

- **`lib/hooks/useGameRealtime.ts`** — Alterado para usar atualização funcional `setGame(prev => ({ ...prev, ...payload.new }))`. Isso torna o hook resiliente a payloads parciais do Supabase (caso `REPLICA IDENTITY FULL` falhe ou envie apenas mudanças) e remove a trava de segurança excessiva que exigia o campo `status` em cada update de placar.
- **`lib/hooks/useRankingRealtime.ts`** — Implementado **debounce de 1000ms** para as chamadas de `fetchRanking`. Evita que o browser dispare dezenas de requisições simultâneas ao encerrar um jogo (quando dezenas de linhas em `scores` são inseridas/atualizadas).
- **`supabase/migrations/20260614193000_fix_realtime_final.sql`** — Relaxado o RLS da tabela `scores` para permitir `SELECT` a todos os usuários autenticados. Sem isso, usuários que não participaram de um jogo não recebiam os eventos Realtime e o ranking ficava estático para eles.
- **`lib/hooks/useScoreRealtime.ts`** — Também atualizado para usar merge de estado funcional.

---

## O que foi implementado inicialmente

### Banco de Dados

- `db/migrations/20260614_enable_realtime_publications.sql` — migration idempotente que executa `ALTER TABLE games REPLICA IDENTITY FULL`, `ALTER TABLE scores REPLICA IDENTITY FULL` e adiciona ambas as tabelas à publicação `supabase_realtime` (via blocos `DO $$ IF NOT EXISTS $$` para reexecutabilidade segura). Pré-requisito para que `payload.new` contenha o registro completo nos eventos UPDATE.

### Frontend (Next.js/React)

- `lib/hooks/useGameRealtime.ts` — refatorado para retornar `GameRealtimeState { game, lastUpdatedAt, connectionStatus }` em vez de `Game` diretamente. Adicionado callback `subscribe((status) => ...)` que mapeia `SUBSCRIBED` → `'connected'` e `CHANNEL_ERROR`/`TIMED_OUT` → `'error'`. Interface `GameRealtimeState` exportada para uso em testes e outros componentes.

- `components/games/GameCard.tsx` — desestrutura o novo retorno `{ game: liveGame, lastUpdatedAt }` do hook. Adicionado `setInterval` de 10 segundos (criado apenas quando `isLive === true`, limpo no cleanup do `useEffect`) que força re-render para recalcular `formatElapsed(lastUpdatedAt)`. No footer do card, quando ao vivo e `lastUpdatedAt !== null`, exibe `· atualizado há Xs` (ou `Xmin` para >=60s) em `color-muted` (11px). O `setInterval` não é criado para jogos `pending` ou `finished`.

- `lib/hooks/useRankingRealtime.ts` — adicionado `lastUpdatedAt: Date | null` ao estado e ao tipo de retorno. O valor é atualizado via `setLastUpdatedAt(new Date())` dentro de `fetchRanking` após `setRanking(data)` bem-sucedido — isso inclui o carregamento inicial e cada refetch disparado por evento Realtime.

- `components/bolao/RankingTable.tsx` — desestrutura `lastUpdatedAt` do hook. No header da tabela, o badge `● AO VIVO` agora exibe `· HH:MM:SS` quando `lastUpdatedAt !== null`, formatado com `toLocaleTimeString('pt-BR')`. Adicionado helper `formatTime(date: Date): string`.

---

## Decisões técnicas

**`lastUpdatedAt` no fetch inicial do ranking:** A spec menciona duas abordagens (atualizar apenas no callback Realtime ou sempre após fetchRanking). Optou-se pela versão mais simples: `setLastUpdatedAt(new Date())` dentro de `fetchRanking` para todos os fetches, inclusive o inicial. Isso fornece ao usuário imediatamente o horário em que os dados foram carregados, que é informação útil mesmo antes de qualquer evento Realtime.

**`void tick` no GameCard:** O `tick` do `setInterval` não é usado diretamente no JSX — sua atualização causa re-render que recalcula `formatElapsed`. Para silenciar o aviso de ESLint/TypeScript sobre variável não usada, usou-se `void tick`.

**`connectionStatus` exposto mas não exibido:** Conforme a spec (regra 2 — graceful degradation), o `connectionStatus: 'error'` não gera mensagem visível ao usuário. A propriedade está disponível no retorno do hook para uso futuro em dashboards de diagnóstico.

**`flexWrap: 'wrap'` no footer do GameCard:** Adicionado para garantir que em telas pequenas o timestamp de atualização quebre para nova linha sem overflow — sem isso, o texto `atualizado há Xs` poderia sobresair do card em mobile.

---

## Pontos de atenção para o Revisor

1. **Migration:** Precisa ser executada manualmente no SQL Editor do Supabase em ambientes existentes. O arquivo está em `db/migrations/20260614_enable_realtime_publications.sql`.

2. **Retrocompatibilidade de `useGameRealtime`:** O retorno mudou de `Game` para `GameRealtimeState`. Verificar se há outros consumidores do hook além do `GameCard` que possam ter sido impactados.

3. **`void tick` é a solução correta?** Alternativa seria usar `tick` na key de algum elemento ou como dependência do `formatElapsed`, mas isso causaria remontagem desnecessária. O `void tick` é mais idiomático.

4. **Timestamp no ranking sempre presente (incluindo carga inicial):** Confirmar que exibir o horário do fetch inicial no `RankingTable` está dentro do espírito da spec, onde a wording diz "atualizado" — que pode incluir o carregamento.

5. **Testabilidade:** Nenhum teste automatizado foi adicionado nesta feature (não havia testes pré-existentes no projeto). O comportamento Realtime é difícil de testar unitariamente sem mock do canal Supabase.

---

## Commits realizados

```
77e0ab7 feat(live-scores-realtime): exibe timestamp HH:MM:SS ao lado de AO VIVO no RankingTable
6848d69 feat(live-scores-realtime): adiciona lastUpdatedAt ao retorno de useRankingRealtime
0462dea feat(live-scores-realtime): adiciona timestamp de última atualização e tick de 10s no GameCard
d2d267a feat(live-scores-realtime): atualiza useGameRealtime para retornar lastUpdatedAt e connectionStatus
904ec80 feat(live-scores-realtime): adiciona migration para habilitar publicação Realtime
f4433f3 chore(live-scores-realtime): adiciona plano de implementação
```
