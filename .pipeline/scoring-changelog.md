# Changelog: Pontuação (Scoring)

**Slug:** scoring
**Branch:** feature/scoring
**Data:** 2026-06-13
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `db/migrations/20260613_create_scores.sql` — Migration completa:
  - Tabela `scores` com `UNIQUE(prediction_id)`, índices em `user_id`, `game_id`, `(user_id, game_id)`
  - RLS habilitado: SELECT apenas para o próprio usuário (`auth.uid() = user_id`); sem INSERT/UPDATE/DELETE via RLS
  - Função Postgres `calculate_scores_for_game(p_game_id uuid)` com `SECURITY DEFINER`: itera sobre todos os palpites de um jogo e faz UPSERT em `scores` com pontuação calculada e breakdown JSON
  - Função Postgres `trigger_calculate_scores()`: dispara ao mudar `status` para `'finished'` (com placar definido)
  - Trigger `on_game_finished` na tabela `games` (AFTER UPDATE, FOR EACH ROW)
  - Comentários de configuração Realtime (executar manualmente: `REPLICA IDENTITY FULL` + `ALTER PUBLICATION`)

### Backend (Ruby/Sinatra)

- `api/scores/calculate.rb` — Vercel Function em Ruby/Rack com POST:
  - **POST /api/scores/calculate** — Recálculo manual de pontuações para um jogo
  - Autenticação via `X-Admin-Secret` (mesmo padrão do endpoint admin PATCH games)
  - Valida `game_id` (UUID v4) e presença no banco
  - Verifica que jogo está `status = 'finished'` com placar definido (retorna 422 caso contrário)
  - Chama função Postgres via Supabase RPC (`POST /rest/v1/rpc/calculate_scores_for_game`)
  - CORS configurado para POST, OPTIONS com header `X-Admin-Secret`
  - Constantes com sufixo `_SCORES` para evitar conflito com outros handlers Ruby

### Frontend (Next.js/React)

- `lib/types/score.ts` — Interface `ScoreBreakdown` e `Score` com todos os campos da tabela

- `lib/scoring.ts` — Lib TypeScript com lógica de pontuação espelhando o Postgres:
  - `calculateScore(game, prediction)` → `{ points, breakdown }` — lógica completa de todas as 6 regras
  - `BREAKDOWN_LABELS` — rótulos em português para cada campo do breakdown
  - Comentários documentando casos-limite (empate exato, goleada+exato, etc.)

- `lib/hooks/useScoreRealtime.ts` — Hook `useScoreRealtime(gameId, userId, initialScore)`:
  - Subscription para tabela `scores`, evento `*` (INSERT e UPDATE), filtro `game_id=eq.${gameId}`
  - Callback filtra `payload.new.user_id === userId` (segurança dupla no cliente)
  - Cleanup: `supabase.removeChannel(channel)` no retorno do `useEffect`
  - Dependências: `[gameId, userId]`

- `components/bolao/ScoreDisplay.tsx` — Componente de exibição de breakdown:
  - Cabeçalho: placar real + palpite + total de pontos em `color-accent`
  - Lista apenas itens do breakdown com pontos > 0 (com símbolo `✓` em `color-win`)
  - Linha "TOTAL" separada por `border-top: 1px solid var(--color-border)`
  - Estado zero ("✗ SEM PONTOS NESTE JOGO") em `color-muted`
  - Borda `color-primary`, fundo `color-surface`, fonte monospace
  - Componente puramente visual (sem estado)

- `components/games/GameCard.tsx` — Modificado para:
  - Aceitar novas props: `score?: Score | null`, `userId?: string`
  - Importar `useScoreRealtime` e `ScoreDisplay`
  - Chamar `const liveScore = useScoreRealtime(game.id, userId ?? '', score)` para atualização em tempo real
  - Na área de palpite, jogo `finished` com palpite: exibe `PredictionDisplay` + `ScoreDisplay` (quando `liveScore` disponível e placar definido)

- `components/games/GameList.tsx` — Modificado para:
  - Aceitar novas props: `scoresByGameId?: Record<string, Score>`, `userId?: string`
  - Repassar `score={scoresByGameId[game.id] ?? null}` e `userId` para cada `GameCard`

- `app/(dashboard)/jogos/page.tsx` — Modificado para:
  - Importar tipo `Score`
  - Buscar scores do usuário para os jogos do dia após buscar predictions
  - Construir `scoresByGameId` (map game_id → Score) para acesso O(1)
  - Repassar `scoresByGameId` e `userId` para `GameList`

- `app/(dashboard)/meus-palpites/page.tsx` — Página Server Component nova:
  - Autentica usuário (redirect para `/login` se não autenticado)
  - Busca todos os palpites do usuário ordenados por data (mais recentes primeiro)
  - Busca jogos e scores correspondentes em queries separadas
  - Tabela compacta estilo Elifoot com 4 colunas: JOGO | PALPITE | RESULTADO | PONTOS
  - Coluna PONTOS: valor em `color-accent` (encerrado com score), "PENDENTE" em `color-muted`, "—" (encerrado sem score)
  - Resumo do maior bônus (`✓ exato`, `✓ venc.`, `✓ parcial`) abaixo da pontuação
  - Rodapé com total de pontos em `color-accent`
  - Estado vazio: "NENHUM PALPITE REGISTRADO"

