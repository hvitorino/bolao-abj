# Spec: Aba de Palpites com Jogos ao Vivo e Ranking

**Slug:** palpites-ao-vivo
**Data:** 2026-06-25
**Status:** spec

---

## Objetivo

Criar uma nova aba "PALPITES" na tab bar de navegação do dashboard que exibe:
1. No topo (sticky), cards compactos de todos os jogos com status `live` mostrando o placar real e o palpite do usuário logado
2. Abaixo, um ranking completo do grupo com animações FLIP de reposicionamento e breakdown expansível por participante listando a pontuação de cada jogo (com bandeiras, palpite do participante e pontos obtidos)
3. Atualização automática a cada 10 segundos via polling

---

## Histórias de Usuário

- Como participante, quero ver em uma única tela todos os jogos ao vivo com meu palpite ao lado do placar real, para acompanhar minha performance durante as partidas
- Como participante, quero ver o ranking do grupo atualizado automaticamente a cada 10 segundos sem precisar recarregar a página
- Como participante, quero expandir o card de um participante no ranking para ver o detalhamento dos pontos que ele ganhou em cada jogo, incluindo bandeiras e palpite dele
- Como participante, quero que as mudanças de posição no ranking sejam animadas suavemente para que eu perceba visualmente quando alguém sobe ou desce

---

## Modelo de Dados

### Nenhuma tabela nova ou migration necessária

A feature usa exclusivamente dados das tabelas existentes:

- `games` — leitura de jogos com `status = 'live'`, `home_score`, `away_score`, `home_team`, `away_team`, `home_team_code`, `away_team_code`
- `predictions` — palpites escopados por `group_id` e `user_id`
- `scores` — pontuação oficial por participante/jogo, com `breakdown jsonb`, escopados por `group_id`
- `profiles` — nomes dos participantes
- `group_members` — membros do grupo ativo (para escopar queries)

A pontuação parcial de jogos `live` é calculada client-side via `calculateLiveScore()` de `lib/scoring.ts`, sem escrever em `scores`.

---

## Backend — Endpoints Ruby/Sinatra

### Nenhum endpoint novo necessário

A feature usa endpoints já existentes:

- `GET /api/ranking?group_id=<id>` — já existente, retorna `RankingEntry[]` com `total_points`, `rank_position`, `participant_name`, `user_id`
- Queries Supabase client-side diretas para `games`, `predictions` e `scores`

---

## Frontend — Componentes React

### Estrutura de arquivos

```
app/(dashboard)/palpites/page.tsx              — página da aba
components/bolao/PalpitesLiveCard.tsx          — card de jogo ao vivo com palpite do usuário
components/bolao/PalpitesRanking.tsx           — ranking com FLIP e breakdown expansível
components/bolao/PalpitesRankingRow.tsx        — linha do ranking com accordion de breakdown
lib/hooks/usePalpitesAoVivo.ts                 — hook de dados com polling de 10s
```

---

### Página: `app/(dashboard)/palpites/page.tsx`

**Rota protegida:** `/palpites` (dentro do route group `(dashboard)`)

**Responsabilidade:** Server Component que resolve `currentUserId` e `groupId` via cookies e sessão Supabase, e passa como props para os componentes client.

```typescript
// Props passadas para componentes filhos
{
  currentUserId: string   // user.id da sessão Supabase Auth
  groupId: string         // cookie bolao_active_group → groups[0].id como fallback
}
```

**Lógica de resolução do grupo:** idêntica ao `app/(dashboard)/layout.tsx` — ler cookie `bolao_active_group`, buscar `group_members` do usuário e fazer fallback para o primeiro grupo por `joined_at ASC`. Se o usuário não pertencer a nenhum grupo, redirecionar para `/grupos`.

**Estrutura da página:**

```
<PageTitle>PALPITES</PageTitle>
<PalpitesLiveCard groupId currentUserId />         {/* sticky no topo */}
<PalpitesRanking groupId currentUserId />          {/* abaixo */}
```

---

### Hook: `lib/hooks/usePalpitesAoVivo.ts`

**Tipo:** Client-side hook com polling de 10 segundos

**Responsabilidade:** Buscar e manter atualizado:
1. Jogos com `status = 'live'` e seus placares
2. Palpite do `currentUserId` para cada jogo live
3. Ranking completo do grupo
4. Palpites de todos os participantes do grupo para todos os jogos com `status IN ('live', 'finished')`
5. Scores de todos os participantes do grupo por jogo

