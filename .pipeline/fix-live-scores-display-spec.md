# Spec: Correção — Exibição e Atualização de Placar em Tempo Real

**Slug:** fix-live-scores-display
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Corrigir a exibição do placar de jogos com status `live` na aba `/jogos` e garantir que atualizações de `home_score`/`away_score` cheguem ao frontend via Supabase Realtime sem necessidade de refresh. O jogo Holanda x Japão está em andamento (status `live`) mas o placar não aparece corretamente.

---

## Histórias de Usuário

- Como participante do bolão, quero ver o placar atual dos jogos ao vivo na aba `/jogos` sem precisar recarregar a página
- Como participante do bolão, quero ver o badge `██ AO VIVO ██` piscando nos jogos em andamento
- Como participante do bolão, quero que minha pontuação parcial seja atualizada automaticamente enquanto o jogo está ao vivo

---

## Diagnóstico: Causas Raiz Identificadas

A análise do código existente revela múltiplas causas possíveis para o bug. O Programador deve investigar e corrigir **todas** as causas identificadas abaixo.

### Causa 1 — `scoreText` retorna `'0 × 0'` pelo caminho errado (BUG CONFIRMADO)

**Arquivo:** `components/games/GameCard.tsx` — linhas 81–88

```typescript
const hasScore = liveGame.home_score !== null && liveGame.away_score !== null
const scoreText = hasScore
  ? `${liveGame.home_score} × ${liveGame.away_score}`
  : isLive
    ? '0 × 0'
    : '- × -'
```

**Problema:** Quando o jogo está `live` e o placar é `0 × 0`, `hasScore` é `true` (valores são `0`, não `null`). O texto `0 × 0` é exibido pelo primeiro branch — correto. Porém quando o banco guarda `home_score: null` e `away_score: null` para um jogo `live` que ainda não iniciou o placar (ex: acabou de passar para `live` antes de qualquer gol), o texto cai no segundo branch e exibe `'0 × 0'`. Este comportamento é correto mas pode causar confusão.

**Bug real:** Se o banco retorna `home_score: 0` (zero inteiro) via SSR, o JSON serializa como `0`. Porém a interface TypeScript `Game` declara `home_score: number | null`. Não há bug de tipagem aqui. O bug real é que **o estado SSR passado como `initialGame` pode conter `home_score: null` mesmo quando o jogo está `live` com placar `0 × 0`**, porque o administrador pode não ter definido os scores antes de mudar o status para `live`. Neste caso, `hasScore` é `false` e o scoreText cai no branch `isLive ? '0 × 0' : '- × -'` — que mostra `0 × 0` — o que é o comportamento correto. Não há bug neste caminho.

**Conclusão:** A lógica de `scoreText` está correta. O bug de exibição está em outro lugar.

### Causa 2 — Migrations do Realtime podem não ter sido aplicadas no ambiente de produção (ALTO RISCO)

**Arquivo:** `db/migrations/20260614_enable_realtime_publications.sql`

A migration que habilita `REPLICA IDENTITY FULL` e `ALTER PUBLICATION supabase_realtime ADD TABLE games` é marcada como "executar manualmente" no changelog de `live-scores-realtime`. Se não foi executada no projeto Supabase de produção, o Realtime não entrega eventos UPDATE com `payload.new` completo.

**Diagnóstico:** Sem `REPLICA IDENTITY FULL`, o `payload.new` no evento `UPDATE` pode chegar vazio ou parcial. O hook `useGameRealtime` chama `setGame(payload.new as Game)` e se `payload.new` está vazio, o estado local é sobrescrito com um objeto incompleto, podendo até limpar o placar exibido.

**Ação necessária:** Verificar no SQL Editor do Supabase se `REPLICA IDENTITY` está `FULL` para ambas as tabelas e se estão na publicação.

### Causa 3 — `useScoreRealtime` filtra por `game_id` mas RLS pode bloquear eventos para outros usuários (MÉDIO RISCO)

**Arquivo:** `lib/hooks/useScoreRealtime.ts` — linha 38–40

```typescript
filter: `game_id=eq.${gameId}`,
```

O filtro Supabase Realtime opera **antes** do RLS nos canais `postgres_changes`. Porém se as políticas RLS da tabela `scores` restringem leitura apenas ao `user_id` do próprio usuário, o canal Realtime pode não receber eventos de outros usuários mesmo com o filtro correto.

