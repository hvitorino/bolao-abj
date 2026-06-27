# Spec: Drawer de Análise na Aba Palpites

**Slug:** palpites-analise-drawer
**Data:** 2026-06-27
**Status:** spec

---

## Objetivo

Tornar os cards de placar na aba `/palpites` clicáveis, abrindo o conteúdo completo de análise do jogo em um bottom drawer com animação slide-up — sem sair da aba, sem alterar a URL, mantendo o polling do `usePalpitesAoVivo` ativo e o ranking intacto ao fechar.

---

## Histórias de Usuário

- Como participante do bolão, quero clicar num card de placar na aba Palpites para ver a análise completa do jogo (palpites dos participantes, estatísticas, histórico recente) sem perder o contexto do ranking.
- Como usuário mobile, quero fechar o drawer tocando no backdrop, no botão ✕ ou pressionando ESC, e ver o ranking exatamente como estava antes.

---

## Modelo de Dados

Nenhuma migration necessária. Nenhuma tabela nova ou modificada. Todos os dados já existem nas tabelas `games`, `predictions`, `scores`, `profiles` e `group_members`.

---

## Extração de Funções: `/lib/analytics/team-stats.ts`

**Antes de qualquer outra mudança**, extrair do arquivo `app/(dashboard)/jogos/[gameId]/analise/page.tsx` as seguintes definições:

### Tipo `GameRow`

```typescript
export type GameRow = {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  match_date: string
  match_day: string | null
  status: string
  round: string | null
}
```

### Função `formatDate` (não exportada)

```typescript
function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d
    .toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    .replace('.', '')
    .toUpperCase()
}
```

### Função `calculateTeamStats` (exportada)

```typescript
export function calculateTeamStats(
  games: GameRow[],
  teamCode: string,
  beforeDate: string
): TeamStats {
  // Lógica idêntica à da analise/page.tsx atual
}
```

Importa `TeamStats` de `@/components/bolao/MatchupStatsCard`.

### Função `getRecentGames` (exportada)

```typescript
export function getRecentGames(
  games: GameRow[],
  teamCode: string,
  beforeDate: string
): RecentGame[] {
  // Lógica idêntica à da analise/page.tsx atual
}
```

Importa `RecentGame` de `@/components/bolao/RecentGamesSection`.

**Após criar o arquivo**, atualizar `app/(dashboard)/jogos/[gameId]/analise/page.tsx` para importar `GameRow`, `calculateTeamStats` e `getRecentGames` de `@/lib/analytics/team-stats` e remover as definições locais.

---

## Backend — Endpoint Next.js Route Handler

### GET `/app/api/analise-data/route.ts`

**Arquivo:** `app/api/analise-data/route.ts`
**Autenticação:** requerida (Bearer JWT via cookie de sessão Supabase)

**Query params:**
- `gameId` (string, obrigatório) — UUID do jogo
- `groupId` (string, obrigatório) — UUID do grupo ativo

**Resposta de sucesso (200):**

```json
{
  "game": {
    "id": "uuid",
    "home_team": "Brasil",
    "away_team": "Argentina",
    "home_team_code": "BRA",
    "away_team_code": "ARG",
    "home_score": 3,
    "away_score": 1,
    "match_date": "2026-06-14T18:00:00Z",
    "match_day": "2026-06-14",
    "status": "finished",
    "round": "Grupo C"
  },
  "participants": [
    {
      "userId": "uuid",
      "name": "João",
      "prediction": { "home_score": 2, "away_score": 1 },
      "points": 6,
      "breakdown": { "winner": 3, "exact": 0, "winner_score": 3, "diff": 0, "loser_score": 0, "goleada": 0 },
      "hasPrediction": true
    }
  ],
  "homeStats": {
    "wins": 2, "draws": 1, "losses": 0,
    "goalsFor": 5, "goalsAgainst": 1,
    "goalDifference": 4, "cleanSheets": 1, "gamesScored": 3
  },
  "awayStats": { "wins": 1, "draws": 1, "losses": 1, "goalsFor": 3, "goalsAgainst": 4, "goalDifference": -1, "cleanSheets": 0, "gamesScored": 3 },
  "homeRecentGames": [
    { "date": "11 JUN", "placar": "3×1", "adversario": "ARG", "resultado": "V" }
  ],
  "awayRecentGames": []
}
```