**Assinatura:**

```typescript
interface LiveGameWithPrediction {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'live'
  // Palpite do currentUser para este jogo (null se não fez palpite)
  myPrediction: { home_score: number; away_score: number } | null
}

interface GameScoreEntry {
  gameId: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  userPrediction: { home_score: number; away_score: number } | null
  officialPoints: number | null        // de scores (jogos finished)
  officialBreakdown: ScoreBreakdown | null
}

interface RankingParticipantDetail {
  userId: string
  name: string
  rank_position: number
  total_points: number   // oficial + parcial live (calculado no cliente)
  games: GameScoreEntry[]  // todos os jogos (live+finished) com palpite deste participante
}

interface UsePalpitesAoVivoResult {
  liveGames: LiveGameWithPrediction[]
  rankingWithDetails: RankingParticipantDetail[]
  loading: boolean
  error: string | null
  lastPolledAt: Date | null
}

export function usePalpitesAoVivo(groupId: string, currentUserId: string): UsePalpitesAoVivoResult
```

**Implementação do polling:**

```typescript
// Intervalo de 10 segundos, configurável via constante
const POLL_INTERVAL_MS = 10_000

useEffect(() => {
  fetchAll() // busca inicial imediata

  const interval = setInterval(() => {
    fetchAll()
  }, POLL_INTERVAL_MS)

  return () => clearInterval(interval)
}, [groupId, currentUserId])
```

**Queries Supabase dentro do hook (todas client-side, com Bearer token da sessão):**

```
1. games: .select('id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,match_date')
          .in('status', ['live', 'finished'])
          .order('match_date', { ascending: true })

2. predictions: .select('user_id,game_id,home_score,away_score')
               .eq('group_id', groupId)
               .in('game_id', gameIds)  // ids dos jogos live+finished

3. scores: .select('user_id,game_id,points,breakdown')
           .eq('group_id', groupId)
           .in('game_id', gameIds)      // ids dos jogos finished

4. GET /api/ranking?group_id=<groupId>  // ranking oficial para total_points base
   (com Authorization: Bearer <token>)
```

**Cálculo do `total_points` por participante:**

Idêntico ao padrão estabelecido em `useLivePointsByUser.ts` + `RankingTable.tsx`:
- Base: `total_points` retornado por `/api/ranking` (jogos `finished`)
- Adicional: somar pontos de jogos `live` calculados via `calculateLiveScore()` client-side
- Reordenar por `total_points` DESC, desempate por `participant_name` pt-BR ASC

**Cálculo de pontos por jogo para o breakdown:**

Para cada jogo no `games` array de um participante:
- Se `status === 'finished'`: usar `officialPoints` e `officialBreakdown` de `scores`
- Se `status === 'live'`: calcular via `calculateLiveScore({ home_score, away_score }, userPrediction)` — resultado é provisório
- Se `status === 'pending'` ou sem palpite: `officialPoints = null`, `officialBreakdown = null`

---

### Componente: `components/bolao/PalpitesLiveCard.tsx`

**Arquivo:** `components/bolao/PalpitesLiveCard.tsx`

**Props:**
```typescript
interface PalpitesLiveCardProps {
  liveGames: LiveGameWithPrediction[]
  loading: boolean
}
```

**Estados:**
- `loading`: exibe "CARREGANDO..." em `color-muted`
- `empty` (0 jogos live): exibe bloco com mensagem "NENHUM JOGO AO VIVO NO MOMENTO" em `color-muted`
- `populated`: renderiza um card por jogo

**Comportamento:**

O container é sticky no topo — `position: sticky; top: calc(44px + env(safe-area-inset-top))` (altura do header fixo do dashboard).

Cada card de jogo ao vivo exibe:

```
┌──────────────────────────────────────────────────────┐
│  ██ AO VIVO ██   BRA × ARG                           │
├──────────────────────────────────────────────────────┤
│  🇧🇷 BRA    2  ×  1    ARG 🇦🇷                       │
│  PLACAR REAL                                         │
├──────────────────────────────────────────────────────┤
│  SEU PALPITE: 🇧🇷 BRA  2  ×  1  ARG 🇦🇷              │
│  — se sem palpite: SEM PALPITE REGISTRADO —          │
└──────────────────────────────────────────────────────┘
```