**Impacto:** O score do próprio usuário pode não chegar via Realtime se a RLS bloquear o evento WAL antes de ser enviado ao canal. A dupla filtragem no callback (`if (newScore.user_id === userId)`) é defensiva mas não resolve o bloqueio na origem.

**Ação necessária:** Verificar as políticas RLS da tabela `scores` e garantir que o usuário autenticado pode receber eventos Realtime do seu próprio score.

### Causa 4 — `payload.new` com score `0` pode ser interpretado como falsy em verificações implícitas (BAIXO RISCO)

**Arquivo:** `lib/hooks/useGameRealtime.ts` — linha 41

```typescript
setGame(payload.new as Game)
```

Se `payload.new` chega com `home_score: 0`, a atribuição `as Game` é segura porque TypeScript não altera o valor. Porém em algum ponto da cadeia de exibição pode haver uma verificação `if (liveGame.home_score)` (falsy check) em vez de `if (liveGame.home_score !== null)`. O código atual em `GameCard.tsx` usa `!== null` corretamente, mas é necessário verificar se há outros componentes ou funções que processam o placar com verificação falsy.

**Arquivo a verificar:** `lib/scoring.ts` — verificar se a lógica de preview usa `!== null` em vez de verificação booleana implícita.

### Causa 5 — Múltiplas instâncias do Supabase client podem criar canais duplicados (BAIXO RISCO)

**Arquivo:** `lib/supabase/client.ts`

```typescript
export function createClient() {
  return createBrowserClient(...)
}
```

`createClient()` é chamado **dentro do `useEffect`** em cada hook (`useGameRealtime`, `useScoreRealtime`, `useRankingRealtime`). O `@supabase/ssr` `createBrowserClient` usa singleton internamente por URL+key — então múltiplas chamadas retornam o mesmo cliente. Este não é um bug, mas vale confirmar que o singleton está funcionando corretamente para não multiplicar conexões WebSocket.

---

## Modelo de Dados

### Nenhuma tabela nova

Esta feature é uma correção — não requer novas tabelas ou colunas.

### Verificações no banco (não são migrations, são diagnósticos)

O Programador deve verificar e corrigir o estado do Supabase executando as queries abaixo no SQL Editor:

```sql
-- Verificar se REPLICA IDENTITY está FULL para games e scores
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('games', 'scores');
-- Esperado: relreplident = 'f' (FULL) para ambas

-- Verificar se games e scores estão na publicação supabase_realtime
SELECT pubname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('games', 'scores');
-- Esperado: 2 linhas retornadas

-- Verificar políticas RLS na tabela scores
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'scores';
```

Se `relreplident != 'f'` ou as tabelas não estão na publicação, re-executar a migration `20260614_enable_realtime_publications.sql` manualmente no SQL Editor do Supabase.

Se não há política RLS de SELECT para `scores` cobrindo o usuário autenticado para seus próprios scores, adicionar:

