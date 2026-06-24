# Spec: Página Pública de Jogo

**Slug:** public-game-view
**Data:** 2026-06-24
**Status:** spec

---

## Objetivo

Criar uma página pública (sem autenticação) em `/jogos/[gameId]/publico` que exibe o placar ao vivo, os palpites de todos os participantes do bolão e a pontuação atualizada de cada um para aquele jogo, atualizando em tempo real via Supabase Realtime. Adicionar ao `GameCard` (área autenticada) um botão "copiar link" que copia a URL dessa página para a área de transferência, com feedback visual de confirmação.

---

## Histórias de Usuário

- Como participante do bolão, quero copiar um link da página pública de um jogo para compartilhar com amigos, sem precisar que eles façam login
- Como amigo/familiar de um participante, quero acessar `/jogos/[gameId]/publico` sem precisar criar conta e ver o placar ao vivo, os palpites e as pontuações de todos
- Como participante, quero que os palpites só apareçam na página pública quando o jogo já tiver começado, para não revelar palpites antecipadamente a quem não jogou

---

## Modelo de Dados

### Tabelas envolvidas (sem migration nova)

As tabelas `games`, `predictions`, `scores` e `profiles` já existem. A feature precisa apenas que o papel `anon` do Supabase tenha permissão de leitura pública nas tabelas relevantes.

#### Políticas RLS necessárias (migration idempotente)

As queries da página pública serão executadas via `service_role` no Server Component Next.js — esse cliente bypassa RLS completamente. Não é necessário alterar políticas RLS existentes para que a página funcione.

**Decisão arquitetural:** usar `createServiceClient()` (já existe em `lib/supabase/service-server.ts`) no Server Component da página pública, exatamente como é feito em `app/(dashboard)/jogos/page.tsx` para a query de existência de palpites. A página pública é um Server Component que roda no servidor; o cliente `anon` sem sessão seria insuficiente dado que `predictions` e `scores` têm RLS restritivo. Não criar política `anon` pública nas tabelas de palpites, pois isso afetaria outras superfícies.

A página pública em si não requer autenticação — apenas o Server Component usa `service_role` internamente para buscar os dados, sem expor a service key ao browser.

**Regra de visibilidade de palpites:** em jogos `pending`, a query de palpites/scores para a página pública deve retornar apenas existência (`hasPrediction: boolean`) sem valores reais. Em jogos `live` ou `finished`, retorna os valores completos (`home_score`, `away_score`, `points`, `breakdown`). Esta lógica é idêntica à de `prediction-visibility` — reutilizar o padrão já estabelecido.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo necessário. Todos os dados são buscados pelo Server Component Next.js diretamente via Supabase com `service_role`.

---

## Frontend — Componentes React

### Estrutura de rotas

A rota pública deve ficar **fora** do route group `(dashboard)` para não ser interceptada pelo middleware de autenticação do layout de dashboard. O middleware protege apenas o route group `(dashboard)` via `app/(dashboard)/layout.tsx`.

**Localização correta:** `app/jogos/[gameId]/publico/page.tsx`

**Nota:** a rota `app/(dashboard)/jogos/[gameId]/analise/` já existe dentro do dashboard. A nova rota pública usa um caminho paralelo fora do grupo `(dashboard)`, o que é válido no App Router do Next.js — rotas fora de route groups são públicas por padrão.

---

### 1. PublicGamePage

**Arquivo:** `app/jogos/[gameId]/publico/page.tsx`

**Tipo:** Server Component assíncrono (sem `'use client'`)

**Props:** `params: Promise<{ gameId: string }>`

**Dados buscados (via `createServiceClient()`):**

```typescript
// 1. Dados do jogo
const { data: game } = await serviceClient
  .from('games')
  .select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, round, match_date, venue')
  .eq('id', gameId)
  .maybeSingle()

// Se game === null, chama notFound() do Next.js

// 2. Todos os perfis (para montar lista de nomes)
const { data: profiles } = await serviceClient
  .from('profiles')
  .select('id, name')

// 3. Palpites — se status !== 'pending', busca valores reais; se 'pending', busca apenas existência
// Para status 'pending':
const { data: existencePredictions } = await serviceClient
  .from('predictions')
  .select('user_id, game_id')
  .eq('game_id', gameId)

// Para status 'live' ou 'finished':
const { data: fullPredictions } = await serviceClient
  .from('predictions')
  .select('user_id, game_id, home_score, away_score')
  .eq('game_id', gameId)

// 4. Scores (somente para 'finished'; para 'live' o cálculo é client-side)
const { data: scores } = await serviceClient
  .from('scores')
  .select('user_id, game_id, points, breakdown')
  .eq('game_id', gameId)
```

**Montagem de `ParticipantEntry[]`:**

