# Spec: Correção — Revelação de Palpites ao Vivo

**Slug:** fix-predictions-reveal-on-live
**Data:** 2026-06-17
**Status:** spec

---

## Objetivo

Corrigir o bug em que, quando o status de um jogo muda de `pending` para `live` via Supabase Realtime, os palpites dos demais participantes continuam exibidos como `OCULTO` ou `-` na UI até que o usuário recarregue manualmente a página.

A causa raiz é que `participants` — o array de `ParticipantEntry[]` passado como prop estática ao `GameCard` — é calculado no Server Component (`app/(dashboard)/jogos/page.tsx`) no momento do render SSR e nunca é atualizado no cliente. O hook `useGameRealtime` atualiza `liveGame.status` corretamente (fazendo o badge "AO VIVO" aparecer), mas o componente não tem mecanismo para re-buscar os palpites dos participantes quando essa transição de status ocorre.

---

## Causa Raiz (Diagnóstico)

### Fluxo atual

1. `app/(dashboard)/jogos/page.tsx` (Server Component) executa 5 queries em paralelo no mount, incluindo `allPredictions` (linha 147–153) via RLS — que **não retorna** `home_score`/`away_score` de terceiros para jogos `pending`, por design da feature `fix-prediction-visibility`.
2. Os dados resultantes são montados em `participantsByGameId` e passados como props para `GameList` → `GameCard` (como `participants: ParticipantEntry[]`) → `GameParticipantsList`.
3. `GameCard` usa `useGameRealtime(game.id, game)` (em `lib/hooks/useGameRealtime.ts`) para receber eventos de UPDATE na tabela `games` via Supabase Realtime e atualiza `liveGame` via `setGame`.
4. Quando `liveGame.status` muda para `'live'`, `GameCard` passa `gameStatus={liveGame.status}` para `GameParticipantsList` (linha 511 de `GameCard.tsx`), o que corretamente muda a lógica de exibição da coluna PALPITE de `'pending'` para `'live'`.
5. **Entretanto**, `participants` permanece o array SSR original, que para jogos que eram `pending` tem `prediction: null` para todos os terceiros (RLS bloqueou) e `hasPrediction` indicando apenas existência.
6. Resultado: `GameParticipantsList` recebe `gameStatus === 'live'` mas `p.prediction === null` para todos — exibe `-` em vez dos placares reais.

### Arquivos e linhas envolvidos

| Arquivo | Linha | Papel no bug |
|---------|-------|-------------|
| `app/(dashboard)/jogos/page.tsx` | 147–153 | Query `allPredictions` via RLS — retorna `null` em `home_score`/`away_score` para jogos `pending` de terceiros |
| `app/(dashboard)/jogos/page.tsx` | 220–233 | Monta `participantsByGameId` com `prediction: null` para terceiros em jogos `pending` |
| `components/games/GameCard.tsx` | 507–516 | Passa `participants` (prop estática SSR) para `GameParticipantsList` — nunca atualiza |
| `components/games/GameCard.tsx` | 73–78 | `useGameRealtime` atualiza `liveGame.status` mas não dispara refetch de palpites |
| `lib/hooks/useGameRealtime.ts` | 80–89 | Handler do evento UPDATE: atualiza `game` mas não comunica mudança de status a nenhum outro hook |

---

## Histórias de Usuário

- Como participante do bolão visualizando a página de jogos, quando um jogo que eu estava assistindo muda para "ao vivo", quero ver automaticamente os palpites de todos os outros participantes revelados, sem precisar recarregar a página.
- Como participante do bolão, quando abro a página de jogos com um jogo já em status `live`, quero ver os palpites de todos já carregados desde o primeiro render.

---

## Modelo de Dados

Nenhuma tabela nova ou migration necessária. O fix é puramente client-side.

---

## Backend — Endpoints

### GET /api/participants-predictions

**Autenticação:** requerida (Bearer JWT)
**Query params:**
```
game_id: uuid   — ID do jogo
group_id: uuid  — ID do grupo ativo
```
**Autenticação:** header `Authorization: Bearer <token>` ou cookie de sessão Supabase.

**Resposta de sucesso (200):**
```json
[
  {
    "user_id": "uuid",
    "game_id": "uuid",
    "home_score": 2,
    "away_score": 1
  }
]
```

**Erros possíveis:**
- 401: não autenticado
- 400: `game_id` ou `group_id` ausentes

**Implementação:** Route Handler Next.js em `app/api/participants-predictions/route.ts`. Usa o cliente Supabase com sessão do usuário autenticado (RLS ativa). Como o jogo já está `live` no momento da chamada, a policy de RLS em `predictions` permite ler palpites de terceiros (policy `fix-prediction-visibility` bloqueia apenas jogos `pending`). Retorna somente `user_id, game_id, home_score, away_score` — sem dados desnecessários.

