# Design: Drawer de Análise na Aba Palpites

**Data:** 2026-06-27  
**Status:** Aprovado

## Contexto

A aba `/palpites` exibe um scroll horizontal de mini-cards de jogos (`PalpitesLiveCard`) no topo da tela, mostrando status, placar real e palpite do usuário. Hoje clicar nesses cards não faz nada.

A página de análise completa de cada jogo já existe em `/jogos/[gameId]/analise` e exibe: GameCard (palpite, participantes, breakdown de pontos) + MatchupStatsCard (estatísticas na Copa 2026) + RecentGamesSection (últimos 3 jogos de cada time). Porém, acessá-la exige sair da aba Palpites.

O objetivo é tornar os cards de placar clicáveis, abrindo o conteúdo da análise em um **bottom drawer** sem sair da aba Palpites — mantendo o ranking visível ao fechar.

## O Que Mudar

### Comportamento

- Clicar em qualquer `GameItem` dentro de `PalpitesLiveCard` abre um bottom drawer
- O drawer exibe exatamente o conteúdo da página `/jogos/[gameId]/analise`:
  1. `GameCard` (com `hideAnalysisLink: true`, já que não há página de análise para navegar)
  2. `MatchupStatsCard`
  3. `RecentGamesSection`
- O drawer **não** inclui `BackButton`, `NextGameLink`, `AnaliseSwipeNav` nem o footer de rodapé — o próprio drawer substitui o "voltar"
- Fechar o drawer: clique no backdrop, botão ✕ no header, ou tecla ESC
- URL permanece em `/palpites` — sem alteração de rota

### Visual do Drawer

```
┌────────────────────────────────────────┐
│  ░░░░░░░░░░ backdrop ░░░░░░░░░░░░░░░░ │  (rgba 0,0,0,0.7 — click fecha)
├────────────────────────────────────────┤
│  CRO × GHA                        [✕] │  ← header: nome do jogo + fechar
│  ─────────────────────────────────── │
│  [GameCard completo]                  │  ← palpite, editar, palpites, copiar link
│  [MatchupStatsCard]                   │  ← estatísticas
│  [RecentGamesSection]                 │  ← últimos 3 jogos
└────────────────────────────────────────┘
```

- Slide-up: `transform: translateY(100%)` → `translateY(0)` em 250ms
- Backdrop com fade-in simultâneo
- Altura máxima: `85vh`, conteúdo com scroll interno
- Estilo: JetBrains Mono, paleta Elifoot (igual ao restante do projeto)
- `GameItem` ganha `cursor: pointer` e feedback de hover (leve highlight)

## Arquitetura

### Novo: `/app/api/analise-data/route.ts`

GET endpoint server-side. Aceita `gameId` e `groupId` como query params.

Executa as mesmas queries da página `/jogos/[gameId]/analise`:
- Jogo principal
- Todos os jogos dos dois times na Copa 2026 (para stats e recentes)
- Palpite do usuário atual
- Score do usuário atual
- Membros do grupo
- Todos os palpites do jogo (no grupo)
- Todos os scores do jogo (no grupo)
- Existência de palpites via service role (para distinguir "OCULTO" vs "SEM PALPITE")

Retorna JSON com: `game`, `participants`, `homeStats`, `awayStats`, `homeRecentGames`, `awayRecentGames`.

Autentica o usuário via `createClient()` antes de responder.

### Novo: `components/bolao/GameAnaliseDrawer.tsx`

Client component. Props:

```typescript
interface GameAnaliseDrawerProps {
  gameId: string | null   // null = fechado
  groupId: string
  currentUserId: string
  onClose: () => void
}
```

- Quando `gameId` muda (e não é null): chama `GET /api/analise-data?gameId=X&groupId=Y`
- Enquanto carrega: skeleton monospace (linhas de `─────`)
- Após carregar: renderiza `GameCard` + `MatchupStatsCard` + `RecentGamesSection`
- Gerencia animações de abertura/fechamento via estado local + CSS transitions
- Trava scroll do `body` enquanto aberto (`overflow: hidden`)

### Modificado: `components/bolao/PalpitesLiveCard.tsx`

Adiciona prop `onGameClick: (gameId: string) => void`.  
Cada `GameItem` passa a ser um `<button>` com `cursor: pointer`, e chama `onGameClick(game.id)` no click.

### Modificado: `app/(dashboard)/palpites/palpites-live-section.tsx`

Adiciona estado:

```typescript
const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
```

Passa `onGameClick={setSelectedGameId}` para `PalpitesLiveCard`.  
Renderiza `<GameAnaliseDrawer>` com `gameId={selectedGameId}`, `onClose={() => setSelectedGameId(null)}`.

## Reutilização de Funções Existentes

As funções `calculateTeamStats` e `getRecentGames` estão atualmente definidas localmente em `/app/(dashboard)/jogos/[gameId]/analise/page.tsx`.

Devem ser extraídas para `/lib/analytics/team-stats.ts` e importadas tanto pela página de análise quanto pelo novo API route.

## Verificação

1. Abrir `/palpites` no app
2. Clicar em qualquer card de placar no topo
3. Verificar: drawer sobe com animação, exibe GameCard + MatchupStatsCard + RecentGamesSection idênticos à página `/jogos/[gameId]/analise`
4. Verificar: fechar via ✕, backdrop e ESC funciona
5. Verificar: ranking abaixo permanece intacto após fechar
6. Verificar: polling do `usePalpitesAoVivo` continua rodando durante drawer aberto
7. Testar em mobile: drawer abre corretamente, scroll interno funciona, área de toque no ✕ adequada