---

## Decisões técnicas

1. **Trigger Postgres como mecanismo primário:** O trigger `on_game_finished` calcula scores automaticamente quando o admin atualiza `status = 'finished'`, sem dependência de chamada manual. O endpoint Ruby `POST /api/scores/calculate` é o fallback para recálculo em caso de correção de placar pós-encerramento.

2. **`SECURITY DEFINER` na função Postgres:** A função `calculate_scores_for_game` precisa fazer INSERT/UPDATE em `scores` sem passar pelo RLS (que só permite SELECT). `SECURITY DEFINER` garante que a função roda com permissões do owner (superuser Postgres), não do caller.

3. **UPSERT com `ON CONFLICT (prediction_id)`:** Garante idempotência: chamar `calculate_scores_for_game` duas vezes para o mesmo jogo produz o mesmo resultado sem criar duplicatas.

4. **Filtragem dupla de `userId` no hook Realtime:** O filtro Supabase `game_id=eq.${gameId}` reduz o tráfego de rede. O `if (newScore.user_id === userId)` no callback é uma segunda camada de segurança client-side para garantir que o usuário nunca veja score de outra pessoa mesmo que o filtro falhe.

5. **`userId` como prop em `GameCard`:** O `userId` vem do Server Component da página (via `supabase.auth.getUser()`). Isso evita que o Client Component precise chamar `supabase.auth.getUser()` do lado do cliente — mais seguro e eficiente.

6. **Busca de scores separada na página `/jogos`:** A query de scores é feita separadamente (não em JOIN com predictions) por clareza e para manter compatibilidade com a query de predictions existente. O volume é pequeno (apenas jogos do dia), então a performance é aceitável.

7. **Espelhamento TypeScript/Postgres:** A lib `lib/scoring.ts` espelha a lógica da função Postgres para testes e uso futuro (ex: preview de pontuação antes de confirmar palpite, testes unitários). A fonte da verdade para pontuação é sempre o Postgres.

---

## Pontos de atenção para o Revisor

1. **Casos-limite da lógica de pontuação:** Verificar mentalmente:
   - Empate exato (ex: 1×1 palpitado e 1×1 real): winner=3 + exact=5 = **8 pts** ✓
   - Empate sem acerto (ex: palpite 2×0 em jogo 1×1): **0 pts** ✓
   - Goleada + placar exato (ex: 4×0 palpitado e 4×0 real): winner=3 + exact=5 + goleada=1 = **9 pts** ✓
   - Goleada + acerto vencedor sem exato (ex: palpite 2×0 em jogo 4×0): winner=3 + diff=2 + goleada=1 = **6 pts** ✓
   - Acerto só perdedor (ex: palpite 1×2 em jogo 3×2): loser_score=1 = **1 pt** ✓
   - Acerto vencedor + winner_score + diff (ex: palpite 2×1 em jogo 3×2): winner=3 + diff=2 = **5 pts** (winner_score=0 pois não acertou o placar do vencedor: 2 ≠ 3)

2. **Trigger apenas quando status muda para `finished`:** Se o admin atualiza apenas `home_score`/`away_score` em jogo já `finished`, o trigger NÃO dispara (pois `status` não mudou). Para esses casos, chamar manualmente `POST /api/scores/calculate`.

3. **Configuração Realtime manual:** As linhas `ALTER TABLE scores REPLICA IDENTITY FULL` e `ALTER PUBLICATION supabase_realtime ADD TABLE scores` estão comentadas na migration — devem ser executadas manualmente no Supabase SQL Editor.

4. **`userId ?? ''` no hook:** Quando `userId` é `undefined` (usuário não logado ou prop não passada), o hook cria uma subscription com `userId = ''`. Isso é inofensivo — nenhum score terá `user_id = ''` — mas idealmente o hook não deveria ser chamado sem userId. O comportamento é seguro.

5. **Coluna PONTOS em mobile:** A tabela usa `gridTemplateColumns: '1fr auto auto auto'`. Em telas muito pequenas (<320px), as colunas auto podem comprimir. Verificar se o layout mantém legibilidade em mobile.

---

## Commits realizados

```
b1d2546 feat(scoring): adiciona página /meus-palpites com tabela de palpites e pontuações
285474e feat(scoring): integra ScoreDisplay no GameCard e busca scores na página /jogos
c25c24f feat(scoring): adiciona componente ScoreDisplay com breakdown visual estilo Elifoot
a8b42f2 feat(scoring): adiciona hook useScoreRealtime com subscription Supabase Realtime para tabela scores
15aab37 feat(scoring): adiciona endpoint Ruby POST /api/scores/calculate para recálculo manual via admin
2d40194 feat(scoring): adiciona tipo Score e lib de cálculo de pontuação em TypeScript
d928ad9 feat(scoring): adiciona migration SQL para tabela scores com função e trigger de cálculo automático
```