**Nota de segurança:** este endpoint **não** usa `service_role`. A RLS é a barreira correta aqui: se o jogo for `live` ou `finished`, a policy já permite a leitura; se por alguma race condition o jogo ainda for `pending` quando a chamada chegar, a RLS retorna linhas sem `home_score`/`away_score` (null), e o componente trata `null` como ausência de palpite — sem vazamento.

---

## Frontend — Componentes React

### Hook `useParticipantsRealtime`

**Arquivo:** `lib/hooks/useParticipantsRealtime.ts`

**Assinatura:**
```typescript
export function useParticipantsRealtime(
  gameId: string,
  groupId: string,
  initialParticipants: ParticipantEntry[],
  initialGameStatus: 'pending' | 'live' | 'finished'
): ParticipantEntry[]
```

**Props:**
- `gameId` — UUID do jogo
- `groupId` — UUID do grupo ativo
- `initialParticipants` — array SSR inicial de `ParticipantEntry[]`
- `initialGameStatus` — status do jogo no momento do SSR

**Estados internos:**
- `participants: ParticipantEntry[]` — começa com `initialParticipants`
- `hasFetchedForLive: boolean` — flag para evitar refetch redundante

**Comportamento:**

1. **Mount com jogo já `live` ou `finished`:** se `initialGameStatus !== 'pending'`, dispara imediatamente um fetch de `/api/participants-predictions?game_id=<gameId>&group_id=<groupId>` e funde os resultados com `initialParticipants` (atualiza `prediction` de cada participante preservando `name`, `points`, `breakdown`, `hasPrediction`).

2. **Subscrição ao canal Realtime do jogo:** recebe o mesmo evento de UPDATE que `useGameRealtime` recebe na tabela `games`. Quando `payload.new.status === 'live'` **e** `payload.old?.status === 'pending'` (ou `hasFetchedForLive === false`), dispara o fetch de palpites e marca `hasFetchedForLive = true`.

3. **Merge de dados:** o fetch retorna `{ user_id, game_id, home_score, away_score }[]`. O hook atualiza `participants` preservando todos os outros campos (`name`, `points`, `breakdown`, `hasPrediction`) do `initialParticipants` — faz merge por `userId`.

4. **Cleanup:** cancela a subscription Realtime ao desmontar.

**Canais Realtime:**
- Tabela: `games`
- Evento: `UPDATE`
- Filtro: `id=eq.<gameId>`
- Canal: `game-participants-${gameId}` (canal separado de `game-${gameId}` usado pelo `useGameRealtime` para evitar conflito de estado)

**Transição suave:** o fetch retorna em milissegundos (Supabase Postgres, query simples). Para evitar flash de estado vazio durante a transição, o hook **nunca limpa o array atual** antes do fetch completar — apenas mescla os novos valores por cima.

**Race condition — jogo já `live` no mount:**

Cenário: usuário abre a página com o jogo já em `live`. O Server Component carregou `participants` com `prediction: null` para terceiros porque a query foi montada a partir dos dados SSR — mesmo que o jogo já fosse `live` no servidor, a query pode ter chegado com RLS permitindo leitura, porém o `predByUserGame` só captura palpites que passaram pela RLS. Verificar se há dados faltando é simples: se `initialGameStatus !== 'pending'` e algum participante tem `prediction === null`, é sinal de que o fetch SSR não capturou tudo (ou o jogo acabou de mudar). O hook cobre esse caso pelo caminho (1) acima — fetch imediato no mount quando `initialGameStatus !== 'pending'`.

### Modificação em `GameCard.tsx`

**Arquivo:** `components/games/GameCard.tsx`

**Mudança:** substituir o uso direto da prop `participants` pelo valor retornado pelo novo hook `useParticipantsRealtime`.

```typescript
// Antes (linha ~507):
// participants={participants}  — prop SSR estática passada diretamente para GameParticipantsList

// Depois:
const liveParticipants = useParticipantsRealtime(
  game.id,
  groupId,
  participants,
  game.status as 'pending' | 'live' | 'finished'
)
// ...
// <GameParticipantsList participants={liveParticipants} ... />
```

A prop `participants` original de `GameCard` não muda de assinatura — continua sendo `ParticipantEntry[]` recebida do SSR. A única mudança é que `GameCard` agora gerencia os participantes localmente via hook em vez de passar a prop diretamente para baixo.

**Nota:** `useParticipantsRealtime` NÃO deve duplicar a lógica de status que `useGameRealtime` já faz. O hook apenas observa o canal Realtime de `games` para detectar a transição de status, mas **não** gerencia o estado do jogo — isso permanece responsabilidade de `useGameRealtime`.

### Route Handler `app/api/participants-predictions/route.ts`

**Arquivo:** `app/api/participants-predictions/route.ts`

**Método:** GET

