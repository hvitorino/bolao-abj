# Fix 1: Página Pública de Jogo

**Slug:** public-game-view
**Data:** 2026-06-24
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Realtime não funciona para clientes anônimos — RLS bloqueia eventos de `games` e `scores`
**Arquivo:** `components/bolao/PublicGameClient.tsx` (linha 26) e `components/bolao/PublicParticipantsList.tsx` (linhas 45–82)
**Severidade:** crítico
**Descrição:** As tabelas `games` e `scores` têm RLS que permitem leitura apenas para `authenticated` (confirmado nas migrations `20260614193000_fix_realtime_final.sql` e `20260613000002_create_games.sql`). O Supabase Realtime respeita RLS: um cliente com anon key sem sessão não receberá eventos de UPDATE/INSERT nessas tabelas. Isso quebra o principal diferencial da feature — o placar e as pontuações não atualizam em tempo real na página pública.

Além disso, o `useGameRealtime` faz um fetch inicial `select('*').eq('id', gameId).single()` no mount usando `createClient()` (anon key). Esse fetch também será bloqueado pela RLS de `games`, fazendo o hook retornar apenas o `initialGame` do SSR sem conseguir atualizá-lo.

**Correção esperada:** Criar uma migration idempotente que adicione políticas de leitura para `anon` nas tabelas `games` e `scores`:

```sql
-- Permite leitura pública (anon) na tabela games
CREATE POLICY "Anon pode ler jogos"
  ON games FOR SELECT TO anon USING (true);

-- Permite leitura pública (anon) na tabela scores
CREATE POLICY "Anon pode ler scores"
  ON scores FOR SELECT TO anon USING (true);
```

Arquivo a criar: `supabase/migrations/20260624000010_public_read_games_scores.sql`

A migration deve usar `DROP POLICY IF EXISTS` antes de `CREATE POLICY` para ser idempotente. Não é necessário alterar nenhum componente — apenas adicionar as policies para que o Realtime com anon key funcione.

**Observação:** Os dados de `games` (placar, status) e `scores` (pontos, breakdown) não são sensíveis no contexto do bolão — a própria página pública os exibe deliberadamente. Permitir leitura anon é consistente com o objetivo da feature.

---

## Itens OK (não precisam ser revisados novamente)

- `app/jogos/[gameId]/publico/page.tsx`: Server Component correto, usa `createServiceClient()`, `notFound()` implementado, `generateMetadata` e `revalidate = 0` presentes
- Lógica de visibilidade de palpites em `pending`/`live`/`finished`: correta e alinhada com a spec
- Montagem de `ParticipantEntry[]` com ordenação (com palpite antes, depois alfabético): correta
- `PublicGameClient.tsx`: estado compartilhado via `useGameRealtime` único, evita subscriptions duplicadas; correto
- `PublicScoreCard.tsx`: visual alinhado com o padrão do projeto (`color-primary` para badge AO VIVO, igual ao `GameCard`), keyframe `blink` disponível no `globals.css`
- `PublicParticipantsList.tsx`: lógica OCULTO/PENDENTE/palpite real correta, `calculateLiveScore` chamado com assinatura correta, Realtime de scores via `useEffect` com cleanup correto
- `components/games/GameCard.tsx`: botão copiar link implementado corretamente, com estado `copied`, `handleCopyLink` com try/catch silencioso, feedback visual `✓ COPIADO!` em `color-win` por 2 segundos
- Proteção de rotas: sem `middleware.ts`; a rota `app/jogos/[gameId]/publico/` está fora do route group `(dashboard)`, portanto pública por padrão
- Layout raiz (`app/layout.tsx`) aplica `globals.css` e JetBrains Mono — página pública herda corretamente
- Build (`npm run build`) passa sem erros novos
- Lint (`npm run lint`) não introduz erros novos oriundos desta feature
- Commits em português com prefixos corretos (`feat`, `fix`, `chore`)
- Branch correta: `feature/public-game-view`
- Design: paleta de cores, tipografia monospace e estilo Elifoot respeitados em todos os componentes
