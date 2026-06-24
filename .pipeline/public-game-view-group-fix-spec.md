# Spec: Correção — Contexto de Grupo na Página Pública de Jogo

**Slug:** public-game-view-group-fix
**Data:** 2026-06-24
**Status:** spec

---

## Objetivo

Corrigir a feature `public-game-view` (já mergeada na main) para que:

1. A URL pública de um jogo inclua o ID do grupo como query parameter (`?grupo=<groupId>`).
2. A página pública (`/jogos/[gameId]/publico`) filtre palpites e pontuações apenas dos membros do grupo informado na URL.
3. O botão "copiar link" no `GameCard` gere a URL já com o `groupId` do contexto atual.
4. Acessar a página sem `?grupo=` resulte em mensagem de erro clara — nunca vaze dados de todos os grupos misturados.

---

## Histórias de Usuário

- Como participante autenticado, quero copiar o link de um jogo e compartilhá-lo, para que meus amigos do mesmo grupo vejam apenas os palpites e pontuações do nosso grupo.
- Como visitante que recebe o link compartilhado, quero ver os palpites e pontuações do grupo específico do link, sem misturar dados de outros grupos.
- Como desenvolvedor, quero que acessar a página pública sem `?grupo=` resulte em erro claro, não em dados misturados de todos os usuários do sistema.

---

## Modelo de Dados

### Sem migrations novas

A correção não exige alterações no esquema do banco de dados. As tabelas já existem com a coluna `group_id` em `predictions` e `scores`, e a tabela `group_members` já existe com `group_id` + `user_id`.

O problema atual é que a `page.tsx` faz:
- `SELECT * FROM profiles` (todos os usuários do sistema, sem filtro de grupo)
- `SELECT FROM predictions WHERE game_id = ?` (sem filtro de grupo)
- `SELECT FROM scores WHERE game_id = ?` (sem filtro de grupo)

A correção introduz `groupId` como parâmetro de busca e filtra por membros do grupo.

---

## Formato de URL

**Decisão: query parameter `?grupo=<groupId>`**

**Justificativa:**

A rota atual é `app/jogos/[gameId]/publico/page.tsx` (fora do route group `(dashboard)`). Adotar um segmento de rota adicional (`/grupos/[groupId]/jogos/[gameId]/publico`) exigiria reorganizar a estrutura de diretórios, criando um novo segmento dinâmico aninhado. Isso quebraria todas as URLs já geradas e exigiria mudanças na `app/jogos/[gameId]/analise/` (que tem `opengraph-image.tsx` com seu próprio segmento dinâmico de mesmo nível).

O query parameter `?grupo=<groupId>` é a escolha correta porque:
- Mantém a rota `app/jogos/[gameId]/publico/page.tsx` inalterada em termos de estrutura de diretórios.
- No App Router, `searchParams` é passado como prop para Server Components, com tipo `Promise<{ grupo?: string }>`.
- É consistente com o padrão já usado no dashboard (ex: `/jogos?date=2026-06-24&group=<uuid>`).
- Permite que a URL continue sendo memorizável e legível.

**Formato final:** `/jogos/<gameId>/publico?grupo=<groupId>`

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. A lógica de filtragem será resolvida inteiramente via Server Component + Supabase query direta com `createServiceClient()`, seguindo o mesmo padrão já adotado na `page.tsx` atual.

---

## Frontend — Componentes React

### 1. `app/jogos/[gameId]/publico/page.tsx`

**Arquivo:** `app/jogos/[gameId]/publico/page.tsx`

**Mudanças:**

Adicionar `searchParams` como prop do Server Component e extrair `grupo` (o `groupId`):

```typescript
interface PublicGamePageProps {
  params: Promise<{ gameId: string }>
  searchParams: Promise<{ grupo?: string }>
}
```

**Comportamento quando `grupo` está ausente:**

Renderizar uma tela de erro inline (sem `notFound()`, sem redirect) com a mensagem:

```
✗ PARÂMETRO DE GRUPO AUSENTE
Este link está incompleto. Peça ao participante que compartilhe o link novamente usando o botão "COPIAR LINK" do jogo.
```

Estilo: container centralizado, `color-error`, `fontSize: '13px'`, `border: '1px solid var(--color-error)'`, `backgroundColor: 'var(--color-surface)'`, `padding: '1.5rem'`, fonte JetBrains Mono, `textTransform: 'uppercase'` para a primeira linha e normal para a instrução de baixo.

**Comportamento quando `grupo` está presente:**

Substituir as queries atuais por versões filtradas por grupo:

**Query de perfis** — em vez de `SELECT * FROM profiles`, buscar apenas membros do grupo:

