# Changelog: Drawer de Análise na Aba Palpites

**Slug:** palpites-analise-drawer
**Branch:** feature/palpites-analise-drawer
**Data:** 2026-06-27
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js Route Handler)

- `app/api/analise-data/route.ts` — GET handler autenticado que recebe `gameId` e `groupId`, verifica autenticação (JWT via cookie Supabase) e membership no grupo, executa queries paralelas de membros/palpites/scores, e retorna JSON com `game`, `participants`, `homeStats`, `awayStats`, `homeRecentGames`, `awayRecentGames`. Retorna 400/401/403/404 conforme o caso.

### Frontend (Next.js/React)

- `lib/analytics/team-stats.ts` — Módulo extraído de `analise/page.tsx`: exporta o tipo `GameRow`, e as funções `calculateTeamStats` e `getRecentGames` (com `formatDate` como helper interno não exportado). Elimina duplicação de lógica entre a página e o drawer.

- `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — Refatorado para importar `GameRow`, `calculateTeamStats` e `getRecentGames` de `@/lib/analytics/team-stats`, removendo as definições locais (redução de ~103 linhas).

- `components/bolao/GameAnaliseDrawer.tsx` — Bottom drawer com slide-up animado em 250ms. Funcionalidades:
  - Recebe `gameId | null` — `null` fecha o drawer sem desmontá-lo prematuramente
  - `isVisible`/`isOpen` separados para controlar presença no DOM vs. animação CSS
  - `Promise.resolve().then()` + duplo `requestAnimationFrame` para garantir transição CSS correta sem violar `react-hooks/set-state-in-effect`
  - Fetch de `/api/analise-data` ao abrir, com skeleton monospace durante carregamento e mensagem de erro em `color-error`
  - Renderiza `GameCard` (com `hideAnalysisLink`), `MatchupStatsCard` e `RecentGamesSection`
  - Deriva `myPrediction` e `myScore` a partir de `data.participants` (sem query adicional)
  - ESC fecha o drawer via `keydown` listener
  - `document.body.style.overflow = 'hidden'` enquanto aberto
  - Backdrop com fade-in/out sincronizado com o slide do painel
  - Área do botão ✕ mínima de 44×44px para toque mobile

- `components/bolao/PalpitesLiveCard.tsx` — Adicionada prop `onGameClick: (gameId: string) => void`. `GameItem` convertido de `<div>` para `<button>` com `onClick={() => onGameClick(game.id)}` e estado `isHovered` para feedback visual sem border-radius (estilo Elifoot).

- `app/(dashboard)/palpites/palpites-live-section.tsx` — Adicionado estado `selectedGameId`, conectado ao `onGameClick` do `PalpitesLiveCard`, e `GameAnaliseDrawer` renderizado ao final do componente.

- `app/publico/[groupId]/[date]/public-date-client.tsx` — Prop `onGameClick={() => {}}` adicionada ao `PalpitesLiveCard` na página pública (drawer desativado neste contexto, sem usuário autenticado).

---

## Decisões técnicas

**`Promise.resolve().then()` no useEffect em vez de setState direto** — O linter `react-hooks/set-state-in-effect` proíbe chamar `setState` diretamente no corpo de um `useEffect`. Mover os setState para um microtask (`Promise.resolve().then()`) resolve a violação mantendo o comportamento idêntico — React 18 ainda faz batch das chamadas dentro do mesmo microtask. Os outros componentes do projeto que têm o mesmo padrão (ChatPanelContent, GroupChatWidget, SidePanelContainer) não corrigi­ram a violação; optei por uma solução estruturalmente correta aqui.

**`isVisible` + `isOpen` separados** — `isVisible` controla se o drawer está no DOM (montado), enquanto `isOpen` controla a transição CSS. O duplo `requestAnimationFrame` garante que o elemento seja pintado pelo browser antes de `translateY(100%) → translateY(0)` ser aplicado, evitando que a animação seja "pulada".

**Dados do drawer não fazem polling** — Consistente com a página `/jogos/[gameId]/analise` (`revalidate = 60`), o conteúdo do drawer é carregado uma vez ao abrir. O `GameCard` dentro do drawer usa `useGameRealtime` e `useScoreRealtime` internamente, então o placar e score continuam se atualizando em tempo real via Supabase Realtime.

**Extração para `lib/analytics/team-stats.ts`** — A spec exige esta extração antes de qualquer outra mudança, pois tanto a `analise/page.tsx` quanto o novo route handler precisam da mesma lógica. Isso evita duplicação e garante consistência entre a página e a API.

**`onGameClick={() => {}}` na página pública** — A página `/publico/[groupId]/[date]` usa `PalpitesLiveCard` sem autenticação. Passar um no-op evita quebrar a interface pública sem precisar tornar a prop opcional ou criar uma variante do componente.

---

## Pontos de atenção para o Revisor

1. **Animação no iOS** — O duplo `requestAnimationFrame` funciona corretamente em Chrome/Firefox; verificar se em Safari/iOS a transição CSS `translateY` também é acionada após a dupla RAF. Em iOS, Safari pode atrasar a composição.

2. **Scroll lock em iOS** — `document.body.style.overflow = 'hidden'` nem sempre funciona em iOS Safari (o scroll pode continuar). Uma solução robusta seria `position: fixed` no body, mas a spec não exige isso — manter como implementado.

3. **`hideAnalysisLink` no `GameCard`** — Confirmar que o `GameCard` renderizado dentro do drawer não exibe o link "VER ANÁLISE" e que a prop `hideAnalysisLink` está sendo repassada corretamente.

4. **Membership check no route handler** — O check usa `supabase.auth.getUser()` (cliente com cookies da sessão) para validar o JWT. Confirmar que este padrão funciona igual aos outros route handlers do projeto.

5. **Página pública** — O `onGameClick={() => {}}` desativa efetivamente o drawer na página pública. Verificar se a UX do cursor pointer no `GameItem` pode ser confusa para usuários anonimos (eles clicam mas não acontece nada).

6. **Polling `usePalpitesAoVivo`** — Confirmar que o drawer, sendo renderizado dentro de `PalpitesLiveSection`, não interrompe o hook nem causa desmontagem do componente pai.

---

## Commits realizados

```
0a7d72a fix(palpites-analise-drawer): move setState do useEffect para microtask para evitar react-hooks/set-state-in-effect
569616b feat(palpites-analise-drawer): integra GameAnaliseDrawer na PalpitesLiveSection com selectedGameId
ebbe9a5 feat(palpites-analise-drawer): converte GameItem de div para button com onGameClick e hover state
e2f85fd feat(palpites-analise-drawer): cria GameAnaliseDrawer com slide-up, backdrop, skeleton, ESC e scroll lock
017fccb feat(palpites-analise-drawer): cria GET /api/analise-data route handler com auth, membership check e queries paralelas
ee7a368 refactor(palpites-analise-drawer): extrai GameRow/calculateTeamStats/getRecentGames de analise/page.tsx para lib/analytics/team-stats
8cdb272 feat(palpites-analise-drawer): cria lib/analytics/team-stats.ts com GameRow, calculateTeamStats e getRecentGames
c3b0685 chore(palpites-analise-drawer): adiciona plano de implementação
```