**Especificações visuais do card:**
- Background: `color-surface`; border: `1px solid color-border`
- Badge `██ AO VIVO ██`: `color-live`, animação `blink 1s step-end infinite`
- Placar real: fonte `JetBrains Mono`, bold, tamanho `1.5rem` (24px), `color-accent`
- Label "PLACAR REAL": `color-muted`, `10px`, uppercase
- Linha de palpite: `color-text` para o placar, `color-muted` para o label "SEU PALPITE:"
- Sem palpite: "SEM PALPITE REGISTRADO" em `color-error`
- Bandeiras: `getTeamFlag(teamCode)` de `lib/utils/teamFlag.ts` (já existente)
- Quando não há jogos ao vivo: card cinza com mensagem centralizada, sem animação blink

**Scroll horizontal:** quando há 2 ou mais jogos ao vivo, os cards ficam em `display: flex; gap: 0.75rem; overflow-x: auto` — um card por jogo, cada um com `min-width: 260px; flex-shrink: 0`.

---

### Componente: `components/bolao/PalpitesRanking.tsx`

**Arquivo:** `components/bolao/PalpitesRanking.tsx`

**Props:**
```typescript
interface PalpitesRankingProps {
  groupId: string
  currentUserId: string
}
```

**Responsabilidade:** Orquestrador do ranking com FLIP. Usa o hook `usePalpitesAoVivo` e renderiza:
1. Cabeçalho da seção com label "RANKING" e timestamp da última atualização
2. Indicador de próxima atualização em `color-muted` (ex: "próx. atualização em 10s")
3. Lista de `PalpitesRankingRow` com animação FLIP entre re-renders

**Animação FLIP:**

Reutilizar exatamente o padrão de `PublicParticipantsList.tsx` (feature `animated-predictions-ranking`):
- `rowRefs`: `useRef<Map<string, HTMLDivElement>>`
- `prevPositions`: `useRef<Map<string, DOMRect>>`
- `isFirstRender`: `useRef(true)` — suprime animação no primeiro render
- `capturePositions()`: captura `getBoundingClientRect()` antes de cada re-render
- `useLayoutEffect([sortedRanking])`: executa FLIP após cada mudança de `sortedRanking`
- Algoritmo: FIRST → LAST → INVERT (translateY sem transition) → reflow → PLAY (transition 350ms ease-in-out)
- Container usa `<div role="table">` em vez de `<table>` (necessário para `translateY` funcionar corretamente)

**Estados:**
- `loading`: "CARREGANDO RANKING..." em `color-muted`
- `error`: "✗ {error}" em `color-error`
- `empty`: "NENHUM PARTICIPANTE" em `color-muted`
- `populated`: lista de `PalpitesRankingRow`

**Cabeçalho da tabela (colunas):**

```
#  | PARTICIPANTE          | PTS   | (expandir)
```

- Coluna `#`: `width: 2.5rem`, alinhamento direita
- Coluna `PARTICIPANTE`: `flex: 1`
- Coluna `PTS`: `width: 4rem`, alinhamento centro
- Coluna ícone de expand: `width: 1.5rem`, alinhamento centro — `▼` / `▲`

**Rodapé:**
- `► LÍDER` em `color-accent`
- `■ VOCÊ` em `color-primary`
- N PARTICIPANTES em `color-muted`
- `██ AO VIVO` em `color-live` (apenas quando há jogos live)
- Timestamp `⏱ HH:MM:SS` alinhado à direita em `color-muted`

---

### Componente: `components/bolao/PalpitesRankingRow.tsx`

**Arquivo:** `components/bolao/PalpitesRankingRow.tsx`

**Props:**
```typescript
interface PalpitesRankingRowProps {
  participant: RankingParticipantDetail
  isCurrentUser: boolean
  isLeader: boolean
  isExpanded: boolean
  onToggle: () => void
}
```

**Estados da linha:**
- Recolhido: exibe posição, nome (com badges de líder/você), pontos, botão `▼`
- Expandido: exibe acima do breakdown um `▲` para fechar, e logo abaixo da linha principal uma sublista de jogos