```typescript
// Mesmo padrão de app/(dashboard)/jogos/page.tsx, adaptado para a página pública:
// - Para jogos pending: prediction=null, hasPrediction=true/false, points=null, breakdown=null
// - Para jogos live/finished: prediction com valores reais, hasPrediction=true quando prediction existe
```

**Estrutura JSX da página:**

```
<PublicGameLayout>           // Layout wrapper (sem header de dashboard, sem TabBar)
  <PublicGameHeader />       // Cabeçalho com nome do jogo e link de volta (opcional)
  <PublicScoreCard game={game} />  // Placar com times, status e rodada
  <PublicParticipantsList
    participants={participants}
    gameStatus={game.status}
    gameId={game.id}
    initialHomeScore={game.home_score}
    initialAwayScore={game.away_score}
  />
</PublicGameLayout>
```

**Metadata (SEO):**

```typescript
export async function generateMetadata({ params }) {
  // Busca home_team, away_team via service client
  return {
    title: `${home_team} × ${away_team} — Bolão da Copa`,
    description: `Palpites e pontuação ao vivo`,
  }
}
```

**revalidate:** `export const revalidate = 0` — sem cache estático; dados sempre frescos no SSR inicial.

---

### 2. PublicScoreCard

**Arquivo:** `components/bolao/PublicScoreCard.tsx`

**Tipo:** Client Component (`'use client'`) — precisa do Realtime para atualizar o placar

**Props:**

```typescript
interface PublicScoreCardProps {
  gameId: string
  initialGame: {
    id: string
    home_team: string
    away_team: string
    home_team_code: string
    away_team_code: string
    home_score: number | null
    away_score: number | null
    status: string
    round: string
    match_date: string
    venue: string | null
  }
}
```

**Comportamento:**
- Usa `useGameRealtime(gameId, initialGame)` (hook já existente) para subscrever ao canal `game-${gameId}` e receber atualizações de placar via Supabase Realtime
- Exibe placar no estilo do componente "Placar de Jogo" de DESIGN.md:
  - Header: `RODADA · DATA · HORÁRIO BRT`
  - Times nas extremidades com bandeira (`getTeamFlag(code)`) e nome em maiúsculas
  - Placar central em `color-accent` bold grande (`28px`)
  - Placar `- × -` em `color-muted` quando status `pending`
  - Badge `■ AO VIVO` em `color-live` com animação blink quando `status === 'live'`
  - Badge `□ ENCERRADO` em `color-muted` quando `status === 'finished'`
  - Badge `PENDENTE` em `color-muted` quando `status === 'pending'`
  - Estádio/venue em `color-muted` 11px, truncado com ellipsis

**Visual (ASCII reference):**
```
┌────────────────────────────────────────────┐
│  GRP A · 14 JUN · 15:00 BRT               │
├────────────────────────────────────────────┤
│    🇧🇷          3  ×  1          🇦🇷        │
│   BRASIL                      ARGENTINA    │
├────────────────────────────────────────────┤
│  ■ AO VIVO                                 │
└────────────────────────────────────────────┘
```

---

### 3. PublicParticipantsList

**Arquivo:** `components/bolao/PublicParticipantsList.tsx`

**Tipo:** Client Component (`'use client'`) — precisa de Realtime para scores e da lógica de pontuação ao vivo

**Props:**

```typescript
interface PublicParticipantsListProps {
  participants: ParticipantEntry[]           // estado inicial do SSR
  gameStatus: 'pending' | 'live' | 'finished'
  gameId: string
  initialHomeScore: number | null
  initialAwayScore: number | null
}
```

**Comportamento:**

**Estado inicial:** recebe `participants` do Server Component (SSR). Em seguida, no cliente, subscreve ao canal `scores` via Supabase Realtime para receber pontuações atualizadas.

**Realtime de scores (para atualização de pontuação):**

```typescript
// Canal: supabase.channel(`public-scores-${gameId}`)
// Evento: postgres_changes > UPDATE/INSERT > table: scores > filter: game_id=eq.${gameId}
// Ao receber evento: atualiza a entrada correspondente por user_id no estado local de participants
// Implementar dentro do componente com useEffect + supabase client (anon key, sem auth)
```

**Nota sobre Realtime com anon key:** o canal Supabase Realtime funciona com a chave `anon` sem autenticação para tabelas com `REPLICA IDENTITY FULL` habilitado. A tabela `scores` já tem `REPLICA IDENTITY FULL` (habilitado pela feature `live-scores-realtime`). A política RLS de leitura de `scores` para autenticados já existe — para receber eventos Realtime sem sessão, pode ser necessário verificar se a publicação `supabase_realtime` está configurada corretamente (já está). Se o Realtime com anon não funcionar, usar polling de 15s via `setInterval` como fallback na subscrição de scores da página pública (sem bloqueio de implementação).