```sql
-- Migration: fix_scores_realtime_rls (executar se necessário)
-- Garante que o usuário pode ler seus próprios scores via Realtime
CREATE POLICY IF NOT EXISTS "users can read own scores"
ON scores FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

---

## Backend — Nenhum endpoint novo

Esta feature não requer novos endpoints Ruby/Sinatra. O endpoint `PATCH /api/admin/games/[id].rb` já existe e está funcional.

---

## Frontend — Correções nos Componentes React

### 1. `useGameRealtime.ts` — Verificação de `payload.new` incompleto

**Arquivo:** `lib/hooks/useGameRealtime.ts`

**Problema a corrigir:** Se `payload.new` chega vazio ou incompleto (por falta de `REPLICA IDENTITY FULL`), `setGame(payload.new as Game)` sobrescreve o estado com dados inválidos.

**Correção:** Adicionar guarda defensiva antes de atualizar o estado. Só atualizar se `payload.new` tiver pelo menos os campos essenciais:

```typescript
(payload) => {
  const newGame = payload.new as Partial<Game>
  // Guarda defensiva: só atualiza se os campos essenciais estão presentes
  if (newGame.id && newGame.status !== undefined) {
    setGame(newGame as Game)
    setLastUpdatedAt(new Date())
  }
}
```

**Justificativa:** Sem `REPLICA IDENTITY FULL`, `payload.new` pode ser `{}`. Sobrescrever o estado com objeto vazio apagaria o placar exibido — o usuário veria o jogo "zerar" ou sumir.

### 2. `useScoreRealtime.ts` — Adicionar filtro duplo no nível Supabase

**Arquivo:** `lib/hooks/useScoreRealtime.ts`

**Problema a corrigir:** O filtro atual é apenas `game_id=eq.${gameId}`. O canal recebe scores de todos os usuários naquele jogo, filtrando no callback JavaScript. Com RLS ativo, o canal pode não receber nada se a política RLS bloquear o row antes de chegar ao canal Realtime.

**Correção:** Não é possível combinar dois filtros em `postgres_changes` do Supabase (apenas um filtro por canal). A solução é garantir que a política RLS permita o usuário autenticado ler seu próprio score, conforme descrito na seção de banco de dados. No código, manter o filtro por `game_id` (mais específico que sem filtro) e manter a verificação `newScore.user_id === userId` no callback como dupla segurança.

**Verificação adicional:** Confirmar que o `userId` passado ao hook nunca é string vazia quando o usuário está logado. Em `GameCard.tsx` linha 76:

```typescript
const liveScore = useScoreRealtime(game.id, userId ?? '', score)
```

Se `userId` é `undefined`, o hook recebe string vazia `''`. A subscription é criada mas nunca filtrará corretamente. O `useEffect` tem `[gameId, userId]` como dependências — se `userId` mudar de `''` para o UUID real, a subscription é recriada corretamente. Porém há uma janela onde a subscription existe com userId vazio. Adicionar early return no `useEffect` quando `userId` está vazio:

```typescript
useEffect(() => {
  if (!userId) return  // não subscreve sem userId válido
  const supabase = createClient()
  // ... resto do hook
}, [gameId, userId])
```

### 3. `GameCard.tsx` — Verificar lógica de exibição do placar para jogos `live`

**Arquivo:** `components/games/GameCard.tsx`

**Verificação necessária:** A lógica atual:

```typescript
const hasScore = liveGame.home_score !== null && liveGame.away_score !== null
const scoreText = hasScore
  ? `${liveGame.home_score} × ${liveGame.away_score}`
  : isLive
    ? '0 × 0'
    : '- × -'
```

Esta lógica está correta. Porém há um caso de borda: se o banco tem `home_score: 0` e `away_score: 0` (placar 0-0 real), `hasScore` é `true` e `scoreText` é `'0 × 0'` — correto.

**O problema real de exibição:** O `scoreText` depende de `liveGame`, que vem do hook `useGameRealtime`. O `initialGame` passado ao hook é o dado do SSR (`game` prop). Se o SSR carregou `home_score: null` (jogo recém-iniciado como `live` sem scores ainda), o placar mostra `0 × 0` pelo branch `isLive`. Quando o Realtime entrega um UPDATE com `home_score: 2, away_score: 1`, o estado atualiza e o placar passa a mostrar `2 × 1`. Este fluxo está correto — **se o Realtime estiver funcionando**.

**Nenhuma alteração necessária neste arquivo** além das que já emergem das correções nos hooks.

### 4. `GameParticipantsList.tsx` — Verificar atualização em tempo real dos palpites exibidos

**Arquivo:** `components/bolao/GameParticipantsList.tsx`

**Verificação necessária:** A lista de participantes com palpites e pontuações é passada como prop `participants` do SSR em `page.tsx`. Ela **não atualiza via Realtime** — exibe o snapshot do momento do carregamento da página.

**Para esta feature de correção:** Não é necessário adicionar Realtime à lista de participantes — isso é escopo de uma feature futura. A spec se limita ao placar do card principal e à pontuação do próprio usuário.

---

## Procedimento de Diagnóstico e Correção

O Programador deve seguir esta sequência antes de modificar código:

### Passo 1 — Verificar estado do banco de dados

Executar no SQL Editor do Supabase (projeto de produção):

```sql
SELECT relname, relreplident FROM pg_class WHERE relname IN ('games', 'scores');
SELECT pubname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('games', 'scores');
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'scores';
```

Se `relreplident != 'f'` para qualquer das tabelas ou se a tabela não está na publicação, re-executar `db/migrations/20260614_enable_realtime_publications.sql` no SQL Editor.

### Passo 2 — Verificar no Supabase Dashboard

No painel Supabase > Database > Replication, confirmar que `games` e `scores` aparecem como tabelas replicadas.

No painel Supabase > Database > Row Level Security, confirmar as políticas ativas para `scores`.

### Passo 3 — Aplicar correções no código

Aplicar as correções descritas na seção Frontend na ordem:

1. `lib/hooks/useGameRealtime.ts` — guarda defensiva em `payload.new`
2. `lib/hooks/useScoreRealtime.ts` — early return quando `userId` está vazio
3. Verificar `components/bolao/GameParticipantsList.tsx` — apenas leitura, sem alteração esperada

### Passo 4 — Adicionar política RLS se necessário

Se as queries do Passo 1 revelarem ausência de política de leitura para `scores`, executar no SQL Editor:

```sql
CREATE POLICY IF NOT EXISTS "users can read own scores"
ON scores FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