```sql
SELECT profiles.id, profiles.name
FROM group_members
JOIN profiles ON profiles.id = group_members.user_id
WHERE group_members.group_id = :groupId
```

Equivalente Supabase JS:
```typescript
const { data: memberProfiles } = await serviceClient
  .from('group_members')
  .select('user_id, profiles(id, name)')
  .eq('group_id', groupId)
```

**Query de predictions** — adicionar filtro `group_id`:

```typescript
// status === 'pending': existência
await serviceClient
  .from('predictions')
  .select('user_id, game_id')
  .eq('game_id', gameId)
  .eq('group_id', groupId)

// status !== 'pending': valores reais
await serviceClient
  .from('predictions')
  .select('user_id, game_id, home_score, away_score')
  .eq('game_id', gameId)
  .eq('group_id', groupId)
```

**Query de scores** — adicionar filtro `group_id`:

```typescript
await serviceClient
  .from('scores')
  .select('user_id, game_id, points, breakdown')
  .eq('game_id', gameId)
  .eq('group_id', groupId)
```

**`generateMetadata`** — não precisa de `grupo`; continua sem mudanças (título baseado apenas no jogo).

**Passar `groupId` para o `PublicGameClient`** — o componente cliente precisa receber o `groupId` para que `PublicParticipantsList` use o canal Realtime de scores correto (filtrado por `group_id`). Adicionar a prop:

```typescript
<PublicGameClient
  initialGame={game}
  initialParticipants={participants}
  gameStatus={game.status as 'pending' | 'live' | 'finished'}
  groupId={groupId}
/>
```

---

### 2. `components/bolao/PublicGameClient.tsx`

**Arquivo:** `components/bolao/PublicGameClient.tsx`

**Mudanças:**

Adicionar `groupId: string` à interface `PublicGameClientProps` e repassar para `PublicParticipantsList`:

```typescript
interface PublicGameClientProps {
  initialGame: Game
  initialParticipants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  groupId: string
}
```

```typescript
<PublicParticipantsList
  participants={initialParticipants}
  gameStatus={(liveGame.status as 'pending' | 'live' | 'finished') ?? gameStatus}
  gameId={initialGame.id}
  groupId={groupId}
  liveHomeScore={liveGame.home_score}
  liveAwayScore={liveGame.away_score}
/>
```

---

### 3. `components/bolao/PublicParticipantsList.tsx`

**Arquivo:** `components/bolao/PublicParticipantsList.tsx`

**Mudanças:**

Adicionar `groupId: string` à interface `PublicParticipantsListProps` e usar no filtro do canal Realtime de scores. O canal atual é `public-scores-${gameId}` sem filtro de grupo — dois grupos diferentes vendo o mesmo jogo receberiam eventos de scores de todos os grupos misturados.

Alterar o filtro do canal Realtime:

```typescript
// Antes:
const channel = supabase
  .channel(`public-scores-${gameId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scores',
    filter: `game_id=eq.${gameId}`,
  }, ...)