**Pontuação ao vivo:** quando `gameStatus === 'live'`, calcular pontuação provisória no cliente via `calculateLiveScore()` (já existe em `lib/scoring.ts`), exatamente como `GameParticipantsList` faz. Exibir indicador `PTS*` (ao vivo, provisório).

**Tabela de participantes:**

Colunas: PARTICIPANTE | PALPITE | PTS (ou PTS* ao vivo)

Mesma lógica de `GameParticipantsList.tsx` existente:
- Em jogos `pending`: coluna PALPITE mostra `OCULTO` (`color-muted`) se `hasPrediction=true` ou `PENDENTE` (`color-error`) se `hasPrediction=false`; sem coluna PTS
- Em jogos `live`: mostra palpite real (`H × A`) em `color-accent` e pontuação provisória `PTS*` calculada no cliente; indicador `AO VIVO` ao lado do header da seção
- Em jogos `finished`: mostra palpite e pontuação oficial de `scores`
- Participante sem palpite mostra `-` na coluna de palpite

**Diferença em relação a `GameParticipantsList`:** como a página pública não tem `currentUserId`, nenhuma linha recebe o prefixo `■` de destaque. Todas as linhas são tratadas como "terceiros".

**Sem accordion de breakdown:** a página pública não exibe o detalhamento de pontuação ao clicar (PredictionBreakdown). Manter simples — apenas PARTICIPANTE | PALPITE | PTS.

---

### 4. CopyLinkButton (modificação em `GameCard.tsx`)

**Arquivo a modificar:** `components/games/GameCard.tsx`

**Adição:** botão "copiar link" na barra de ações inferior do `GameCard` (mesma área onde ficam "VER ANÁLISE" e "VER PALPITES").

**Localização na barra:** terceira posição na `div` de ações (após "VER ANÁLISE" e "VER PALPITES"), ou como botão compacto com ícone `⎘` (símbolo de cópia) separado da barra verde para não competir visualmente com as CTAs principais.

**Decisão de layout:** adicionar o botão de copiar como um elemento separado abaixo da barra de ações verde existente, com estilo diferente (background `color-surface`, texto `color-muted`, borda `color-border`) para hierarquia visual clara — o botão de copiar é utilitário, não CTA principal.

**Alternativa:** inserir como terceiro botão na barra verde existente (ao lado de "VER ANÁLISE" e "VER PALPITES"), com a mesma cor `color-primary` bg e `color-bg` texto. Esta opção mantém tudo na mesma barra; o Programador deve avaliar o espaço disponível em mobile e escolher a solução que não quebre o layout em 375px de largura.

**Props:** nenhuma prop nova. O botão usa `liveGame.id` já disponível no escopo do componente.

**Comportamento:**

```typescript
async function handleCopyLink() {
  const url = `${window.location.origin}/jogos/${liveGame.id}/publico`
  await navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

**Estado local:** `const [copied, setCopied] = useState(false)` — adicionado junto aos demais estados locais do componente.

**Feedback visual:**
- Estado normal: texto `⎘ COPIAR LINK` em `color-muted`
- Estado `copied=true`: texto `✓ COPIADO!` em `color-win` por 2 segundos
- Sem navegação, sem refresh, sem efeito colateral além do clipboard

**Compatibilidade:** `navigator.clipboard.writeText()` requer contexto seguro (HTTPS ou localhost) — o ambiente de produção (Vercel) sempre é HTTPS. Para fallback em contextos não-seguros, o botão pode ser omitido ou silencioso. Não bloquear a implementação com fallback complexo.

---

## Regras de Negócio

### Visibilidade de palpites na página pública

A regra é idêntica à de `prediction-visibility` já implementada:

```
SE game.status === 'pending':
  Para cada participante:
    prediction = null
    hasPrediction = (existe registro em predictions para este user_id + game_id)
    points = null
    breakdown = null

SE game.status === 'live' OU 'finished':
  Para cada participante:
    prediction = { home_score, away_score } (valores reais)
    hasPrediction = true (sempre, pois só listamos quem tem prediction)
    points = score.points (null se status === 'live', pois score só é calculado ao finalizar)
    breakdown = score.breakdown (null se status === 'live')
```

### Realtime da página pública

Dois canais independentes:
1. `game-${gameId}` — gerenciado pelo hook `useGameRealtime` já existente; atualiza placar e status em `PublicScoreCard`
2. `public-scores-${gameId}` — gerenciado diretamente em `PublicParticipantsList` via `useEffect`; atualiza pontuações quando scores são inseridos/atualizados (apenas em jogos `finished`)

Para jogos `live`, a pontuação é calculada no cliente via `calculateLiveScore()` sempre que o placar muda (dependência do `liveGame` vindo do `useGameRealtime`). O Programador deve passar o `liveGame` atualizado do `PublicScoreCard` para o `PublicParticipantsList` — ou usar um state de compartilhamento de estado simples (prop lifting ou Context) para que ambos os componentes vejam o mesmo placar atual.

**Abordagem recomendada:** criar um componente pai `PublicGameClient` que encapsula `PublicScoreCard` e `PublicParticipantsList`, mantém o estado do jogo via `useGameRealtime` e passa o `liveGame` como prop para ambos. Dessa forma, o placar ao vivo é compartilhado de forma correta.

**Arquivo:** `components/bolao/PublicGameClient.tsx`

```typescript
'use client'