Esta política permite que o Realtime entregue eventos de scores do próprio usuário.

---

## Regras de Negócio

1. **Placar de jogo `live` com `home_score: 0, away_score: 0`:** Deve exibir `0 × 0` em `color-accent` — não `- × -`. O valor zero é um placar válido.

2. **Placar de jogo `live` com `home_score: null, away_score: null`:** Deve exibir `0 × 0` em `color-accent` pelo fallback do `scoreText` — indica que o jogo iniciou mas sem placar ainda definido.

3. **Guarda defensiva no Realtime:** Se `payload.new` chegar incompleto (sem campos essenciais), **não** atualizar o estado. Manter o estado anterior (SSR ou último update válido).

4. **Memory leaks:** Toda subscription criada em `useEffect` deve ter cleanup no retorno do effect via `supabase.removeChannel(channel)`. Verificar que os três hooks (`useGameRealtime`, `useScoreRealtime`, `useRankingRealtime`) têm cleanup correto.

5. **Subscription com `userId` vazio:** `useScoreRealtime` não deve criar subscription se `userId` está vazio ou undefined — retorna `initialScore` e faz early return no `useEffect`.

---

## Proteção de Rotas

Nenhuma alteração nas proteções de rotas existentes. A rota `/jogos` já requer autenticação.

---

## Integração Supabase Realtime

### Canal `games` (existente em `useGameRealtime`)

- **Tabela:** `games`
- **Evento:** `UPDATE`
- **Canal:** `game-${gameId}` (um por card de jogo)
- **Filtro:** `id=eq.${gameId}`
- **Pré-requisito banco:** `REPLICA IDENTITY FULL` + tabela na publicação `supabase_realtime`
- **Ao receber evento:** Atualizar `game` e `lastUpdatedAt` somente se `payload.new` tem campos essenciais (`id`, `status`)

### Canal `scores` (existente em `useScoreRealtime`)

- **Tabela:** `scores`
- **Evento:** `INSERT` e `UPDATE` (evento `*`)
- **Canal:** `score-${gameId}-${userId}`
- **Filtro:** `game_id=eq.${gameId}`
- **Pré-requisito banco:** `REPLICA IDENTITY FULL` + tabela na publicação + política RLS que permite leitura do próprio score
- **Ao receber evento:** Filtrar `newScore.user_id === userId` no callback antes de atualizar o estado

---

## Critérios de Aceite

- [ ] O placar do jogo Holanda x Japão (status `live`) aparece corretamente na aba `/jogos` sem necessidade de refresh
- [ ] Se `home_score: 0, away_score: 0`, o placar exibido é `0 × 0` em `color-accent` — não `- × -`
- [ ] O badge `██ AO VIVO ██` aparece e pisca (classe `.blink`) para jogos com `status: 'live'`
- [ ] Ao executar `PATCH /api/admin/games/[id]` com novos scores, o frontend atualiza o placar em até 3 segundos sem reload
- [ ] A pontuação do usuário na tabela `scores` atualiza em tempo real quando calculada
- [ ] `useGameRealtime` não sobrescreve o estado quando `payload.new` é incompleto (objeto vazio)
- [ ] `useScoreRealtime` não cria subscription quando `userId` está vazio
- [ ] Ao navegar para outro dia e voltar, não há memory leak — o canal antigo foi removido
- [ ] As migrations do Realtime (`REPLICA IDENTITY FULL` + publicação) estão confirmadas como aplicadas no banco de produção
- [ ] Design segue DESIGN.md: `color-live` para badge ao vivo, `color-accent` para placar, fonte monospace
- [ ] Funciona em mobile (card em coluna única, placar centralizado)