// Depois:
const channel = supabase
  .channel(`public-scores-${gameId}-${groupId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scores',
    filter: `game_id=eq.${gameId}`,
  }, handler)
```

O nome do canal deve incluir `groupId` para evitar colisões entre abas de grupos diferentes. O filtro Realtime no Postgres só suporta uma coluna de cada vez, portanto manter `game_id` como filtro é correto — o handler de eventos já filtra apenas `user_id` presentes em `participants`, que são exclusivamente membros do grupo (carregados via SSR). Não há risco de exibir scores de outros grupos porque o array `participants` já é filtrado pelo grupo na page.

**Nota:** a prop `groupId` é necessária no canal para evitar que múltiplas instâncias (abas abertas para grupos diferentes do mesmo jogo) compartilhem o mesmo canal Supabase, o que causaria comportamento imprevisível.

---

### 4. `components/games/GameCard.tsx`

**Arquivo:** `components/games/GameCard.tsx`

**Mudanças:**

O `GameCard` já recebe `groupId: string` como prop (linha 25 do arquivo atual). Basta corrigir o `handleCopyLink` para incluir `groupId` na URL:

```typescript
// Antes:
async function handleCopyLink() {
  try {
    const url = `${window.location.origin}/jogos/${liveGame.id}/publico`
    await navigator.clipboard.writeText(url)
    ...
  }
}

// Depois:
async function handleCopyLink() {
  try {
    const url = `${window.location.origin}/jogos/${liveGame.id}/publico?grupo=${groupId}`
    await navigator.clipboard.writeText(url)
    ...
  }
}
```

Esta é a mudança mais simples e mais crítica da correção: uma linha alterada.

---

## Regras de Negócio

### Visibilidade de palpites na página pública (mantida)

- Status `pending`: exibir somente existência (`OCULTO` / `PENDENTE`) — sem vazar valores de palpites.
- Status `live` ou `finished`: exibir valores reais de palpites.

### Escopo de dados por grupo (nova regra)

- A página pública com `?grupo=<groupId>` exibe **somente** os membros daquele grupo.
- Um membro do grupo A que compartilha o link do jogo X gera `/jogos/X/publico?grupo=<grupoA>`. Um receptor do link verá apenas os palpites dos membros do grupo A.
- O mesmo jogo X acessado via `?grupo=<grupoB>` exibirá apenas os membros do grupo B — listas distintas, potencialmente diferentes.

### Ausência de `?grupo=` na URL

- A página renderiza estado de erro inline (não lança 404, não redireciona).
- Mensagem clara orienta o usuário a solicitar o link novamente via botão do `GameCard`.
- Nenhum dado de palpite ou perfil é exibido no estado de erro.

### Acesso público sem autenticação

- A página usa `createServiceClient()` (service_role), não depende de sessão do usuário.
- A filtragem de `group_members` via service_role é segura — não depende de RLS para filtrar, pois é feita via query server-side.
- Não é necessária nova política RLS: `group_members` já é acessível via service_role. Se não houver política anon em `group_members`, a query server-side com service_role ignora o RLS — válido para Server Component.

---

## Proteção de Rotas

A página `/jogos/[gameId]/publico` permanece pública (fora do route group `(dashboard)`). Nenhuma proteção de autenticação é adicionada. O controle de escopo é feito exclusivamente pela query server-side filtrada por `groupId`.

---

## Integração Supabase Realtime

### `PublicParticipantsList` — canal de scores

- **Tabela:** `scores`
- **Evento:** `INSERT | UPDATE | DELETE` (event `*`)
- **Canal:** `public-scores-${gameId}-${groupId}` (nome corrigido para incluir groupId)
- **Filtro Postgres:** `game_id=eq.${gameId}`
- **Ao receber evento:** atualiza pontos do participante correspondente no state local, mas apenas se `userId` estiver presente no array `participants` (que já é filtrado por grupo via SSR). Não há risk de exibir scores de outros grupos.

---

## Critérios de Aceite

- [ ] `handleCopyLink` em `GameCard.tsx` gera `${origin}/jogos/${gameId}/publico?grupo=${groupId}` — nunca sem o query param.
- [ ] Acessar `/jogos/<gameId>/publico?grupo=<groupId>` exibe somente participantes membros daquele grupo.
- [ ] Acessar `/jogos/<gameId>/publico?grupo=<grupoA>` e `/jogos/<gameId>/publico?grupo=<grupoB>` exibe subconjuntos distintos quando os grupos têm membros diferentes.
- [ ] Acessar `/jogos/<gameId>/publico` (sem `?grupo=`) exibe mensagem de erro clara ("PARÂMETRO DE GRUPO AUSENTE") — sem dados de palpites ou participantes.
- [ ] O estado de erro não vaza nenhum dado: nenhuma query de `predictions`, `scores` ou `profiles` é executada quando `groupId` está ausente.
- [ ] Jogos `pending`: participantes do grupo aparecem como OCULTO/PENDENTE conforme existência de palpite no grupo.
- [ ] Jogos `live`: palpites reais e pontuação provisória calculada no cliente.
- [ ] Jogos `finished`: palpites reais e pontuação oficial de scores filtrada por `group_id`.
- [ ] Realtime de scores no `PublicParticipantsList` usa canal com nome incluindo `groupId` para evitar colisões entre abas.
- [ ] `npm run lint` passa sem erros novos.
- [ ] `npm run build` passa sem erros novos.
- [ ] Design segue DESIGN.md: fonte JetBrains Mono, paleta `color-error`/`color-surface`/`color-muted`, uppercase, border-radius 0, sem sombras, sem ícones decorativos.
- [ ] Funciona em mobile (coluna única, viewport 375px).

---

## Resumo dos arquivos modificados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `app/jogos/[gameId]/publico/page.tsx` | Lê `searchParams.grupo`; erro se ausente; filtra queries por `group_id`; passa `groupId` ao `PublicGameClient` |
| `components/bolao/PublicGameClient.tsx` | Adiciona prop `groupId`; repassa para `PublicParticipantsList` |
| `components/bolao/PublicParticipantsList.tsx` | Adiciona prop `groupId`; usa no nome do canal Realtime |
| `components/games/GameCard.tsx` | Inclui `?grupo=${groupId}` na URL copiada — **uma linha** |

Nenhum novo arquivo criado. Nenhuma migration necessária.