**Linha principal (recolhida):**
- `#pos`: `color-accent` se líder; `color-primary` se currentUser; `color-text` demais
- `► NOME` se líder (com seta em `color-accent`)
- `■ NOME` se currentUser (com quadrado em `color-primary`)
- Pontos: bold, `color-accent`
- Se tem pontos de jogos `live`: sufixo `*` em `color-live` ao lado dos pontos
- Ícone `▼`/`▲` em `color-muted`
- Fundo do row: `color-surface` padrão; `background: rgba(0,151,59,0.08)` se currentUser

**Accordion de breakdown (expandido):**

Ao expandir, renderizar uma sublista de jogos. Cada linha de jogo exibe:

```
[bandeira time casa] [cod_casa] [placar_palpite_casa] × [placar_palpite_visitante] [cod_visit] [bandeira visit]   +N pts
```

Com detalhamento textual de breakdown logo abaixo da linha do jogo:

```
Acertou o vencedor +3 · Placar exato +5
```
(apenas componentes do breakdown com valor > 0)

**Formato visual do breakdown por jogo:**

```
┌─────────────────────────────────────────────────────────┐
│  🇧🇷 BRA  2 × 1  ARG 🇦🇷         +8 PTS               │
│  Acertou o vencedor +3 · Placar exato +5                │
├─────────────────────────────────────────────────────────┤
│  🇩🇪 GER  1 × 1  FRA 🇫🇷         +3 PTS               │
│  Acertou o vencedor +3                                  │
├─────────────────────────────────────────────────────────┤
│  🇺🇸 USA  — × —  MEX 🇲🇽         — (sem palpite)       │
└─────────────────────────────────────────────────────────┘
```

**Especificações do breakdown:**
- Placar exibido é sempre o **palpite do participante** — nunca o placar real
- Para jogos `live`: pontos são provisórios — exibir sufixo `*` e cor `color-live` no valor de pontos
- Para jogos `finished`: pontos oficiais — `color-accent` se > 0, `color-muted` se 0
- Sem palpite: mostrar `— × —` em `color-muted` e "SEM PALPITE" em `color-error`
- Labels de breakdown: usar `BREAKDOWN_LABELS` de `lib/scoring.ts` já existente
- Ordem dos jogos: `match_date ASC` (cronológico)
- Fonte: `JetBrains Mono` 11px; border-bottom `color-border` entre linhas de jogo
- Background do accordion: `color-bg` (um tom mais escuro que `color-surface`)

**Acessibilidade:**
- Linha clicável: `role="button"`, `tabIndex={0}`, `aria-expanded={isExpanded}`, `aria-controls={accordionId}`
- Accordion: `id={accordionId}`, `role="region"`, `aria-label="Detalhes de {nome}"`
- Ativar com Enter e Espaço

---

### Modificação: `components/bolao/TabBar.tsx`

**Mudança:** Adicionar "PALPITES" como quinto item na tab bar, posicionado entre "JOGOS" e "RANKING".

**Array `MAIN_ITEMS` atual:**
```typescript
[
  { href: '/perfil', label: 'EU' },
  { href: '/jogos', label: 'JOGOS' },
  { href: '/ranking', label: 'RANKING' },
]
```

**Array `MAIN_ITEMS` após a mudança:**
```typescript
[
  { href: '/perfil', label: 'EU' },
  { href: '/jogos', label: 'JOGOS' },
  { href: '/palpites', label: 'PALPITES' },
  { href: '/ranking', label: 'RANKING' },
]
```

A tab bar passa a ter 4 itens principais + botão MAIS (total: 5 elementos em `display: flex`). Verificar que os 5 itens cabem confortavelmente na largura mínima de 320px (cada item terá ~64px). Se necessário, reduzir font-size para `12px` apenas nos itens principais (PALPITES tem 8 caracteres — o mais longo).

O item MAIS continua funcionando como antes.

---

## Regras de Negócio

### Pontuação parcial de jogos ao vivo

- Calcular via `calculateLiveScore()` de `lib/scoring.ts`, idêntico a `useLivePointsByUser.ts`
- Somar a pontuação de todos os jogos `live` à pontuação oficial de jogos `finished` para o `total_points` exibido
- Marcar visualmente com `*` e `color-live` quando a pontuação inclui parcial de jogo ao vivo
- Ao jogo encerrar, a pontuação oficial (calculada pelo trigger Postgres em `scores`) substitui automaticamente o cálculo provisório no próximo polling