interface PublicGameClientProps {
  initialGame: GameType
  initialParticipants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
}

// Usa useGameRealtime internamente
// Passa liveGame para PublicScoreCard (read-only)
// Passa liveGame.home_score/away_score para PublicParticipantsList (para cálculo ao vivo)
```

Nesse caso, `PublicScoreCard` e `PublicParticipantsList` recebem o `liveGame` como prop em vez de chamar `useGameRealtime` individualmente — evita múltiplas subscriptions ao mesmo canal.

---

## Proteção de Rotas

A página `/jogos/[gameId]/publico` é **pública** — sem autenticação.

**Como garantir que o middleware não bloqueie:**

O middleware de autenticação do Next.js (`middleware.ts`) provavelmente usa `matcher` para proteger apenas `/dashboard` ou `/(dashboard)`. Verificar o arquivo `middleware.ts` antes de implementar:

```bash
cat /Users/hamonvitorino/workspace/bolao-abj/middleware.ts
```

Se o matcher atual bloquear `/jogos/*` genericamente, adicionar exceção para `/jogos/[id]/publico`. Se o middleware protege apenas o route group `(dashboard)` via path matching, a rota em `app/jogos/[gameId]/publico/page.tsx` (fora do group) já está desprotegida automaticamente.

**O Server Component da página pública NÃO chama `supabase.auth.getUser()`** — usa diretamente `createServiceClient()` para todas as queries.

---

## Integração Supabase Realtime

### Canal de jogo (placar e status)

- Gerenciado por: `useGameRealtime` (hook já existente, reutilizado)
- Canal: `game-${gameId}`
- Tabela: `games`
- Evento: `UPDATE`
- Filtro: `id=eq.${gameId}`
- Ao receber: merge funcional `setGame(prev => ({ ...prev, ...payload.new }))`
- Status de conexão: `'connecting' | 'connected' | 'error'` (já implementado no hook)

### Canal de scores (pontuação)

- Gerenciado por: `useEffect` dentro de `PublicParticipantsList` (ou `PublicGameClient`)
- Canal: `public-scores-${gameId}`
- Tabela: `scores`
- Evento: `INSERT` e `UPDATE` (`event: '*'`)
- Filtro: `game_id=eq.${gameId}`
- Ao receber `payload.new`: localizar o participante por `user_id` no array de state e atualizar `points` e `breakdown`
- Cleanup: `supabase.removeChannel(channel)` no return do `useEffect`
- A tabela `scores` já tem `REPLICA IDENTITY FULL` habilitado (feature `live-scores-realtime`)

---

## Critérios de Aceite

- [ ] Rota `app/jogos/[gameId]/publico/page.tsx` existe e é acessível sem sessão Supabase (testar abrindo em aba anônima do browser)
- [ ] Página exibe times com bandeiras, placar atual (ou `- × -`), status e rodada, seguindo o visual de "Placar de Jogo" do DESIGN.md
- [ ] Em jogos `pending`: coluna PALPITE exibe `OCULTO` (color-muted) para participantes com palpite e `PENDENTE` (color-error) para os sem palpite
- [ ] Em jogos `live`: palpites reais visíveis, pontuação provisória calculada via `calculateLiveScore()` com indicador `PTS*`
- [ ] Em jogos `finished`: palpites reais e pontuação oficial de `scores` visíveis
- [ ] Placar atualiza sem reload quando o jogo é atualizado no Supabase (Realtime via canal `games`)
- [ ] Pontuação atualiza sem reload quando scores são inseridos/atualizados no Supabase
- [ ] Página é renderizada corretamente para `gameId` inexistente (404 via `notFound()`)
- [ ] No `GameCard` (área autenticada), um botão/controle com texto `⎘ COPIAR LINK` (ou equivalente) está visível
- [ ] Clicar no botão de copiar coloca `${origin}/jogos/${gameId}/publico` na área de transferência sem navegar
- [ ] Após clicar, o texto do botão muda para `✓ COPIADO!` em `color-win` por ~2 segundos e depois volta ao estado original
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros de TypeScript ou compilação
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, dark only, dense, sem border-radius excessivo, sem sombras
- [ ] Página funciona em mobile (coluna única, 375px)
- [ ] Nenhuma migration SQL nova é criada (dados lidos via service_role; RLS existente não é alterado)