**Erros possíveis:**
- `400 { error: "gameId e groupId são obrigatórios" }` — params ausentes
- `401 { error: "não autenticado" }` — usuário não autenticado
- `403 { error: "acesso negado" }` — usuário não é membro do grupo
- `404 { error: "jogo não encontrado" }` — gameId inválido
- `500 { error: "erro interno" }` — falha nas queries

**Implementação do route handler:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service-server'
import { calculateTeamStats, getRecentGames, GameRow } from '@/lib/analytics/team-stats'
import type { TeamStats } from '@/components/bolao/MatchupStatsCard'
import type { ScoreBreakdown, Score } from '@/lib/types/score'
import type { ParticipantEntry } from '@/lib/types/participant'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const gameId = searchParams.get('gameId')
  const groupId = searchParams.get('groupId')

  if (!gameId || !groupId) {
    return NextResponse.json({ error: 'gameId e groupId são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  // 2. Verificar membership no grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  // 3. Buscar jogo principal
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round')
    .eq('id', gameId)
    .single()

  if (gameError || !game) {
    return NextResponse.json({ error: 'jogo não encontrado' }, { status: 404 })
  }

  // 4. Buscar todos os jogos dos dois times na Copa 2026
  const { data: allTeamGames } = await supabase
    .from('games')
    .select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round')
    .or(
      `home_team_code.eq.${game.home_team_code},away_team_code.eq.${game.home_team_code},home_team_code.eq.${game.away_team_code},away_team_code.eq.${game.away_team_code}`
    )
    .order('match_date', { ascending: true })

  const games: GameRow[] = allTeamGames ?? []

  const supabaseService = createServiceClient()

  // 5. Queries paralelas (mesmas da analise/page.tsx, sem nextGame/prevGame)
  const [
    { data: existingPrediction },
    { data: myScore },
    { data: groupMembers },
    { data: allPredictions },
    { data: allScores },
    { data: predictionExistence },
  ] = await Promise.all([
    supabase
      .from('predictions')
      .select('id, user_id, game_id, home_score, away_score, submitted_at')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .maybeSingle(),

    supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .maybeSingle(),

    supabase
      .from('group_members')
      .select('user_id, profiles(id, name)')
      .eq('group_id', groupId),

    supabase
      .from('predictions')
      .select('id, game_id, user_id, home_score, away_score, submitted_at')
      .eq('group_id', groupId)
      .eq('game_id', gameId),

    supabase
      .from('scores')
      .select('*')
      .eq('group_id', groupId)
      .eq('game_id', gameId),

    supabaseService
      .from('predictions')
      .select('user_id, game_id')
      .eq('group_id', groupId)
      .eq('game_id', gameId),
  ])

  // 6. Montar participants (mesma lógica da analise/page.tsx)
  type GroupMemberRow = {
    user_id: string
    profiles: { id: string; name: string } | { id: string; name: string }[] | null
  }
  const memberProfiles = ((groupMembers ?? []) as GroupMemberRow[])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return profile ? { id: profile.id, name: profile.name } : null
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const predByUser: Record<string, { home_score: number; away_score: number }> = {}
  for (const p of allPredictions ?? []) {
    predByUser[p.user_id] = { home_score: p.home_score, away_score: p.away_score }
  }
  const scoreByUser: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}
  for (const s of (allScores ?? []) as Score[]) {
    scoreByUser[s.user_id] = { points: s.points, breakdown: s.breakdown }
  }
  const hasPredictionSet = new Set<string>(
    (predictionExistence ?? []).map((r) => r.user_id)
  )

  const participants: ParticipantEntry[] = memberProfiles.map((profile) => {
    const prediction = predByUser[profile.id] ?? null
    const scoreEntry = prediction !== null ? (scoreByUser[profile.id] ?? null) : null
    return {
      userId: profile.id,
      name: profile.name,
      prediction,
      points: scoreEntry?.points ?? null,
      breakdown: scoreEntry?.breakdown ?? null,
      hasPrediction: hasPredictionSet.has(profile.id),
    }
  })

  // 7. Calcular stats e jogos recentes
  const homeStats = calculateTeamStats(games, game.home_team_code, game.match_date)
  const awayStats = calculateTeamStats(games, game.away_team_code, game.match_date)
  const homeRecentGames = getRecentGames(games, game.home_team_code, game.match_date)
  const awayRecentGames = getRecentGames(games, game.away_team_code, game.match_date)

  return NextResponse.json({
    game,
    participants,
    homeStats,
    awayStats,
    homeRecentGames,
    awayRecentGames,
  })
}
```

---

## Frontend — Componentes React

### 1. `GameAnaliseDrawer`

**Arquivo:** `components/bolao/GameAnaliseDrawer.tsx`
**Tipo:** `'use client'`

**Interface de props:**

```typescript
interface GameAnaliseDrawerProps {
  gameId: string | null   // null = drawer fechado
  groupId: string
  currentUserId: string
  onClose: () => void
}
```

**Interface dos dados carregados:**

```typescript
interface AnaliseData {
  game: {
    id: string
    home_team: string
    away_team: string
    home_team_code: string
    away_team_code: string
    home_score: number | null
    away_score: number | null
    match_date: string
    match_day: string | null
    status: string
    round: string | null
  }
  participants: ParticipantEntry[]
  homeStats: TeamStats
  awayStats: TeamStats
  homeRecentGames: RecentGame[]
  awayRecentGames: RecentGame[]
}
```

**Estado interno:**

```typescript
const [isOpen, setIsOpen] = useState(false)         // controla a animação CSS
const [isVisible, setIsVisible] = useState(false)   // controla presença no DOM
const [data, setData] = useState<AnaliseData | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Lógica de abertura — `useEffect([gameId, groupId])`:**

1. Se `gameId === null`: retornar sem fazer nada (fechamento é controlado por `handleClose`)
2. Setar `isVisible(true)`, `loading(true)`, `error(null)`, `data(null)`
3. Iniciar fetch: `GET /api/analise-data?gameId={gameId}&groupId={groupId}`
4. Usar `requestAnimationFrame(() => requestAnimationFrame(() => setIsOpen(true)))` para garantir que o elemento já está no DOM antes de acionar a transição CSS
5. Ao completar o fetch: setar `data` ou `error`, setar `loading(false)`

**Lógica de fechamento — `handleClose()`:**

1. Chamar `setIsOpen(false)` — aciona a transição CSS reversa (translateY 0 → 100%)
2. Após 250ms: chamar `setIsVisible(false)` e `onClose()`

**Handler de ESC — `useEffect([isOpen])`:**

```typescript
useEffect(() => {
  if (!isOpen) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose()
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [isOpen])
```

**Trava de scroll — `useEffect([isOpen])`:**

```typescript
useEffect(() => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  return () => { document.body.style.overflow = '' }
}, [isOpen])
```

**Renderização:**

```typescript
if (!isVisible) return null

return (
  <>
    {/* Backdrop */}
    <div
      role="presentation"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: isOpen ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        transition: 'background-color 250ms ease',
      }}
    />

    {/* Drawer panel */}
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Análise do jogo"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 51,
        maxHeight: '85vh',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderBottom: 'none',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 250ms ease',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Header fixo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '12px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {data
            ? `${data.game.home_team_code} × ${data.game.away_team_code}`
            : 'ANÁLISE'}
        </span>
        <button
          onClick={handleClose}
          aria-label="Fechar"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-muted)',
            cursor: 'pointer',
            fontSize: '18px',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          ✕
        </button>
      </div>

      {/* Conteúdo com scroll */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
        {loading && <DrawerSkeleton />}
        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', textAlign: 'center', padding: '2rem 0' }}>
            ✗ {error}
          </div>
        )}
        {data && !loading && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <GameCard
                game={data.game as unknown as Game}
                prediction={/* existingPrediction: buscar de data.participants */}
                score={/* myScore: buscar de data.participants */}
                participants={data.participants}
                userId={currentUserId}
                groupId={groupId}
                hideAnalysisLink
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <MatchupStatsCard
                homeTeam={data.game.home_team}
                awayTeam={data.game.away_team}
                homeTeamCode={data.game.home_team_code}
                awayTeamCode={data.game.away_team_code}
                homeStats={data.homeStats}
                awayStats={data.awayStats}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <RecentGamesSection
                homeTeamCode={data.game.home_team_code}
                awayTeamCode={data.game.away_team_code}
                homeRecentGames={data.homeRecentGames}
                awayRecentGames={data.awayRecentGames}
              />
            </div>
          </>
        )}
      </div>
    </div>
  </>
)
```

**Extração de `prediction` e `score` do usuário atual:**

O `GameCard` recebe `prediction` e `score` do usuário atual. Derivar a partir de `data.participants`:

```typescript
const myParticipant = data.participants.find(p => p.userId === currentUserId)

// prediction: construir objeto Prediction ou null
const myPrediction: Prediction | null = myParticipant?.prediction
  ? {
      id: '',           // não necessário para exibição
      user_id: currentUserId,
      game_id: data.game.id,
      group_id: groupId,
      home_score: myParticipant.prediction.home_score,
      away_score: myParticipant.prediction.away_score,
      submitted_at: '',
    }
  : null

// score: construir objeto Score ou null
const myScore: Score | null = myParticipant?.points !== null && myParticipant?.breakdown
  ? {
      id: '',
      user_id: currentUserId,
      game_id: data.game.id,
      group_id: groupId,
      prediction_id: '',
      points: myParticipant.points!,
      breakdown: myParticipant.breakdown,
      calculated_at: '',
    }
  : null
```

**Componente local `DrawerSkeleton`:**

```typescript
function DrawerSkeleton() {
  const line = (w: number) => (
    <div style={{ color: 'var(--color-muted)', fontSize: '12px', marginBottom: '0.5rem' }}>
      {'─'.repeat(w)}
    </div>
  )
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", padding: '0.5rem 0' }}>
      {line(42)}
      {line(36)}
      {line(40)}
      {line(28)}
      {line(38)}
      {line(32)}
    </div>
  )
}
```

---

### 2. Modificação: `PalpitesLiveCard`

**Arquivo:** `components/bolao/PalpitesLiveCard.tsx`

**Interface atualizada:**

```typescript
interface PalpitesLiveCardProps {
  todayGames: LiveGameWithPrediction[]
  loading: boolean
  onGameClick: (gameId: string) => void  // NOVO
}
```

**Modificação no `map`:**

```typescript
{todayGames.map((game) => (
  <GameItem key={game.id} game={game} onGameClick={onGameClick} />
))}
```

**Modificação em `GameItem`:**

```typescript
function GameItem({
  game,
  onGameClick,
}: {
  game: LiveGameWithPrediction
  onGameClick: (gameId: string) => void  // NOVO
}) {
```

O elemento raiz de `GameItem` muda de `<div>` para `<button>`:

```typescript
return (
  <button
    onClick={() => onGameClick(game.id)}
    style={{
      ...MONO,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.1rem',
      opacity: isPending ? 0.65 : 1,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '0.25rem 0.5rem',
      // Hover: leve highlight sem border-radius (estilo Elifoot)
      // Implementado via CSS class ou onMouseEnter/Leave — ver abaixo
    }}
  >
    {/* ... conteúdo interno inalterado ... */}
  </button>
)
```

**Feedback de hover:** usar estado local `isHovered` + `onMouseEnter`/`onMouseLeave` para aplicar `backgroundColor: 'rgba(255,255,255,0.04)'` quando hovered. Nenhuma borda extra. Sem `border-radius`.

---

### 3. Modificação: `palpites-live-section.tsx`

**Arquivo:** `app/(dashboard)/palpites/palpites-live-section.tsx`

**Novo estado:**

```typescript
const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
```

**Modificação no `PalpitesLiveCard`:**

```typescript
<PalpitesLiveCard
  todayGames={todayGames}
  loading={loading}
  onGameClick={setSelectedGameId}   // NOVO
/>
```

**Drawer renderizado no final do retorno** (após todo o conteúdo existente, antes do fechamento do `<div>` raiz):

```typescript
<GameAnaliseDrawer
  gameId={selectedGameId}
  groupId={groupId}
  currentUserId={currentUserId}
  onClose={() => setSelectedGameId(null)}
/>
```

**Imports a adicionar:**

```typescript
import GameAnaliseDrawer from '@/components/bolao/GameAnaliseDrawer'
```

---

## Regras de Negócio

1. **Visibilidade de palpites no drawer**: o `GameCard` renderizado dentro do drawer deve obedecer exatamente as mesmas regras já implementadas — palpites de terceiros em jogos `pending` ficam ocultos (`hasPrediction` distingue OCULTO vs PENDENTE), usando os dados de `participants` retornados pela API.

2. **`hideAnalysisLink: true`**: obrigatório ao renderizar `GameCard` dentro do drawer, para suprimir o link "VER ANÁLISE" que levaria para a página `/jogos/[gameId]/analise`.

3. **Polling do `usePalpitesAoVivo` continua**: a abertura do drawer não deve parar o polling de 10 segundos. Como o drawer é renderizado dentro de `PalpitesLiveSection` (que já contém o hook), o polling não é interrompido. Confirmar que o drawer não desmonta `PalpitesLiveSection`.

4. **Dados do drawer não fazem polling**: a análise dentro do drawer carrega uma vez (ao abrir) e não se atualiza automaticamente. Isso é intencional — consistente com o comportamento da página `/jogos/[gameId]/analise` (`revalidate = 60`).

5. **Reutilização de `GameCard` (client component com Realtime)**: o `GameCard` usa `useGameRealtime` e `useScoreRealtime` internamente. Isso é comportamento esperado — o drawer terá atualização em tempo real do placar via Realtime, o que é um bônus.

6. **Membership verification no API route**: o route handler verifica que o usuário autenticado é membro do `groupId` informado antes de executar qualquer query. Retorna `403` em caso de acesso negado.

---

## Proteção de Rotas

O endpoint `GET /api/analise-data` é uma rota autenticada. O acesso não-autenticado retorna `401`. Não há redirecionamento — é uma API route, não uma página.

A rota `/palpites` já é protegida pelo middleware existente (grupo `(dashboard)`). Sem mudança aqui.

---

## Critérios de Aceite

- [ ] Clicar em qualquer `GameItem` dentro de `PalpitesLiveCard` abre o drawer com slide-up em 250ms
- [ ] Backdrop com fade-in simultâneo ao slide-up
- [ ] Drawer exibe `GameCard` + `MatchupStatsCard` + `RecentGamesSection` idênticos ao que aparece em `/jogos/[gameId]/analise`
- [ ] `GameCard` renderizado com `hideAnalysisLink: true` (sem link "VER ANÁLISE")
- [ ] Fechar via botão ✕ funciona com animação slide-down em 250ms
- [ ] Fechar via clique no backdrop funciona
- [ ] Fechar via tecla ESC funciona
- [ ] URL permanece em `/palpites` após abrir e fechar o drawer
- [ ] Ranking abaixo permanece visível e intacto após fechar o drawer
- [ ] Polling do `usePalpitesAoVivo` (10s) continua rodando enquanto o drawer está aberto
- [ ] Scroll do `body` travado com `overflow: hidden` enquanto o drawer está aberto
- [ ] Área do botão ✕ tem mínimo de 44×44px (área de toque mobile adequada)
- [ ] Em mobile (375px), drawer abre corretamente com conteúdo scrollável internamente
- [ ] Estado de loading exibe skeleton monospace (`─────`) enquanto a API responde
- [ ] Estado de erro exibe mensagem clara em `color-error`
- [ ] `GET /api/analise-data` retorna 401 para usuários não autenticados
- [ ] `GET /api/analise-data` retorna 403 se usuário não é membro do grupo
- [ ] `GET /api/analise-data` retorna 404 para gameId inválido
- [ ] `lib/analytics/team-stats.ts` criado com `GameRow`, `calculateTeamStats`, `getRecentGames`
- [ ] `analise/page.tsx` atualizado para importar de `@/lib/analytics/team-stats` (sem definições locais duplicadas)
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta Elifoot (`color-surface`, `color-border`, `color-muted`), sem border-radius, sem sombras
- [ ] `npm run lint` e `npm run build` passam sem erros novos