**Implementação:**
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('game_id')
  const groupId = searchParams.get('group_id')

  if (!gameId || !groupId) {
    return Response.json({ error: 'game_id e group_id são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, game_id, home_score, away_score')
    .eq('game_id', gameId)
    .eq('group_id', groupId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data ?? [])
}
```

Usa `createClient()` do servidor (com sessão do usuário autenticado) para que a RLS se aplique automaticamente — retorna apenas os palpites visíveis para o usuário naquele momento.

---

## Regras de Negócio

1. **Visibilidade temporalizada continua intacta:** o hook só faz o fetch quando o status já não é `pending`. A RLS em `predictions` (implementada por `fix-prediction-visibility`) continua sendo a barreira primária — se o fetch chegar quando o jogo ainda for `pending`, a RLS retorna `home_score`/`away_score` como `null` para terceiros, e o hook trata `null` como `prediction: null` (sem alterar nada).

2. **Merge não sobrescreve dados do próprio usuário:** o `GameCard` já gerencia o palpite do usuário logado separadamente via `currentPrediction` (state local). O merge do hook só atualiza participantes pelo `userId` — o dado do usuário logado na `GameParticipantsList` via `participants` é apenas para exibição na tabela; o dado autoritativo para o formulário permanece em `currentPrediction`.

3. **Idempotência:** `hasFetchedForLive` garante que o fetch ocorre apenas uma vez por transição `pending → live`. Eventos Realtime duplicados ou chegadas tardias não disparam múltiplos fetches.

4. **Sem flash de estado vazio:** o hook nunca esvazia `participants` antes de receber os dados. Enquanto o fetch está em andamento, os dados SSR são exibidos (OCULTO/PENDENTE para terceiros, valor real para o usuário logado). Após o fetch retornar, os valores são mesclados.

5. **Jogo já `live` no mount:** coberto pelo path de inicialização do hook — dispara fetch imediato se `initialGameStatus !== 'pending'`. Isso cobre usuários que:
   - Abrem a página com o jogo já ao vivo
   - Retornam para a aba após o jogo ter iniciado (React remonta o componente)

---

## Proteção de Rotas

- O Route Handler `GET /api/participants-predictions` requer autenticação via `supabase.auth.getUser()`. Sem sessão válida, retorna 401.
- Nenhuma rota nova de página é adicionada.

---

## Integração Supabase Realtime

**Hook:** `useParticipantsRealtime`
**Tabela observada:** `games`
**Evento:** `UPDATE`
**Canal:** `game-participants-${gameId}`
**Filtro:** `id=eq.<gameId>`

**Ao receber o evento:**
```
if (payload.new.status === 'live' && !hasFetchedForLive) {
  fetch('/api/participants-predictions?game_id=<gameId>&group_id=<groupId>')
    .then(data => merge data into participants state)
  hasFetchedForLive = true
}
```

**Importante:** este canal é independente do canal `game-${gameId}` já criado por `useGameRealtime`. Ambos observam o mesmo evento na mesma tabela/filtro, mas gerenciam estados diferentes (game state vs. participants state). O Supabase permite múltiplos canais com nomes distintos para o mesmo evento — não há conflito.

Alternativamente, se o canal duplicado for indesejável, `useGameRealtime` pode ser refatorado para expor também o `previousStatus` como parte do seu estado retornado, e `useParticipantsRealtime` pode usar um `useEffect` que observa `currentStatus` via prop em vez de criar canal próprio. A decisão cabe ao Programador — ambas as abordagens são válidas, mas a abordagem com canal próprio é mais autocontida.

---

## Critérios de Aceite

- [ ] Quando `games.status` muda para `live` via Supabase Realtime, os palpites de todos os participantes são carregados e exibidos automaticamente em `GameParticipantsList` sem necessidade de reload manual
- [ ] Ao carregar/recarregar a página com um jogo já em `live`, os palpites dos participantes são exibidos sem precisar esperar por evento Realtime
- [ ] Durante a transição `pending → live`, nenhum flash de estado vazio ocorre — os dados anteriores (OCULTO/PENDENTE) são mantidos até o fetch concluir
- [ ] A lógica de `prediction-visibility` continua correta: em jogos `pending`, terceiros continuam vendo OCULTO/PENDENTE; o hook não interfere nesse estado
- [ ] O palpite do usuário logado continua exibido corretamente em todas as situações (gerenciado por `currentPrediction` no `GameCard`, independente do hook)
- [ ] O Route Handler `GET /api/participants-predictions` retorna 401 para requisições sem autenticação
- [ ] O Route Handler retorna 400 se `game_id` ou `group_id` forem omitidos
- [ ] Nenhuma subscription Realtime é mantida após o card desmontar (cleanup correto)
- [ ] `hasFetchedForLive` evita fetches duplicados quando múltiplos eventos Realtime chegam
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros de TypeScript
- [ ] Design segue DESIGN.md: nenhum componente visual é alterado — a mudança é exclusivamente de lógica de dados
- [ ] Funciona para todos os usuários conectados simultaneamente (cada GameCard é independente e gerencia seu próprio estado)