### Visibilidade de palpites no breakdown

- A regra de visibilidade temporal (`fix-prediction-visibility`) **não se aplica** ao breakdown desta tela: o breakdown expande palpites de **outros participantes**. Para manter consistência com a regra existente (palpites de terceiros só visíveis após o jogo iniciar), a sublista de breakdown **só exibe palpites de jogos com `status = 'live'` ou `status = 'finished'`** — jogos `pending` não aparecem no breakdown mesmo que o participante tenha feito palpite.
- Jogos `pending` com palpite do próprio `currentUser` aparecem no card sticky de "jogos ao vivo" apenas quando `status = 'live'` — palpites de jogos ainda não iniciados não são exibidos nos cards sticky.

### Polling vs Realtime

- Usar **polling** (não Supabase Realtime) para consistência com o requisito explícito do PM de "10 segundos"
- Intervalo configurável via constante `POLL_INTERVAL_MS = 10_000` no arquivo do hook
- O polling busca tudo de uma vez (`fetchAll`) sem múltiplos `setInterval` independentes
- A UI não pisca durante o polling — usar `useState` com atualização imersiva (não resetar para `loading: true` em polls subsequentes, apenas no mount inicial)

### Escopo por grupo

- Todas as queries de `predictions` e `scores` incluem `.eq('group_id', groupId)` para isolar dados por grupo ativo
- O `groupId` vem do cookie `bolao_active_group` resolvido no Server Component da página
- Ao trocar de grupo ativo (via `/grupos`), o cookie muda e a navegação para `/palpites` recomeça com o novo grupo

---

## Proteção de Rotas

- `/palpites` está dentro do route group `(dashboard)` — protegida pelo `layout.tsx` já existente que redireciona para `/login` se não autenticado
- Sem middleware adicional necessário

---

## Integração Supabase Realtime

Esta feature **não usa Supabase Realtime** — usa polling exclusivo de 10 segundos via `setInterval`. Decisão intencional para simplicidade e consistência com o requisito do PM.

---

## Critérios de Aceite

- [ ] Aba "PALPITES" aparece na tab bar entre JOGOS e RANKING, com `isPathActive` correto para `/palpites` e subpaths
- [ ] A rota `/palpites` carrega sem erros de autenticação ou grupo
- [ ] Cards sticky de jogos ao vivo exibem placar real + palpite do usuário logado
- [ ] Quando não há jogos ao vivo, seção exibe mensagem "NENHUM JOGO AO VIVO NO MOMENTO"
- [ ] Ranking exibe todos os participantes do grupo ordenados por `total_points` DESC (oficial + parcial live)
- [ ] Participantes com pontos de jogos ao vivo exibem `*` e cor `color-live` no total
- [ ] Clicar em um participante expande o breakdown com palpites e pontos por jogo
- [ ] Breakdown mostra o **palpite do participante**, não o placar real do jogo
- [ ] Jogos `pending` não aparecem no breakdown (apenas `live` e `finished`)
- [ ] Formato do breakdown por jogo: `🏳 COD Xplacar × Ysplacar COD 🏳 +N PTS · Label1 +N · Label2 +N`
- [ ] Pontos provisórios de jogos ao vivo marcados com `*` e `color-live` no breakdown
- [ ] Sem palpite exibe `— × —` e "SEM PALPITE" em `color-error`
- [ ] Ranking atualiza automaticamente a cada 10 segundos
- [ ] Após o primeiro render, mudanças de posição no ranking são animadas com FLIP (350ms ease-in-out)
- [ ] Animação FLIP não ocorre no primeiro render
- [ ] Usuário atual destacado em `color-primary`; líder destacado em `color-accent` com `►`
- [ ] Timestamp da última atualização visível no rodapé do ranking
- [ ] A tab bar com 5 itens (EU, JOGOS, PALPITES, RANKING, MAIS) cabe em tela de 320px sem overflow
- [ ] Design segue DESIGN.md rigorosamente: JetBrains Mono, paleta verde/amarelo/azul, dense, sem border-radius excessivo, sem ícones decorativos além de bandeiras emoji
- [ ] Funciona em mobile (coluna única, 320px)
- [ ] `npm run lint` e `npm run build` passam sem erros novos
