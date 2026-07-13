# Changelog — Bolão da Copa

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

## [fix-bracket-cache-reactive] — Chaveamento reativo aos eventos de palpite — 2026-07-13

- **Sintoma:** palpite editado/criado não atualizava no chaveamento (bracket) inline nem no `/chaveamento`; o bracket ficava congelado com os dados do fetch inicial.
- **Causa raiz:** o `BracketTree` guardava os palpites em estado local semeado uma única vez (via `useBracketExpansion` no inline, ou SSR no standalone) e não escutava nenhum evento do cache. No inline, o drawer interno fica desligado (`onGameClick` externo), então nem o re-fetch manual (`handlePredictionSubmitted`) rodava. O bracket estava fora da camada reativa de cache usada pelo resto do app.
- **Fix:** `BracketTree` agora assina `subscribeToPredictionUpdates(groupId, …)` e substitui o palpite no estado local ao receber qualquer evento do usuário atual (edição/criação, deste device ou de outro via Realtime), adquirindo/liberando o `PredictionCache` no ciclo de vida. `PalpitesLiveCard` passa `groupId`/`currentUserId` ao bracket inline.
- **Arquivos:** `components/bolao/BracketTree.tsx`, `components/bolao/PalpitesLiveCard.tsx`
- Sem alterações de banco, migrations ou endpoints. `tsc --noEmit` e `eslint` sem erros novos.

## [fix-palpite-cache-propagation] — Propagação instantânea de palpite editado/criado — 2026-07-13

- **Sintoma:** palpite editado (ou criado) no bottom sheet de detalhes do jogo (`GameAnaliseDrawer`) não replicava para a navegação de palpites (`/palpites`) nem para outros dispositivos, mesmo com o Realtime de `predictions` ativo remotamente.
- **Causa raiz 1 (edição):** `lib/hooks/usePalpitesAoVivo.ts` — o guard FLIP de `computeAndSetState` só detectava mudança em placar/status de jogo (`scoresKey`). Os listeners de palpite e pontos chamavam `computeAndSetState()` sem `forceUpdate`, então o eco Realtime atualizava o cache mas o `setState` era descartado quando o placar do jogo não mudava. Como todos os devices passam pelo mesmo guard, o sintoma aparecia igual local e remotamente. Fix: listeners de palpite e pontos agora chamam `computeAndSetState(true)`; o guard permanece só no listener de jogos (filtra ruído do polling de placares ao vivo).
- **Causa raiz 2 (criação):** `lib/cache/prediction-cache.ts` — `upsertPredictionInCache` só atualizava chaves já existentes, descartando silenciosamente palpites novos (INSERT) recebidos via Realtime; só apareciam no poll de 60s. Fix: quando a chave não existe, descobre a data do jogo via novo helper `getGameDate` (`lib/cache/score-cache.ts`) e insere no bucket de data correspondente.
- **Arquivos:** `lib/hooks/usePalpitesAoVivo.ts`, `lib/cache/prediction-cache.ts`, `lib/cache/score-cache.ts`
- Sem alterações de banco, migrations ou endpoints. `tsc --noEmit` e `eslint` sem erros novos.

## [centralizar-cache-v2-stage4] — usePalpitesAoVivo lê dos caches — 2026-07-02

- **Hook modificado:** `lib/hooks/usePalpitesAoVivo.ts` — reescrita completa do sistema de dados
- **Arquitetura:** separação em Fluxo A (`initialize`, assíncrono com IO, mount + visibilitychange) e Fluxo B (`computeAndSetState`, síncrono sem IO, listeners de cache com debounce)
- **Caches consumidos:** ScoreCache (`ensureDate`, `getCachedGames`), PredictionCache (`ensurePredictions`, `getCachedPredictions`, `subscribeToPredictionUpdates`), PointsCache (`ensurePoints`, `getCachedPoints`, `subscribeToPointsUpdates`)
- **Canal novo adicionado:** `points-${groupId}` via `acquirePointsCache`/`releasePointsCache`
- **Queries eliminadas:** 4 chamadas Supabase por tick (`games`, `predictions`, `scores` + `/api/ranking`) — reduzido a 3 `ensure*` no mount + 1 `fetchParticipants` (nomes)
- **`/api/ranking`:** chamado apenas em `fetchParticipants()` (mount + visibilitychange), nunca disparado por tick de jogo ao vivo
- **Guard FLIP preservado:** `prevScoresKey` computado de `getCachedGames(selectedDate)`
- **Tipos removidos:** `GameRow`, `PredictionRow`, `ScoreRow` (agora usando tipos dos caches)
- **Interface pública:** `UsePalpitesAoVivoResult` mantida sem breaking changes

## [centralizar-cache-v2-stage3] — useLivePointsByUser + useLiveTodayRanking leem dos caches — 2026-07-02

- **Hooks migrados:** `useLivePointsByUser` e `useLiveTodayRanking` eliminam todas as queries diretas a `games`, `predictions` e `scores`; todo acesso passa pelos três caches singleton
- **Nova função:** `getLiveGames(): Game[]` adicionada e exportada em `lib/cache/score-cache.ts` — iteração síncrona sem IO
- **`useLivePointsByUser`:** lê jogos ao vivo via `getLiveGames()` (ScoreCache) e palpites via `getCachedPredictions()` (PredictionCache); gerencia lifecycle dos 3 caches; dois listeners com debounce 1000ms
- **`useLiveTodayRanking`:** elimina 3 queries diretas; mantém apenas one-shot de `group_members` (nomes fora de cache); 3 listeners (ScoreCache + PointsCache + PredictionCache) com debounce 1000ms; `membersRef` para closure estável; cálculo síncrono em `computeAndSetEntries`
- **Canais Realtime:** nenhum canal novo criado — ambos os hooks consomem os canais existentes via acquire/release

## [centralizar-cache-v2-stage1] — PointsCache (Singleton de Pontuações) — 2026-07-02

- **Novo módulo:** `lib/cache/points-cache.ts` — singleton de cache para a tabela `scores`, escopado por `groupId`
- **Estrutura interna:** `Map<gameId, Map<userId, CachedPoints>>` nativa (sem flat-key) — evita o bug de upsert silenciosamente descartado do `PredictionCache`
- **API exportada:** `ensurePoints`, `ensurePointsForGame`, `getCachedPoints`, `getPointsFor`, `subscribeToPointsUpdates`, `subscribeToPointsInvalidations`, `acquirePointsCache`, `releasePointsCache`, `clearPointsCache`
- **Realtime:** canal `points-${groupId}` na tabela `scores` com filtro `group_id=eq.${groupId}`, INSERT/UPDATE/DELETE com upsert incondicional
- **Polling:** intervalo 60s + `visibilitychange` como fallback para reconexão após sleep
- **Dead code seguro:** arquivo não importado em nenhum outro módulo até Stage 2

## [score-prediction-cache] — Cache Centralizado de Placar e Palpites — 2026-07-01

- **Infraestrutura:** `lib/cache/score-cache.ts` (singleton com Realtime global para `games` — 1 canal vs N canais) + `lib/cache/prediction-cache.ts` (singleton com Realtime para `predictions` por grupo + Polling 60s)
- **Hooks:** `lib/hooks/useLiveScores.ts` (substitui `useGameRealtime` — cache entre datas, 1 canal global) + `lib/hooks/usePredictionsRealtime.ts` (substitui polling 10s por Realtime instantâneo + fallback 60s)
- **Ranking derivado:** `lib/ranking-derived.ts` — `computeLiveRanking()` unifica lógica espalhada em 4 hooks (usePalpitesAoVivo, useLivePointsByUser, useLiveTodayRanking, RankingTable.applyLivePoints)
- **Componentes:** `components/games/JogosRealtime.tsx` (wrapper conectando caches ao GameCard) + `GameCard` atualizado com props `liveGame`/`liveParticipants` (backward compat)
- **Página:** `app/(dashboard)/jogos/page.tsx` migrado para ScoreCache + PredictionCache — dados de jogos agora são reativos com 1 canal global
- **Migration:** `supabase/migrations/20260701000000_enable_realtime_predictions.sql` — habilita `predictions` para Supabase Realtime (REPLICA IDENTITY FULL + ALTER PUBLICATION)
- **Pendências (fix-1):** `/palpites`, `RankingTable`, `LiveTodayBottomSheet`, `PublicGameClient` ainda usam hooks antigos — migração incremental em fases futuras. Migration SQL pendente de aplicação no Supabase.

## [maximize-analise-drawer] — Maximizar Bottom Sheet de Análise de Jogo — 2026-07-01

- Botão `▲`/`▼` adicionado à direita do drag handle do `GameAnaliseDrawer` para expandir/restaurar o bottom sheet
- Estado `isMaximized: boolean` (padrão `false`) controla o tamanho do painel: `72vh` (normal) vs `calc(100dvh - 52px - env(safe-area-inset-bottom) - env(safe-area-inset-top))` (maximizado)
- `borderRadius` do painel transiciona de `8px 8px 0 0` para `0` ao maximizar
- Animação de `250ms ease` em `transform`, `max-height` e `border-radius` via `transition` expandida
- `onTouchEnd` no botão limpa estado residual de drag em mobile (`isDragging`, `dragOffset`, `touchStartY`)
- `isMaximized` resetado ao fechar o drawer e ao abrir para um novo jogo
- Botão acessível por teclado com `aria-label` dinâmico em português e área de toque mínima de 44×44px
- Arquivo modificado: `components/bolao/GameAnaliseDrawer.tsx` (único)

## [fix-chaveamento] — Correção do Chaveamento (Cruzamentos + Layout Simétrico) — 2026-07-01

- Migration `20260701000000_fix_bracket_slot_pairings.sql` (v1) alterava cruzamentos R32→R16 com pareamento não-sequencial — **REVERTIDA**
- Migration `20260701000001_fix_bracket_slot_pairings_v2.sql` (v2) restaura pareamento sequencial e corrige o que realmente estava errado:
  - R32→R16: pareamento sequencial preservado (01+02→R16-01, 03+04→R16-02, …, 15+16→R16-08)
  - QF→SF corrigido: QF-02 → **SF-02** (antes SF-01) e QF-03 → **SF-01** (antes SF-02), agrupando Lado Esquerdo (R32 01-04 + 09-12 → SF-01) e Lado Direito (R32 05-08 + 13-16 → SF-02)
  - `source_home`/`source_away` das SFs atualizados: SF-01 = QF-01 × QF-03, SF-02 = QF-02 × QF-04
  - `source_home`/`source_away` dos R16 restaurados ao sequencial (v1 havia alterado 7 slots)
- `BracketConnector` recebe prop `reversed?: boolean` que inverte as coordenadas x do SVG para suporte ao lado espelhado
- Novo `BracketColumnRight`: espelho recursivo de `BracketColumn` — card à esquerda, conector reversed, filhos à direita
- Novo `SymmetricBracket`: substitui `FinalAnd3rdColumn` com layout clássico simétrico (chave esq | FINAL+3RD ao centro | chave dir espelhada)
- `FinalAnd3rdColumn` removido; `BracketTree` passa a usar `SymmetricBracket`
- Scroll horizontal, `GameAnaliseDrawer` e propagação de `onGameClick` preservados sem regressão

## [ranking-por-scout] — Ranking por Scout — 2026-06-30

- Chips de seleção de scout ("GERAL" + 6 categorias) adicionados acima da tabela de ranking
- Ao selecionar um scout, o ranking é reordenado pela contagem daquele scout (decrescente, client-side)
- Coluna PONTOS muda para o label do scout selecionado e exibe a contagem por participante
- Nova interface `ScoutCounts` com 6 campos: `exact`, `winner`, `winner_score`, `diff`, `loser_score`, `goleada`
- Migration `20260630100000_add_scout_counts_to_ranking_scouts.sql` estende `get_ranking_scouts()` com 4 novas colunas
- Endpoint `/api/ranking` retorna campo `scout_counts` com as 6 contagens (modo Geral) ou `null` (modo por rodada)
- Arquivos modificados: `lib/types/ranking.ts`, `app/api/ranking/route.ts`, `components/bolao/RankingTable.tsx`, `components/bolao/RankingRow.tsx`

## [fix-all-recent-games] — Exibir Todos os Jogos Anteriores na Análise — 2026-06-30

- Seção "Últimos 3 jogos na Copa 2026" renomeada para "Jogos" no drawer de análise
- Limite de 3 jogos removido — agora lista todos os jogos anteriores dos times na Copa 2026
- Arquivos modificados: `lib/analytics/team-stats.ts`, `components/bolao/RecentGamesSection.tsx`, `app/(dashboard)/jogos/[gameId]/analise/page.tsx`
- Sem alterações no banco de dados

## [inline-bracket-expand] — Chaveamento Expansível no Card de Palpites — 2026-06-30

- Adicionado ícone ⤢/⤡ no cabeçalho do `PalpitesLiveCard` visível apenas em dias de mata-mata (fase ≥ 16 avos)
- Ao expandir, renderiza o `BracketTree` inline abaixo da grade de jogos, com scroll horizontal
- Fetch lazy dos dados do bracket (slots + games + predictions) — só carrega ao expandir
- `BracketTree` já gerencia seu próprio `GameAnaliseDrawer` para cliques nos jogos
- Campo `phase` adicionado ao hook `usePalpitesAoVivo` e consumers públicos
- Sem alterações no banco de dados — reutiliza `bracket_slots`, `games`, `predictions`

## [group-standings-bottomsheet] — Classificação do Grupo no Bottom Sheet — 2026-06-29

- `lib/analytics/group-standings.ts` criado: módulo puro com tipo `StandingEntry` e função `calculateGroupStandings(allGroupGames, beforeDate)` — extrai times únicos, inicializa acumuladores zerados, filtra jogos `finished + match_date < beforeDate`, acumula (vitória +3, empate +1, derrota 0), ordena pontos DESC → saldo DESC → gols pró DESC → nome ASC, retorna array position 1-based
- `components/bolao/GroupStandingsCard.tsx` criado: tabela de classificação com header `color-primary`, grid `20px 1fr 22px 22px 20px 20px 20px 24px 24px 26px`, colunas `# TIME P J V E D GP GC SG`, linhas zebra, destaque dos times do confronto com `rgba(0,156,59,0.15)` + `fontWeight: bold`, posição destacada em `color-accent`, coluna SG colorida por sinal (`color-win` / `color-error` / `color-muted`), JetBrains Mono, sem `border-radius` nem `box-shadow`
- `app/api/analise-data/route.ts` estendido: step 4b busca todos os jogos do grupo via `.eq('round', game.round)` quando `round.startsWith('Grupo')`; step 7b chama `calculateGroupStandings` e adiciona campo `groupStandings: StandingEntry[] | null` ao JSON de resposta (`null` para mata-mata)
- `components/bolao/GameAnaliseDrawer.tsx` estendido: importa `GroupStandingsCard` e tipo `StandingEntry`; adiciona campo `groupStandings` à interface `AnaliseData`; renderiza `GroupStandingsCard` condicionalmente após `RecentGamesSection` quando `data.groupStandings !== null && data.game.round`
- Sem alterações de banco de dados, migrations ou RLS — usa tabela `games` já existente

## [modo-acompanhar] — Modo Acompanhar na Aba Palpites — 2026-06-27

- `components/bolao/AcompanharToggle.tsx` criado: botão toggle dois estados (outline "◉ ACOMPANHAR" / preenchido "● ACOMPANHANDO"), `flex: 1`, sem transição CSS, cor primária (#009c3b) como borda sempre
- `components/bolao/CompartilharButton.tsx` criado: extração da lógica de cópia de link de `palpites-live-section.tsx`; copia `origin/publico/:groupId/:selectedDate`, feedback "✓ COPIADO!" por 2s em `color-win`, nunca tem estado ativo
- `components/bolao/AcompanharCarrossel.tsx` criado: carrossel horizontal de mini-cards (`overflow-x: auto`, `scrollbar-width: none`), 4 estados por card (em-breve, ao-vivo, final, pontuado), índice O(1) por `gameId`, placar em BRT
- `components/bolao/AcompanharRanking.tsx` criado: tabela estática de ranking do dia sem accordion; indicadores `► ` (líder) e `■ ` (usuário atual); linha do usuário com fundo `rgba(0,151,59,0.08)`; estados loading (3 esqueletos) e vazio
- `app/(dashboard)/palpites/palpites-live-section.tsx` atualizado: estado `viewMode` com persistência via `sessionStorage`, reset na troca de grupo via `useRef`, botão de compartilhar extraído para `CompartilharButton`, `PalpitesLiveCard` ocultado no modo Acompanhar, renderização condicional de conteúdo
- `app/globals.css` atualizado: regra `.acompanhar-carrossel::-webkit-scrollbar { display: none }` adicionada
- Sem alterações de banco de dados, migrations, RLS ou endpoints

## [nav-redesign] — Redesign da Navegação (Abas) — 2026-06-27

- `components/bolao/ChatBottomSheet.tsx` criado: bottom sheet para chat do grupo com lazy-mount de `ChatPanelContent`, swipe-to-close (threshold 60px), backdrop com click-to-close, handler de ESC, scroll lock do body e animação slide-up idêntica ao `GameAnaliseDrawer` (posição, dimensões e transição CSS)
- `components/bolao/TabBar.tsx` modificado: reordenação das abas para EU | RANKING | PALPITES | CHAT | MAIS; aba JOGOS removida; CHAT é `<button>` que abre `ChatBottomSheet`; badge de não lidas (`color-accent`) aparece quando `chatUnreadCount > 0 && !chatOpen`; props `groupId`, `currentUserId`, `activeGroupName` adicionadas; botão CHAT desabilitado (cursor default, sem ação) quando `groupId === ''`
- `app/(dashboard)/layout.tsx` atualizado: passa `groupId`, `currentUserId` e `activeGroupName` para `<TabBar />`
- `components/bolao/SidePanelContainer.tsx` modificado: pull tab CHAT, painel CHAT, import de `ChatPanelContent`, estados `chatEverOpened`/`chatUnreadCount`, callback `handleUnreadCountChange`, `useEffect` de chat e `showChatTab` removidos; `PanelId` simplificado para `'recap' | 'live' | null`; `overflowY` fixo em `'auto'`
- Rota `/jogos` e todos seus arquivos preservados intactos (apenas removida da tab bar)
- Nenhuma alteração de banco de dados, migrations, RLS ou endpoints

## [palpites-analise-drawer] — Drawer de Análise na Aba Palpites — 2026-06-27

- `lib/analytics/team-stats.ts` criado: exporta `GameRow`, `calculateTeamStats`, `getRecentGames` (extraído de `analise/page.tsx` para evitar duplicação)
- `app/(dashboard)/jogos/[gameId]/analise/page.tsx` refatorado: importa de `@/lib/analytics/team-stats` (remove ~103 linhas de definições locais)
- `app/api/analise-data/route.ts` criado: GET autenticado com validação de membership no grupo, queries paralelas de membros/palpites/scores/estatísticas; retorna 400/401/403/404/500 conforme o caso
- `components/bolao/GameAnaliseDrawer.tsx` criado: bottom drawer com slide-up 250ms, backdrop fade, skeleton monospace, estado de erro, ESC, scroll lock, área ✕ mínima 44×44px, derivação de `myPrediction`/`myScore` de `participants`
- `components/bolao/PalpitesLiveCard.tsx` atualizado: prop `onGameClick` adicionada; `GameItem` convertido de `<div>` para `<button>` com hover state
- `app/(dashboard)/palpites/palpites-live-section.tsx` atualizado: estado `selectedGameId` e `GameAnaliseDrawer` integrados
- `app/publico/[groupId]/[date]/public-date-client.tsx` atualizado: `onGameClick={() => {}}` (drawer desabilitado em contexto público)

## [palpites-breakdown-por-jogo] — Breakdown Vertical por Jogo nos Palpites — 2026-06-27

- `components/bolao/PalpitesRankingRow.tsx` refatorado: accordion substituído por blocos verticais jogo a jogo (componente local `GameBreakdownBlock`)
- Removidos: `buildRuleGroups`, `RuleGroupLine`, `LiveGameLine`, interfaces `RuleGame` e `RuleGroup`
- Cada jogo exibe linha-cabeçalho `[COD Hg×Ag COD | palpite | total]` + sub-linhas indentadas por regra (apenas regras com pontos > 0)
- Guard de privacidade: palpite de terceiro em jogo pendente exibe `—` (defesa em profundidade sobre RLS)
- Jogos ao vivo: total e sub-linhas em `color-live` com sufixo `*` (provisório); atualiza via polling de 10s existente
- Estado vazio "NENHUM PONTO CONQUISTADO HOJE" dispara apenas quando `participant.games.length === 0` (sem jogos no dia)
- Padding do accordion: `'0.35rem 3.5rem 0.35rem 0.75rem'` → `'0.25rem 0.5rem'` para eliminar scroll horizontal em 360px
- Sem alterações de backend, banco de dados ou endpoints

## [public-date-view] — Página Pública por Data — 2026-06-25

- Rota `/publico/[groupId]/[date]` criada como Server Component público (fora de `(dashboard)` e `(auth)`), acessível sem login em qualquer browser
- `app/publico/[groupId]/[date]/page.tsx`: valida `groupId` e `date` (via `isValidDateString`), exibe erros inline preservando o header público; busca jogos por `match_day`, membros do grupo via join `group_members + profiles`, palpites com visibilidade condicional por status (pending: só existência/OCULTO; live/finished: valores reais), scores de jogos encerrados — tudo via `createServiceClient()` (service_role, bypassa RLS); `generateMetadata` com título `{N} JOGOS · {DD MMM YYYY} — Bolão da Copa`; `revalidate = 0`
- `app/publico/[groupId]/[date]/public-date-client.tsx`: Client Component com dois canais Supabase Realtime (`public-date-games-*` e `public-date-scores-*`); calcula ranking do dia em tempo real (pontos oficiais de jogos `finished` + pontos provisórios de jogos `live` via `calculateLiveScore()`); renderiza `PublicDateRanking` + uma `PublicDateGameSection` por jogo em ordem cronológica
- `components/bolao/PublicDateGameSection.tsx`: mini placar com grid `1fr auto 1fr`, badge de status (■ AO VIVO / □ ENCERRADO / PENDENTE), formatação de rodada (remove prefixo "Copa do Mundo NNNN - ") + horário BRT; reutiliza `PublicParticipantsList` existente para tabela de palpites
- `components/bolao/PublicDateRanking.tsx`: ranking do dia com posição, `►` para líder, pontos totais (oficial + ao vivo), badge `★ AO VIVO` em `color-live`, rodapé `* PONTOS AO VIVO SÃO PROVISÓRIOS`; ordenação por pontos decrescente, desempate por nome pt-BR
- `lib/types/public-date.ts`: interfaces `PublicDateGame` e `ProfileEntry`
- `app/(dashboard)/palpites/palpites-live-section.tsx` modificado: botão `⎘ COPIAR LINK DO DIA` full-width abaixo do `DateChipsNav`; copia `${origin}/publico/${groupId}/${selectedDate}`; feedback visual `✓ COPIADO!` por 2 segundos em `color-win`; try/catch silencioso
- Sem endpoints novos, sem migrations de banco; políticas anon para Realtime de `games` e `scores` já existiam em `20260624000010_public_read_games_scores.sql`

## [palpites-ao-vivo] — Aba de Palpites com Jogos ao Vivo e Ranking — 2026-06-25

- Aba `PALPITES` adicionada à tab bar entre JOGOS e RANKING; `fontSize: 12px` e `letterSpacing: 0.04em` para acomodar 5 elementos em 320px
- Rota `/palpites` criada como Server Component (`app/(dashboard)/palpites/page.tsx`): resolve `currentUserId` e `groupId` via sessão Supabase e cookie `bolao_active_group`, redireciona para `/grupos` sem grupo ativo
- `palpites-live-section.tsx`: Client Component orquestrador que instancia `usePalpitesAoVivo` uma única vez e distribui dados para `PalpitesLiveCard` (sticky) e `PalpitesRanking`
- `lib/hooks/usePalpitesAoVivo.ts`: hook com polling de 10s (`POLL_INTERVAL_MS = 10_000`); busca jogos `live`+`finished`, palpites e scores por `group_id`, ranking via `/api/ranking`; calcula pontos parciais de jogos live via `calculateLiveScore()`; não reseta `loading` em polls subsequentes
- `components/bolao/PalpitesLiveCard.tsx`: cards sticky com badge `██ AO VIVO ██` piscante (`color-live`), placar real 24px bold em `color-accent`, palpite do usuário logado; scroll horizontal com ≥2 jogos (`min-width: 260px`); estado vazio "NENHUM JOGO AO VIVO NO MOMENTO"
- `components/bolao/PalpitesRankingRow.tsx`: linha do ranking com accordion de breakdown; acessibilidade completa (`role="button"`, `aria-expanded`, `aria-controls`, `role="region"`, `aria-label`); ativação por Enter/Espaço; `►`/`■` para líder/currentUser; breakdown filtra apenas jogos `live`/`finished`; pontos provisórios marcados com `*` em `color-live`
- `components/bolao/PalpitesRanking.tsx`: tabela com animação FLIP manual (`useLayoutEffect`, 350ms ease-in-out) idêntica ao padrão de `PublicParticipantsList.tsx`; `NextUpdateCountdown` com contador regressivo via `useEffect`/`setInterval(500ms)`; rodapé com timestamp, `N PARTICIPANTES`, badge `██ AO VIVO` e `► LÍDER`/`■ VOCÊ`
- Sem novos endpoints Ruby/Sinatra; sem migrations de banco; feature usa exclusivamente tabelas existentes (`games`, `predictions`, `scores`, `profiles`, `group_members`)
- `npm run lint` e `npm run build` passam sem erros novos

## [animated-predictions-ranking] — Animação de Posição dos Palpites na Página Pública de Jogo — 2026-06-24

- `components/bolao/PublicParticipantsList.tsx` reescrito: ordenação reativa por pontuação efetiva e animação FLIP de reposicionamento de cards em tempo real via `useLayoutEffect` + CSS transitions (350ms ease-in-out)
- Função `sortParticipants` implementada fora do componente: `pending` (quem tem palpite primeiro, desempate por nome pt-BR), `live` (pontuação via `calculateLiveScore`, sem palpite = -1), `finished` (`p.points ?? -1`)
- `useMemo` para `sortedParticipants` recalcula automaticamente a cada mudança de `participants`, `gameStatus`, `liveHomeScore` ou `liveAwayScore`
- Técnica FLIP manual: `rowRefs` (Map userId→HTMLDivElement), `prevPositions` (Map userId→DOMRect), `capturePositions()` chamado antes de `setParticipants` no handler Realtime, `isFirstRender` guard suprime animação no primeiro render
- Estrutura HTML migrada de `<table>/<tr>/<td>` para `<div role="table">/<div role="row">/<div role="cell">` com `display: flex` para suportar `translateY` confiável em todos os browsers
- Roles ARIA preservados: `role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"`, `aria-label` no container
- Aparência visual inalterada: JetBrains Mono, paleta `--color-*`, paddings, bordas, cabeçalho "PALPITES DOS PARTICIPANTES", badge "AO VIVO", rodapé "* PONTUAÇÃO PROVISÓRIA"
- Sem alterações de backend, banco ou endpoints
- `npm run lint` e `npm run build` sem erros novos

## [public-game-view-group-fix] — Correção: Contexto de Grupo na Página Pública de Jogo — 2026-06-24

- `app/jogos/[gameId]/publico/page.tsx` atualizado: adicionada prop `searchParams: Promise<{ grupo?: string }>`; guard de erro inline quando `?grupo=` está ausente (sem `notFound()`, sem redirect) exibindo mensagem "PARÂMETRO DE GRUPO AUSENTE" em `color-error`; queries de `profiles`, `predictions` e `scores` substituídas por versões filtradas por `group_id` do grupo informado na URL; `groupId` passado como prop para `PublicGameClient`
- `components/bolao/PublicGameClient.tsx` atualizado: prop `groupId: string` adicionada à interface e repassada para `PublicParticipantsList`
- `components/bolao/PublicParticipantsList.tsx` atualizado: prop `groupId: string` adicionada; nome do canal Realtime alterado de `public-scores-${gameId}` para `public-scores-${gameId}-${groupId}` para evitar colisões entre abas de grupos diferentes; `groupId` adicionado ao array de dependências do `useEffect`
- `components/games/GameCard.tsx` corrigido: `handleCopyLink` passa a gerar `${origin}/jogos/${gameId}/publico?grupo=${groupId}` em vez de URL sem o query param
- Sem migrations: `group_id` já existe em `predictions` e `scores`; `group_members` já existe com `group_id` + `user_id`

## [public-game-view] — Página Pública de Jogo — 2026-06-24

- `app/jogos/[gameId]/publico/page.tsx` criado: Server Component público (fora do route group `(dashboard)`) com `generateMetadata` para SEO, `revalidate = 0`, busca de dados via `createServiceClient()` (service_role), regra de visibilidade de palpites por status (`pending`/`live`/`finished`), `notFound()` para gameId inexistente, header público minimalista (sem TabBar, sem SidePanelContainer)
- `components/bolao/PublicGameClient.tsx` criado: Client Component pai que encapsula `useGameRealtime` e distribui `liveGame` como prop para `PublicScoreCard` e `PublicParticipantsList`, evitando múltiplas subscriptions ao mesmo canal
- `components/bolao/PublicScoreCard.tsx` criado: exibe placar com bandeiras, badge de status (■ AO VIVO / □ ENCERRADO / PENDENTE), rodada, data/horário BRT e venue; recebe `liveGame` via prop do pai
- `components/bolao/PublicParticipantsList.tsx` criado: tabela PARTICIPANTE | PALPITE | PTS(★) com lógica OCULTO/PENDENTE para jogos `pending`; pontuação provisória via `calculateLiveScore()` para `live`; Realtime de scores via canal `public-scores-${gameId}` para `finished`; sem accordion de breakdown, sem destaque de usuário atual
- `components/games/GameCard.tsx` modificado: botão utilitário `⎘ COPIAR LINK` abaixo das CTAs principais; copia `${origin}/jogos/${gameId}/publico` para o clipboard; feedback visual `✓ COPIADO!` em `color-win` por 2 segundos
- `supabase/migrations/20260624000010_public_read_games_scores.sql` criada: adiciona políticas RLS de leitura para role `anon` nas tabelas `games` e `scores`, permitindo que o Supabase Realtime funcione na página pública (clientes sem sessão)

## [change-password] — Alteração Direta de Senha — 2026-06-23

- Fluxo de recuperação de senha por email (`password-recovery`) removido inteiramente
- `components/bolao/ChangePasswordForm.tsx` criado: Client Component com estados `idle | loading | sucesso | error`, validação client-side (mínimo 6 chars + coincidência), chamada a `supabase.auth.updateUser({ password })`, mapeamento de erros Supabase para português, feedback de sucesso em `color-win` e erro em `color-error`
- `app/(dashboard)/configuracoes/page.tsx` atualizado: seção "ALTERAR SENHA" adicionada abaixo de INTEGRAÇÕES, separada por `borderTop: 1px solid var(--color-border)`
- `app/(auth)/login/client.tsx` atualizado: link "Esqueceu a senha? RECUPERAR ACESSO" removido; link de cadastro preservado
- Arquivos removidos: `app/(auth)/esqueci-senha/page.tsx`, `app/(auth)/esqueci-senha/client.tsx`, `app/(auth)/nova-senha/page.tsx`, `app/(auth)/nova-senha/client.tsx`, `app/auth/callback/route.ts`
- `app/api/mcp/oauth/callback/route.ts` preservado (callback OAuth do MCP, não relacionado)
- Sem migrations SQL — operação usa exclusivamente `auth.users` via Supabase Auth SDK

## [menu-redesign] — Redesign da Navegação (Header + Tab Bar + Pull Tabs) — 2026-06-22

- `components/bolao/TabBar.tsx` criado: tab bar fixa no rodapé com 4 itens (CAMPANHA, JOGOS, RANKING, MAIS), fonte 13px JetBrains Mono uppercase, altura 52px + `env(safe-area-inset-bottom)`, item ativo com `borderTop: 2px solid var(--color-primary)`, popover MAIS abre para cima com GRUPOS/REGRAS/CONFIG
- `components/bolao/SidePanelContainer.tsx` criado: orquestrador dos pull tabs laterais (ONTEM, AO VIVO, CHAT) e do painel deslizante; animação `translateX` 250ms ease-out/in; abertura automática do recap via localStorage; lazy-mount do chat; badge de não-lidas no pull tab CHAT
- `components/bolao/RecapPanelContent.tsx` criado: conteúdo do painel ONTEM extraído do `RecapBottomSheet`, sem wrapper `position: fixed`
- `components/bolao/LiveTodayPanelContent.tsx` criado: conteúdo do painel AO VIVO extraído do `LiveTodayBottomSheet`, sem wrapper posicionado
- `components/bolao/ChatPanelContent.tsx` criado: conteúdo do chat extraído do `GroupChatWidget`; mantém subscription Realtime, `unreadCount` exposto via callback, scroll automático ao abrir
- `app/(dashboard)/layout.tsx` refatorado: header de uma linha (44px + safe-area-inset-top), remoção de `NavLinks`/`GroupChatWidget`/`RecapController`, `paddingBottom` do `<main>` fixo em `calc(52px + env(safe-area-inset-bottom) + 1.5rem)`
- `app/(dashboard)/group-switcher.tsx`: `fontSize` do objeto `MONO` alterado de 11px para 13px
- `DualFooterBar`, `RecapController` e chip flutuante do `GroupChatWidget` removidos do DOM (arquivos mantidos no repositório)

## [next-game-navigation] — Navegação para o Próximo Jogo na Análise — 2026-06-22

- Componente `NextGameLink` criado em `components/bolao/NextGameLink.tsx`: Client Component com `<Link>` para `/jogos/[nextGameId]/analise`, texto `PRÓXIMO JOGO ►`, JetBrains Mono 12px bold uppercase, cor `var(--color-primary)`, sem sublinhado, sem borda, sem background
- `AnalisePage` (`app/(dashboard)/jogos/[gameId]/analise/page.tsx`): query de próximo jogo adicionada ao `Promise.all` existente via `.from('games').select('id').gt('match_date', ...).order('match_date', { ascending: true }).limit(1).maybeSingle()`
- Seção "Botão de voltar" substituída por faixa de navegação flex com `justify-content: space-between`: `BackButton` à esquerda e `NextGameLink` à direita (omitido quando não há próximo jogo)
- Nenhuma alteração de backend, banco de dados, migrations ou endpoints

## [game-detail-navigation] — Navegação para Detalhe do Jogo — 2026-06-22

- `components/bolao/BackButton.tsx`: label padrão alterado de `← VOLTAR AO PALPITE` para `← VOLTAR`; comportamento de `router.back()` / `router.push(fallbackHref)` inalterado
- `components/bolao/perfil/HistoryPanel.tsx`: cada item do feed HISTÓRICO convertido de `<div>` para `<Link href={/jogos/${item.game_id}/analise}>`, tornando jogos encerrados clicáveis na aba Campanha do perfil
- `app/(dashboard)/meus-palpites/page.tsx`: coluna JOGO de cada linha envolvida com `<Link href={/jogos/${game.id}/analise}>` com `display: block`; adicionado indicador `► VER ANÁLISE` em `color-primary` abaixo dos metadados
- Nenhuma alteração de backend, banco de dados ou endpoints
- Feature puramente de navegação: reutiliza a rota `/jogos/[gameId]/analise` já existente

## [trofeus-negativos] — Troféus Negativos e Anti-Platina — 2026-06-21

- 9 troféus negativos adicionados: `placar_espelhado`, `ultima_hora`, `trono_de_papel`, `quase`, `solitario_do_erro`, `dia_ruim`, `naufragando`, `a_deriva`, `sem_volta`
- Endpoint `GET /api/profile/trophies` passa a retornar `{ trophies, negativeTrophies }` — resposta aditiva, sem quebra de compatibilidade
- Nova função `calcNegativeTrophies(sc, groupId, userId, streakHistory)` em `app/api/profile/trophies/route.ts`
- `streakHistory` extraído para o handler `GET` e compartilhado com `calcTrophies` e `calcNegativeTrophies` via `Promise.all` — elimina query duplicada
- Helpers de sequência negativa: `calcBestNegativeStreak`, `findNegativeStreakUnlockDate`, `findNegativeStreakContributingGames`
- Três troféus progressivos (`naufragando`/`a_deriva`/`sem_volta`) com `progress`/`progress_max` (thresholds 3, 5 e 8 erros consecutivos)
- `TrophiesPanel.tsx`: interface `TrophiesData` expandida com `negativeTrophies: Trophy[]`
- Header do painel atualizado para `TROFÉUS N/15 · VERGONHA N/9`
- Seção "CONQUISTAS IMPROVÁVEIS" renderizada abaixo dos troféus positivos com divisor e header em `color-error`
- Card "COLECIONADOR DO CAOS" (Anti-Platina) exibido no topo da seção negativa somente quando todos os 9 negativos estão desbloqueados; borda `color-error` e fundo levemente tingido
- Troféus negativos desbloqueados: prefixo `✗`, nome em `color-error`; bloqueados: prefixo `○`, cor `color-muted`
- `ContributingGameLine` nos negativos sempre com `unlocked={false}` (borda `color-border`, texto `color-muted`)
- Barra de progresso nos progressivos via `renderBar` em cor `color-muted`
- Backward compat: `negativeTrophies ?? []` protege contra cache antigo sem o campo
- Nenhuma migração de banco — todos os troféus calculados a partir de tabelas existentes
- `npm run lint` e `npm run build` passam sem erros novos introduzidos pela feature

## [trophy-contributing-games] — Confrontos Contribuintes por Troféu — 2026-06-21

- Adiciona campo `contributing_games: ContributingGame[]` à resposta do endpoint `GET /api/profile/trophies`, presente em todos os 15 troféus
- Nova interface `ContributingGame` com `game_id`, `home_team_code`, `away_team_code`, `home_score`, `away_score`
- Nova função auxiliar `extractContributingGame` omite silenciosamente jogos sem placar finalizado (`home_score/away_score null`)
- Nova função `findStreakContributingGames(threshold)` retorna a janela exata de N jogos consecutivos que atingiu o limiar de sequência (`embalado`, `em_chamas`, `imparavel`)
- Queries de `abriu_o_placar`, `cravada`, `rei_da_goleada`, `profeta`, `vidente`, `artilheiro` e `streakHistory` atualizadas com join `games(home_team_code, away_team_code, home_score, away_score)`
- Query de `estreia` ampliada com `game_id` e join em `games`; `videnteRes` sem `.limit(25)` para buscar todos os acertos
- Troféus `perfeito_na_rodada` e `fiel`: query adicional após encontrar o dia contribuinte para buscar detalhes dos jogos
- Troféus `cartola` e `podio` sempre retornam `contributing_games: []` (baseados em snapshots de posição, sem jogo associável)
- `TrophiesPanel.tsx`: novo componente interno `ContributingGameLine` renderiza `[Flag] [COD] [Score] × [Score] [COD] [Flag]` em 11px/JetBrains Mono; cor `color-win` para desbloqueados, `color-muted` para locked; seção omitida silenciosamente quando lista vazia
- `npm run lint` e `npm run build` passam sem erros novos introduzidos pela feature

## [fix-perfil-stats-trophies] — Correção: Estatísticas e Troféus na Aba de Perfil — 2026-06-21

- Corrige denominador das taxas de acerto: `winner_rate`, `exact_rate` e `avg_points` passam a dividir por `active_predictions_made` (palpites em jogos `finished` ou `live`), excluindo jogos `pending` cujo resultado é desconhecido
- Migration `20260622000005_fix_profile_stats_active_denominator.sql` recria `get_profile_stats` via `CREATE OR REPLACE` adicionando campo `active_predictions_made bigint` à assinatura de retorno; campo `predictions_made` mantido como métrica de engajamento
- `GET /api/profile/performance` e `GET /api/profile/stats` extraem `active_predictions_made` do RPC e usam no cálculo das três taxas; ambos incluem o novo campo no JSON de resposta
- `PerformanceData` recebe campo `active_predictions_made: number`; `PerformancePanel` usa o novo campo em `hasData` e nas frações `(winner_correct/active_predictions_made)` e `(exact_correct/active_predictions_made)`
- `TrophiesPanel` refatorado: removidos `expandedId`, `toggle`, `TrophyRow`, `TROPHY_HINTS`, separação em três listas e grid de 2 colunas; substituídos por grid vertical único (`1fr`) com todos os troféus na ordem da API
- Troféus `secret` tratados como `locked`: exibem nome e descrição reais sem ocultação; `cursor: default` em todos os itens (não clicáveis)
- Descrição de cada troféu (`TROPHY_CRITERIA[trophy.id]`) sempre visível sem clique; desbloqueados exibem ✓ em `color-win` + data de desbloqueio alinhada à direita; não-desbloqueados exibem ✗ em `color-muted` + barra de progresso quando disponível
- `npm run lint` e `npm run build` passam sem erros novos introduzidos pela feature

## [perfil-redesign] — Redesign da Aba de Perfil — 2026-06-21

- Substitui a página `/perfil` (6 estatísticas secas) por um painel rico com 4 seções empilhadas: SUA CAMPANHA, DESEMPENHO, TROFÉUS, HISTÓRICO
- Cada seção tem estado de loading/error independente — falha em uma seção não bloqueia as outras
- **Migrations criadas:**
  - `20260622000001_create_position_snapshots.sql` — tabela `position_snapshots` com RLS (leitura para membros do grupo) e índice por grupo/usuário/data
  - `20260622000002_create_snapshot_functions.sql` — função `record_position_snapshots` idempotente (ON CONFLICT DO NOTHING) + trigger `trg_snapshot_on_day_close` que grava snapshot ao fechar o último jogo do dia
  - `20260622000003_create_group_avg_points.sql` — função `get_group_avg_points` retornando média de pontos por palpite do grupo
  - `20260622000004_create_profile_history.sql` — função `get_profile_history` com feed paginado de jogos encerrados incluindo `is_miss = true` para jogos sem palpite
- **Endpoints criados (Next.js Route Handlers com Bearer JWT):**
  - `GET /api/profile/campaign` — posição, pontos, distância para líder/próximo, movimento de posição (▲▼=)
  - `GET /api/profile/performance` — taxas de acerto com barras ASCII, média vs. grupo, sequência atual e melhor
  - `GET /api/profile/trophies` — 15 troféus calculados com 3 estados (unlocked/locked/secret), ordenados por status e data
  - `GET /api/profile/history` — feed paginado (limit/offset) com palpite, pontos e badge de troféu por jogo
- **Componentes criados:**
  - `components/bolao/perfil/CampaignPanel.tsx` — posição e pontos em destaque (2.5rem), variante líder com "+N SOBRE O 2º", label de movimento colorido
  - `components/bolao/perfil/PerformancePanel.tsx` — barras ASCII `███░░░`, comparação ▲▼= com média do grupo, pílulas `●●●●○` para sequência
  - `components/bolao/perfil/TrophiesPanel.tsx` — grid 2 colunas para desbloqueados, lista com barra de progresso para locked, `🔒 ???` para secretos; accordion inline sem modal
  - `components/bolao/perfil/HistoryPanel.tsx` — agrupamento por dia com `▼ DD MMM`, marcação `-- FUROU --`, badge de troféu inline, botão "VER MAIS" com paginação offset
  - `components/bolao/perfil/PerfilDashboard.tsx` — orquestrador com fetch paralelo das 4 seções e `handleLoadMore` com concatenação de itens
- `app/(dashboard)/perfil/page.tsx` — atualizado para usar `PerfilDashboard` em vez de `ProfileStats`
- `ProfileStats.tsx` e `/api/profile/stats` mantidos deprecados (não removidos)

## [perfil-com-estatisticas] — Perfil com Estatísticas — 2026-06-21

- Cria a página `/perfil` (rota protegida no dashboard) com estatísticas pessoais do usuário no grupo ativo
- `supabase/migrations/20260621400000_create_profile_stats_function.sql` — função `get_profile_stats(p_group_id uuid, p_user_id uuid)` com `SECURITY DEFINER STABLE`; retorna 6 métricas (`predictions_made`, `finished_games`, `winner_correct`, `exact_correct`, `total_points`, `best_streak`); lógica de `best_streak` via gaps-and-islands com dois `ROW_NUMBER()`
- `app/api/profile/stats/route.ts` — endpoint `GET /api/profile/stats`: autenticação Bearer JWT, resolução tripla de `group_id` (query param → cookie → fallback `joined_at ASC`), verificação de membership, `Promise.all` para `get_profile_stats` + `get_streak_for_group` + `profiles` + `groups`; retorna 401/403/404/500 nos casos corretos; `user_id` sempre extraído do JWT
- `app/(dashboard)/perfil/page.tsx` — Server Component com proteção de rota, `resolveActiveGroup()`, mensagem de erro em `color-error` se sem grupo
- `components/bolao/ProfileStats.tsx` — Client Component com estados `loading | error | populated`; layout estilo terminal Elifoot (JetBrains Mono, `border-radius: 0`, `box-shadow: none`); percentuais em `color-win` >= 50% / `color-muted` < 50%; exibe `—` quando sem palpites; mobile-first com `flexWrap: 'wrap'`
- `app/(dashboard)/nav-links.tsx` — item `{ href: '/perfil', label: 'PERFIL' }` adicionado como 7º item da navegação

## [streak-de-acertos] — Sequência de Acertos — 2026-06-21

- Exibe no ranking a sequência atual de acertos consecutivos de cada participante como indicador `🔥×N` inline na célula PARTICIPANTE (visível apenas quando streak > 0)
- `supabase/migrations/20260621300000_create_streak_function.sql` — função `get_streak_for_group(p_group_id uuid)` via `CREATE OR REPLACE SECURITY DEFINER STABLE`; usa `ROW_NUMBER() OVER (ORDER BY match_date DESC)`, CROSS JOIN membros × jogos encerrados e cálculo de `first_miss` para derivar o streak sem nova tabela
- `app/api/ranking/route.ts` — modo GERAL chama `get_streak_for_group` em paralelo via `Promise.all`; erro não-bloqueante (streak fallback = 0); campo `streak: number` em cada entrada; modo por rodada retorna `streak: 0` sem nova RPC
- `lib/types/ranking.ts` — campo `streak: number` adicionado à interface `RankingEntry`
- `components/bolao/RankingRow.tsx` — renderiza `🔥×N` em `color-win` com tooltip nativo após o nome, antes de `(VOCÊ)` e dos scout badges; invisível quando `streak = 0`
- `components/bolao/RankingTable.tsx` — legenda `🔥 SEQUÊNCIA DE ACERTOS` adicionada no rodapé (modo GERAL apenas)

## [ranking-por-rodada] — Ranking por Rodada — 2026-06-21

- Adiciona filtro de fase na tela `/ranking`: faixa de chips acima da tabela com "GERAL" padrão e chips por fase (Grupos A–L, Oitavas, Quartas, Semi, Final)
- `supabase/migrations/20260621200000_ranking_by_round.sql` — funções `get_ranking_by_round(uuid, text)` e `get_available_rounds(uuid)`; predicado `AND (s.game_id IS NULL OR g.round = p_round)` garante que membros com 0 pontos na fase apareçam
- `app/api/ranking/rounds/route.ts` — novo endpoint `GET /api/ranking/rounds?group_id=`; JWT + membership; retorna `{ rounds: string[] }` via RPC `get_available_rounds`
- `app/api/ranking/route.ts` — suporte a query param `round`; modo por rodada chama `get_ranking_by_round`, omite scouts e `predictions_count`; modo GERAL preservado intacto
- `components/bolao/RoundChips.tsx` — novo componente; chip "GERAL" fixo + chips de fase; ordenação lógica da Copa; scroll horizontal sem barra visível; estilo Elifoot (borderRadius 0, monospace 11px uppercase)
- `lib/hooks/useRoundRanking.ts` — novo hook; modo GERAL delega ao `useRankingRealtime` (Realtime ativo); modo por rodada faz fetch estático sem Realtime; guard `__noop__` impede fetch desnecessário no mount
- `components/bolao/RankingTable.tsx` — integra `RoundChips` acima da tabela; subtítulo "FASE: X" no modo por rodada; oculta coluna PALP. e scouts no modo por rodada; ignora live points no modo por rodada
- `components/bolao/RankingRow.tsx` — props `hideScouts?` e `hidePalpites?` para controle contextual

## [ranking-scouts] — Scouts no Ranking — 2026-06-21

- Exibe badges de "scout" ao lado do nome de cada participante no ranking, identificando perfis de comportamento no bolão (mãe diná, manja muito, cego em tiroteio, sumido, onde está wally?)
- `supabase/migrations/20260621100000_create_ranking_scouts_function.sql` — função `get_ranking_scouts(p_group_id uuid)` via `CREATE OR REPLACE SECURITY DEFINER STABLE`; retorna por participante `exact_count`, `winner_count`, `miss_count`, `pred_active`, `pred_total` cruzando `group_members`, `profiles`, `scores`, `predictions` e `games`
- `app/api/ranking/route.ts` — executa `get_ranking` e `get_ranking_scouts` em paralelo via `Promise.all`; calcula badges server-side com thresholds máx/mín, exclusão mútua wally/sumido e `minActive > 0`; adiciona campo `scouts: string[]` em cada entrada do JSON de resposta
- `lib/types/ranking.ts` — campo `scouts: string[]` adicionado à interface `RankingEntry`
- `components/bolao/ScoutBadges.tsx` — novo componente; renderiza `<span title=...>emoji</span>` por scout com tooltip nativo; retorna `null` para arrays vazios; `display: inline-flex`, `flexShrink: 0`
- `components/bolao/RankingRow.tsx` — importa `ScoutBadges` e insere na célula PARTICIPANTE após nome e sufixo "(VOCÊ)"

## [ranking-predictions-count] — Total de Palpites no Ranking — 2026-06-21

- Exibe a contagem de palpites de cada participante na tabela de ranking, como indicador de engajamento complementar à pontuação
- `supabase/migrations/20260621000000_ranking_add_predictions_count.sql` — recria `get_ranking(p_group_id uuid)` via `CREATE OR REPLACE` adicionando `predictions_count bigint` via LEFT JOIN com subquery em `predictions`; tipos de retorno padronizados para `bigint`; critério de empate `ORDER BY total_points DESC, p.name ASC` preservado
- `app/api/ranking/route.ts` — `predictions_count` incluído no type annotation e no objeto de retorno JSON com `Number()` para serialização correta
- `lib/types/ranking.ts` — campo `predictions_count: number` adicionado à interface `RankingEntry`
- `components/bolao/RankingTable.tsx` — nova coluna `PALP.` no `<thead>` entre `PONTOS` e `APROVEIT.`; visível em mobile (sem `hidden md:table-cell`); `minWidth: 4.5rem`
- `components/bolao/RankingRow.tsx` — nova célula `predictions_count` com `color-muted`, `fontSize: 13px`, sem bold; inserida entre pontos e aproveitamento

## [calendar-utc-fix] — Corrigir Agrupamento de Jogos no Calendário para Usar UTC — 2026-06-20

- `lib/date.ts` — adicionada função `matchDateToUTCDate(isoUtcString: string): string` que extrai a data UTC de um timestamptz ISO 8601 via `new Date(isoUtcString).toISOString().slice(0, 10)`, sem conversão de fuso horário; `matchDateToLocalDate` preservada para uso por outras features
- `app/(dashboard)/jogos/page.tsx` — import atualizado para `matchDateToUTCDate`; geração de `availableDates` substituída de `matchDateToLocalDate` para `matchDateToUTCDate`, fazendo cada chip de data representar o dia UTC do `match_date`
- Corrige bug em que jogos com `match_date` UTC em um determinado dia apareciam em outro chip por conta da conversão para BRT (UTC-3)
- Sem alterações em `DateChipsNav`, `GameCard`, `dayBoundsInUTC` ou banco de dados

## [password-recovery] — Recuperação de Senha por Email — 2026-06-19

- `app/auth/callback/route.ts` (Route Handler GET público): recebe `code` PKCE da query string, chama `supabase.auth.exchangeCodeForSession(code)` via cliente server-side, redireciona para `next` (padrão `/jogos`) ou `/login?error=link-invalido` em caso de erro; parâmetro `next` validado para aceitar apenas caminhos internos (inicia com `/`)
- `app/(auth)/esqueci-senha/page.tsx` (Client Component): estados `idle | loading | enviado | error`; chama `resetPasswordForEmail` com `redirectTo` apontando para `/auth/callback?next=/nova-senha`; mensagem de confirmação não revela existência do e-mail ("Se este e-mail estiver cadastrado..."); borda do card muda para `color-error` no estado de erro
- `app/(auth)/nova-senha/page.tsx` (Client Component): estados `idle | loading | sucesso | error | sessao-invalida`; verificação de sessão no `useEffect` do mount; validações client-side (mínimo 6 caracteres, senhas coincidem); após sucesso exibe "✓ SENHA ATUALIZADA" e redireciona para `/jogos` em 2 segundos via `router.push`; estado `sessao-invalida` exibe erro com link para `/esqueci-senha`
- `app/(auth)/login/page.tsx` (modificado): link "Esqueceu a senha? RECUPERAR ACESSO" adicionado entre o botão de submit e o separador de cadastro, apontando para `/esqueci-senha`
- Sem migrations SQL, sem endpoints Ruby novos — fluxo 100% via Supabase Auth SDK client-side e Route Handler Next.js

## [group-member-history] — Palpites e Pontuação ao Adicionar Participante a Grupo — 2026-06-19

- `supabase/migrations/20260619000001_copy_predictions_on_join.sql` (espelhada em `db/migrations/20260619_copy_predictions_on_join.sql`) — migration com três partes:
  1. Função `copy_predictions_to_group(p_user_id uuid, p_group_id uuid)` (`SECURITY DEFINER`, `LANGUAGE plpgsql`) — copia palpites mais recentes do usuário de qualquer outro grupo para `p_group_id` via `DISTINCT ON (game_id) ORDER BY game_id, submitted_at DESC`; usa `ON CONFLICT (user_id, game_id, group_id) DO NOTHING` para idempotência; cada INSERT protegido por sub-bloco `BEGIN/EXCEPTION` com `RAISE WARNING` para não bloquear a entrada no grupo; após a cópia, chama `calculate_scores_for_game(g.id)` para cada jogo `finished` com prediction copiada; variável de cursor declarada como `RECORD` (correção do fix-1 — `%ROWTYPE` com SELECT parcial fazia mapeamento por posição, corrompendo os valores)
  2. Função trigger `trigger_copy_predictions_on_join()` — chama `copy_predictions_to_group(NEW.user_id, NEW.group_id)` e retorna `NEW`
  3. Trigger `on_group_member_inserted` — `AFTER INSERT ON group_members FOR EACH ROW`, precedido de `DROP TRIGGER IF EXISTS` para idempotência
- Nenhuma alteração em endpoints backend (`POST /api/groups/join` e `POST /api/invites/[id]/accept`) — o trigger Postgres cobre ambos os pontos de entrada automaticamente
- Nenhuma alteração no frontend — dados replicados aparecem em ranking, jogos e meus-palpites via filtros por `group_id` já existentes

## [live-today-games] — Jogos do Dia no Bottom Sheet "Tá Rolando" — 2026-06-19

- `lib/hooks/useLiveTodayRanking.ts`: interface `LiveTodayGame` exportada com 9 campos (`id`, `home_team`, `away_team`, `home_team_code`, `away_team_code`, `home_score`, `away_score`, `status`, `match_date`); SELECT de jogos ampliado com os 5 campos faltantes; estado `games: LiveTodayGame[]` adicionado; `setGames([])` chamado no branch sem jogos; retorno do hook atualizado para incluir `games`
- `components/bolao/LiveTodayBottomSheet.tsx`: importa `LiveTodayGame` e `getTeamFlag`; prop `games: LiveTodayGame[]` adicionada à interface e desestruturação; sub-componente `LiveTodayGameCard` criado inline com layout horizontal time casa | placar | time visitante; badge `● AO VIVO` em `color-live` com `animation: blink 1s step-end infinite`; badge `✓ ENCERRADO` em `color-muted` sem animação; placar `— × —` (U+2014) para `pending`; keyframes `blink` injetados via `<style>` tag; seção "JOGOS DE HOJE" com separador inserida antes do ranking
- `components/bolao/RecapController.tsx`: desestrutura `games: liveTodayGames` do hook; passa `games={liveTodayGames}` ao `LiveTodayBottomSheet`
- Nenhuma migration de banco, nenhum endpoint novo, nenhum canal Realtime novo — feature 100% client-side usando tabelas existentes

## [dual-footer-bar] — Barra Dupla no Rodapé (Rolou ontem / Tá rolando) — 2026-06-19

- `RecapFooterButton.tsx` deletado; nenhum import restante no repositório
- `components/bolao/DualFooterBar.tsx` criado: dois botões lado a lado (`flex: 1`) — "ROLOU ONTEM" (ponto amarelo, `color-accent`) e "TÁ ROLANDO" (ponto vermelho, `color-live`); quando apenas um tem conteúdo ocupa 100%; quando nenhum tem conteúdo retorna `null`; hover individual por botão com fundo `#007a2e`; divisor `1px solid color-border` quando ambos visíveis; safe-area iOS; `zIndex: 50`
- `lib/hooks/useLiveTodayRanking.ts` criado: busca jogos de hoje em BRT, calcula pontos oficiais (tabela `scores`, jogos `finished`) e pontos parciais (client-side via `calculateLiveScore`, jogos `live`), aplica RANK() com empates, assina canais Realtime `live-today-games-${groupId}` (UPDATE em `games`) e `live-today-scores-${groupId}` (evento `*` em `scores` com filtro `group_id`), debounce 1000ms; retorna `{ entries, loading, hasGamesToday }`
- `components/bolao/LiveTodayBottomSheet.tsx` criado: bottom sheet animado (`slideUp`/`slideDown`) com ranking ao vivo do dia; cabeçalho verde/amarelo; tabela `#` | `PARTICIPANTE` | `PTS`; líder em `color-accent` bold com `►`; usuário atual em `color-primary`; pontos parciais em `color-live` com sufixo `*`; legenda `* PARCIAL — AO VIVO`; estados: loading, sem palpites, sem pontuação; backdrop semitransparente, trava de scroll, safe-area iOS; `zIndex: 201`
- `components/bolao/RecapController.tsx` modificado: importa `DualFooterBar` e `LiveTodayBottomSheet`; adiciona estado `liveTodayOpen`; instancia `useLiveTodayRanking(groupId)` para `hasGamesToday`; atualiza `useEffect` de `--recap-footer-h` para `barVisible = (hasData && !loading) || hasGamesToday`
- Nenhuma migration de banco necessária — feature 100% client-side usando tabelas existentes `games`, `predictions`, `scores`, `group_members`

## [mcp-scoring-rules] — Tool MCP: Consultar Regras de Pontuação — 2026-06-19

- `lib/mcp/tools/scoring-rules.ts` criado com `registerScoringRulesTools(server: McpServer): void` registrando a tool `consultar_regras_pontuacao`
- Schema Zod de entrada vazio `{}` — tool sem parâmetros
- Retorna texto hardcoded com os 6 eventos de pontuação, pontuação máxima (9 pts), regras de cumulatividade, tratamento de empate e 5 exemplos concretos de cálculo
- `lib/mcp/server.ts` atualizado com import e chamada `registerScoringRulesTools(server)` sem `userId` (tool stateless, sem acesso ao Supabase)
- Nenhum endpoint novo, nenhum componente React, nenhuma migration de banco

## [recap-game-cards] — Cards Visuais de Jogos no Recap — 2026-06-19

- `components/bolao/RecapBottomSheet.tsx`: seção "JOGOS DE ONTEM" migrada de linhas de texto simples (`home_team_code × away_team_code`) para cards visuais compactos com layout grid `1fr auto 1fr`
- Sub-componente interno `RecapGameCard` definido no mesmo arquivo (sem arquivo separado, conforme spec)
- Coluna esquerda: bandeira emoji via `getTeamFlag(home_team_code)` (22px) acima do código do time (11px, `color-muted`, uppercase)
- Coluna central: placar `home_score × away_score` em `color-accent`, bold, 18px, centralizado
- Coluna direita: bandeira + código do time visitante, mesmos estilos da esquerda
- Card com `border: 1px solid var(--color-border)`, `backgroundColor: var(--color-bg)`, sem `borderRadius`, sem `boxShadow`
- Import de `getTeamFlag` e tipo `RecapGame` adicionados; dead code (`gameRow`, `gameScore`) removido do objeto `S`
- Feature 100% frontend — sem novos endpoints, sem migrations, sem alterações em `useDailyRecap.ts`

## [recap-cache-visual] — Cache LocalStorage e Visual Aprimorado do Recap — 2026-06-19

- `lib/hooks/useDailyRecap.ts`: adicionada função `getRecapCacheKey()` gerando chave `bolao_recap_data_YYYY-MM-DD` em BRT; lógica de cache hit (exibição instantânea + background sync silencioso) e cache miss (fetch normal com loading); cache salvo apenas quando `games.length > 0`; assinatura pública `{ data, loading, hasData }` preservada
- `components/bolao/RecapFooterButton.tsx`: container com `backgroundColor: var(--color-primary)` (verde), `borderTop: 2px solid var(--color-accent)` (amarelo); texto `color: var(--color-bg)` (preto, alto contraste); ponto animado 7×7px amarelo com `animation: blink 1s step-end infinite` antes do texto; hover aplicado no container via `useState` alterando para `#007a2e`
- `components/bolao/RecapBottomSheet.tsx`: handle de arrasto renderiza antes do cabeçalho colorido; faixa verde com título `color-accent` 15px bold e `OPENING_MSG` como subtítulo integrado; `<p>` de abertura removido do corpo; `RANKING DO DIA` e `DESTAQUES` em `color-text`; `JOGOS DE ONTEM` mantido em `color-muted`; `<th>` com `borderBottom`; linha líder com fundo amarelo `rgba(255,223,0,0.08)` e pontos 15px bold accent; linha usuário atual (não líder) com fundo verde `rgba(0,156,59,0.08)`; quando usuário atual é líder, amarelo prevalece (`isLeader` verificado antes de `isCurrentUser`); badges com `borderLeft: 2px solid var(--color-primary)`, `badgeRecipient` 15px bold accent
- `app/globals.css`: keyframe `@keyframes blink` adicionado (`0%/100% opacity:1`, `50% opacity:0`, `step-end`)
- Feature 100% frontend — sem novos endpoints, sem migrations, sem alterações de schema

## [recap-bottom-sheet] — Botão Fixo no Rodapé com Bottom Sheet de Resumo — 2026-06-19

- `RecapFloatingButton.tsx` removido; `DailyRecapModal.tsx` removido — substituídos integralmente pelos novos componentes
- Novo `components/bolao/RecapFooterButton.tsx`: botão fixo full-width no rodapé (`position: fixed; bottom: 0; zIndex: 50`), visível apenas quando `hasData === true && !loading`, com safe-area iOS via `env(safe-area-inset-bottom)`, hover altera cor para `color-accent`
- Novo `components/bolao/RecapBottomSheet.tsx`: bottom sheet com animação slide-up (abertura 300ms ease-out) e slide-down (fechamento 300ms ease-in) via keyframes em `globals.css`; exibe JOGOS DE ONTEM, RANKING DO DIA e DESTAQUES (Craque do Dia, Mãe Diná, Pé-frio); fecha via backdrop, botão "✕" ou botão "FECHAR"; trava `overflow: hidden` no body; safe-area iOS no padding-bottom
- `components/bolao/RecapController.tsx` atualizado: usa `RecapFooterButton` + `RecapBottomSheet`; lógica de abertura automática (localStorage `bolao_recap_YYYY-MM-DD` em BRT) migrada do `DailyRecapModal` para cá; `data` obtido do hook e passado como prop (sem double-fetch)
- `components/bolao/GroupChatWidget.tsx`: chip minimizado elevado de `zIndex: 50` para `zIndex: 51` para garantir visibilidade acima do botão do rodapé
- `app/(dashboard)/layout.tsx`: `padding-bottom: calc(4rem + env(safe-area-inset-bottom))` condicional ao `<main>` quando `activeGroup` existe, evitando que conteúdo fique coberto pelo botão fixo
- `app/globals.css`: keyframes `@keyframes slideUp` e `@keyframes slideDown` adicionados
- Feature 100% frontend — sem novos endpoints, sem migrations

## [daily-recap-modal-refactor] — Refatoração do Daily Recap Modal — 2026-06-19

- `RecapButton` removido da barra de navegação (`nav-links.tsx`); props `groupId` e `currentUserId` removidas da interface `NavLinksProps`
- Novo componente `components/bolao/RecapFloatingButton.tsx`: chip fixo em `position: fixed`, `bottom: 1.5rem`, `left: 1.5rem`, retorna `null` quando `loading || !hasData`, abre o modal via callback `onOpen`
- Novo componente `components/bolao/RecapController.tsx`: gerencia estado `forceOpen`, eleva `useDailyRecap(groupId)` (evitando double-fetch), renderiza `RecapFloatingButton` + `DailyRecapModal` em instância única
- `app/(dashboard)/layout.tsx` substitui `<DailyRecapModal>` direto por `<RecapController groupId currentUserId>`; dupla instância do modal eliminada
- `lib/hooks/useDailyRecap.ts`: `calcBadges` refatorada de 5 para 3 badges — **Craque do Dia**, **Mãe Diná** (fusão de Vidente + artilharia de palpites) e **Pé-frio**; badges Artilheiro e Apostador removidos
- Badge Mãe Diná: critério primário é acertos de placar exato; critério secundário é maior soma de gols apostados (`home_score + away_score`); fallback para artilharia quando ninguém acerta o placar
- Tipo `RecapBadge` recebeu campo opcional `secondaryDescription?: string`; `DailyRecapModal` renderiza dois `<div>` separados para o badge `mae_dina`
- Query de `predictions` expandida para incluir `home_score, away_score`; tipo `RawPrediction` atualizado
- Feature 100% frontend — sem novos endpoints, sem migrations

## [daily-recap-on-demand] — Resumo Diário sob Demanda — 2026-06-19

- Botão `RESUMO DE ONTEM` adicionado à barra de navegação do dashboard via novo componente `components/bolao/RecapButton.tsx`
- Botão aparece somente quando `useDailyRecap.hasData === true` (há jogos finalizados no dia anterior); renderiza `null` durante loading e quando sem dados
- Clicar no botão abre `DailyRecapModal` com `forceOpen={true}`, ignorando o localStorage (sem gravar nem ler a chave `bolao_recap_<data>`)
- `DailyRecapModal` refatorado para aceitar props `forceOpen?: boolean` e `onClose?: () => void`; dois effects separados controlam abertura: Effect 1 (automático, via `decidedRef`) e Effect 2 (sob demanda, com guarda `if (isOpen) return` para evitar reabertura indevida)
- `app/(dashboard)/nav-links.tsx` estendido com props `groupId: string` e `currentUserId: string`; `overflowX: 'auto'` adicionado para compatibilidade mobile
- `app/(dashboard)/layout.tsx` passa `groupId={activeGroup?.id ?? ''}` e `currentUserId={user.id}` para `<NavLinks>`
- Comportamento automático do modal (primeiro acesso do dia) preservado inalterado
- Feature 100% frontend — sem novos endpoints, sem migrations

## [daily-recap-modal] — Modal de Resumo Diário — 2026-06-19

- Hook `lib/hooks/useDailyRecap.ts` criado: calcula "ontem em BRT" via `getBRTDayBounds()`, busca jogos finalizados do dia anterior, carrega scores e predictions em paralelo, agrega ranking do dia por usuário e calcula 5 badges (CRAQUE, VIDENTE, ARTILHEIRO, APOSTADOR, PÉ-FRIO)
- Componente `components/bolao/DailyRecapModal.tsx` criado: controla abertura única por dia via `localStorage` (chave `bolao_recap_<YYYY-MM-DD-BRT>`), exibe backdrop com fechamento por clique, seções de jogos, ranking do dia e destaques; design Elifoot com JetBrains Mono, paleta brasileira, sem border-radius/shadow
- `app/(dashboard)/layout.tsx` atualizado: `<DailyRecapModal>` adicionado ao final do JSX, condicional a `activeGroup` existir
- 100% client-side — sem novos endpoints Ruby, sem migrations; queries nas tabelas existentes `games`, `scores`, `profiles`, `predictions` escopadas por `group_id`

## [mcp-group-scope] — Suporte a Múltiplos Grupos no Servidor MCP — 2026-06-18

- Tool `listar_grupos` criada em `lib/mcp/tools/grupos.ts`: lista os grupos do usuário autenticado com id, nome (maiúsculas), papel (ADMIN/MEMBRO) e data de entrada, ordenados por `joined_at ASC`; inclui nota sobre grupo padrão
- `lib/mcp/auth.ts`: nova função exportada `validateGroupMembership(serviceClient, userId, groupId)` que verifica membership sem lançar exceção, retornando `{ valid, errorMessage }`
- `lib/mcp/tools/palpites.ts`: parâmetro `group_id` (UUID opcional) adicionado nas tools `meus_palpites` e `fazer_palpite`; quando informado valida membership via `validateGroupMembership`; quando omitido usa `resolveGroupForMcp` como fallback; verificação de membership redundante removida de `fazer_palpite`
- `lib/mcp/tools/ranking.ts`: parâmetro `group_id` (UUID opcional) adicionado na tool `ver_ranking` com mesma lógica de resolução de grupo
- `lib/mcp/server.ts`: import e registro de `registerGruposTools` adicionados em `createMcpServer`
- Nenhuma migration necessária — tabelas `group_members`, `groups`, `predictions` e `scores` já existiam com as colunas necessárias

## [mcp-bolao] — Servidor MCP Remoto do Bolão — 2026-06-18

- Servidor MCP remoto exposto em `POST /api/mcp` usando `WebStandardStreamableHTTPServerTransport` stateless, compatível com Claude Desktop, Claude.ai e clientes MCP que suportam o protocolo Streamable HTTP (2025-03-26)
- Autenticação OAuth 2.0 Authorization Code flow com PKCE: `GET /api/mcp/oauth/metadata` (RFC 8414), `POST /api/mcp/oauth/callback`, `POST /api/mcp/oauth/token` com update atômico one-time-use
- Página `/mcp/autorizar` (Client Component): formulário de login email/senha estilo Elifoot que redireciona de volta ao cliente MCP com código temporário após autenticação
- 6 tools MCP implementadas: `listar_jogos` (filtros data/status/rodada), `ver_jogo`, `ver_ranking` (grupo resolvido por `joined_at ASC`), `meus_palpites` (ordenado por `match_date` do jogo), `ver_palpites_jogo` (bloqueado em `pending`), `fazer_palpite` (upsert com deadline 5min)
- `lib/mcp/auth.ts`: `authenticateBearer` (JWT via anonClient), `resolveGroupForMcp` (primeiro grupo por `joined_at ASC`)
- Migration `supabase/migrations/20260618100000_create_mcp_oauth_codes.sql`: tabela `mcp_oauth_codes` com campos `code`, `user_id`, `redirect_uri`, `code_challenge`, `access_token`, `refresh_token`, `expires_at`, `used`; RLS habilitado sem policies públicas
- Componente `McpOnboarding.tsx`: URL readonly clicável com botão "COPIAR URL" e feedback "COPIADO ✓" por 2s; fallback `execCommand`
- Nova rota `/configuracoes` (Server Component) no grupo `(dashboard)`, protegida pelo layout; `serverUrl` calculado dinamicamente via header `host`
- Link "CONFIGURAÇÕES" adicionado à navegação do dashboard em `nav-links.tsx`
- Dependências adicionadas: `@modelcontextprotocol/sdk ^1.29.0`, `zod ^4.4.3`

## [fix-predict-edit-propagation] — Corrigir Propagação de Palpites no Modo de Edição — 2026-06-18

- Removida bifurcação `isEditMode` dentro do bloco `if (res.ok)` em `handleSubmit` de `PredictionForm.tsx`; agora, tanto criação quanto edição passam para `status = 'propagating'` após submit bem-sucedido
- O `PropagatePrompt` (já existente e agnóstico ao modo) é exibido após qualquer PATCH bem-sucedido no modo edição, oferecendo as opções "ESTE GRUPO" e "TODOS OS GRUPOS"
- Ao escolher "TODOS OS GRUPOS" em modo edição, `POST /api/predictions/broadcast` é chamado com os novos scores via UPSERT idempotente — grupos com deadline expirado são ignorados silenciosamente
- Ao escolher "ESTE GRUPO" em modo edição, o prompt fecha sem broadcast; `onSuccess` é chamado e o `GameCard` retorna ao estado de exibição do palpite atualizado
- Nenhuma alteração em backend, banco de dados, RLS policies, Supabase Realtime ou quaisquer outros componentes — correção cirúrgica de 9 linhas removidas e 2 adicionadas exclusivamente em `components/bolao/PredictionForm.tsx`

## [predict-all-groups] — Palpite para Todos os Grupos — 2026-06-18

- Novo endpoint `POST /api/predictions/broadcast` (Next.js Route Handler): propaga um palpite para todos os grupos do usuário simultaneamente, com UPSERT idempotente por grupo e verificação de deadline global (match_date - 5min)
- Validação de JWT via `auth.getUser()` (anon client); UPSERT via service_role client; autorização implícita via query em `group_members` (apenas grupos onde o usuário é membro recebem o palpite)
- Resposta com sumário: `{ updated_count: N, results: [{ group_id, group_name, status: 'saved' | 'deadline_expired' }] }`; grupos com prazo expirado ou jogo não-pending são ignorados silenciosamente sem bloquear os demais
- Erros tratados: 401 (sem token), 404 (jogo não encontrado), 422 (deadline_expired ou invalid_params), 500 (erro de banco)
- Novo componente `components/bolao/PropagatePrompt.tsx`: exibido após submit bem-sucedido no grupo ativo; oferece botões "ESTE GRUPO" e "TODOS OS GRUPOS"; estados internos `idle`/`loading`/`done`/`error` com auto-fechamento de 2s nos estados finais; design Elifoot com JetBrains Mono, tokens CSS do DESIGN.md, sem border-radius nem ícones SVG
- `components/bolao/PredictionForm.tsx` modificado: novo estado `propagating` no FormStatus; exibe PropagatePrompt no modo criação após submit bem-sucedido; modo edição preservado sem prompt (comportamento original intacto); props e interface externas inalteradas (regressão zero para GameCard)
- Sem migrations — modelo de dados existente já suportava a feature

## [group-chat] — Chat do Grupo — 2026-06-18

- Widget de chat flutuante (`GroupChatWidget`) adicionado ao layout do dashboard, visível em todas as páginas para usuários com grupo ativo
- Chip minimizado no canto inferior direito exibe badge de não lidas (contador baseado em `localStorage`); some ao abrir o painel
- Painel expandido com área de mensagens rolável, header com nome do grupo e botão `[X]`; animações CSS de abertura (250ms ease-out) e fechamento (200ms ease-in com estado `isClosing`)
- Mensagens carregadas na primeira abertura (últimas 100 via Supabase); novas mensagens chegam em tempo real via Supabase Realtime (canal `group-chat-${activeGroupId}`, evento `INSERT`, ativo desde a montagem)
- Envio por `Enter` ou botão `ENVIAR`; `Shift+Enter` insere quebra de linha; limite de 500 caracteres validado no frontend e no banco
- Nome do próprio usuário em `color-primary`; outros em `color-accent`; JetBrains Mono em todos os elementos; sem border-radius nem ícones decorativos
- **Migration criada:** `supabase/migrations/20260618000001_create_group_messages.sql` — tabela `group_messages` com índices, RLS (`group_messages_select_member` e `group_messages_insert_member` via `is_group_member()`), publicação no Supabase Realtime
- **Componente criado:** `components/bolao/GroupChatWidget.tsx` — Client Component completo
- **Layout modificado:** `app/(dashboard)/layout.tsx` — import e renderização condicional de `<GroupChatWidget>`

## [fix-predictions-reveal-on-live] — Revelação Automática de Palpites ao Vivo — 2026-06-17

- Corrigido bug em que palpites de terceiros permaneciam como OCULTO/PENDENTE após um jogo mudar de `pending` para `live` via Supabase Realtime, exigindo reload manual da página
- **Endpoint criado:** `GET /api/participants-predictions` (Next.js Route Handler) — autentica via Bearer JWT, valida UUIDs de `game_id` e `group_id`, usa cliente Supabase com JWT do usuário (RLS ativa) para retornar `{ user_id, game_id, home_score, away_score }` apenas dos palpites visíveis ao usuário
- **Hook criado:** `lib/hooks/useParticipantsRealtime.ts` — hook client que gerencia dois caminhos: (1) fetch imediato no mount quando `initialGameStatus !== 'pending'` (cobre página aberta com jogo já ao vivo); (2) subscricão ao canal Realtime `game-participants-${gameId}` na tabela `games` para detectar transição `pending → live` e disparar fetch automaticamente
- Merge de dados via `mergeWithPredictions` preserva todos os campos SSR (`name`, `points`, `breakdown`, `hasPrediction`) e nunca esvazia o array antes do fetch concluir — sem flash de estado vazio durante a transição
- `hasFetchedForLive` (`useRef`) garante idempotência: fetch ocorre no máximo uma vez por ciclo de vida do componente, mesmo com múltiplos eventos Realtime chegando
- RLS como barreira primária: em caso de race condition (fetch chega com jogo ainda `pending`), `home_score`/`away_score` retornam `null` pela RLS e o merge trata `null` como ausência de prediction
- **Componente modificado:** `components/games/GameCard.tsx` — integra `useParticipantsRealtime`; `participants` (prop SSR) é passada como estado inicial; `liveParticipants` (retorno do hook) substitui `participants` nas duas ocorrências de renderização condicional e passagem para `GameParticipantsList`
- Lógica `prediction-visibility` preservada: o hook não interfere com jogos `pending` — fetch só ocorre quando status já não é `pending`
- Canal Realtime `game-participants-${gameId}` é separado do canal `game-${gameId}` (usado por `useGameRealtime`) para evitar conflito de estado; subscription é removida corretamente no cleanup do `useEffect`
- Nenhuma migration de schema, RLS policy ou componente visual alterado — mudança exclusivamente de lógica de dados

## [prediction-visibility] — Distinção entre Palpite Oculto e Pendente — 2026-06-17

- Em jogos `pending`, a coluna PALPITE de terceiros passa a exibir `OCULTO` (cinza, `color-muted`) quando o participante já enviou seu palpite, e `PENDENTE` (vermelho, `color-error`) quando ainda não enviou — eliminando a ambiguidade do traço `-` introduzida pela feature predecessor `fix-prediction-visibility`
- O próprio usuário sempre vê seu palpite real, independentemente do status do jogo; em jogos `live` e `finished`, todos os palpites permanecem visíveis (comportamento original mantido)
- A privacidade dos valores de palpite é preservada: a query de existência seleciona apenas `user_id, game_id` — `home_score`/`away_score` de terceiros nunca trafegam para o cliente em jogos `pending`
- Decisão arquitetural documentada em `.pipeline/prediction-visibility-spec.md`: uso de service_role para verificação de existência (booleano) é explicitamente distinto da diretiva da spec anterior, que proibia leitura de conteúdo via service_role
- **Arquivo criado:** `lib/supabase/service-server.ts` — cliente service_role centralizado para Server Components e Route Handlers, com `persistSession: false`
- **Tipo estendido:** `lib/types/participant.ts` — campo `hasPrediction: boolean` adicionado a `ParticipantEntry`
- **Página modificada:** `app/(dashboard)/jogos/page.tsx` — quinta query paralela (service_role, `select('user_id, game_id')`, filtrada por grupo e jogos do dia) monta índice `Set<string>` com chave `"userId:gameId"` para lookup O(1); campo `hasPrediction` populado em cada `ParticipantEntry`
- **Componente modificado:** `components/bolao/GameParticipantsList.tsx` — lógica de `predictionLabel` e cor diferencia `OCULTO`/`PENDENTE`/placar real em jogos `pending` de terceiros
- Nenhuma migration de schema, RLS policy ou endpoint criado/alterado

## [remove-member] — Remover Participante do Grupo — 2026-06-17

- Admin de um grupo pode remover qualquer participante (exceto a si mesmo) diretamente pela tela `/grupos/[id]`, via botão `[REMOVER]` ao lado de cada linha de membro
- Modal de confirmação exibe nome do participante, aviso de reversibilidade e botão `CONFIRMAR REMOÇÃO`; modal permanece aberto em caso de erro com mensagem inline e botão `TENTAR NOVAMENTE`; fecha e remove da lista em caso de sucesso
- Atualização otimista: membro desaparece da lista imediatamente via `setMembers(prev => prev.filter(...))` sem reload de página
- Dupla defesa de auto-remoção: frontend não renderiza botão na própria linha do admin (`member.userId !== currentUserId`); backend rejeita com 403 quando `caller.id === userId`
- Membro não-admin nunca vê botão `[REMOVER]` (prop `isAdmin` validada no `MembersList`)
- Palpites e scores do membro removido permanecem no banco como registro histórico; apenas a linha em `group_members` é deletada
- **Endpoint criado:** `DELETE /api/groups/[id]/members/[userId]` (Next.js Route Handler) — verifica auth JWT (401), UUID válido (400), existência do grupo (404), membership do chamador (403), role admin (403), auto-remoção (403), membership do alvo (422); executa delete via `serviceClient` (service_role); retorna `{ removed: true, group_id, user_id }`
- **Componente criado:** `components/bolao/RemoveMemberButton.tsx` — client component com 4 estados (idle/confirming/loading/error), modal acessível (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), estilo Elifoot, JetBrains Mono
- **Componente criado:** `components/bolao/MembersList.tsx` — client component que gerencia estado local da lista de membros e renderiza `RemoveMemberButton` condicionalmente
- **Página modificada:** `app/(dashboard)/grupos/[id]/page.tsx` — bloco de lista de participantes substituído por `<MembersList>` com props `groupId`, `initialMembers`, `currentUserId`, `isAdmin`
- Nenhuma migration de schema ou RLS — deleção via `serviceClient` (service_role) dispensa policy de DELETE para `authenticated`; schema de `group_members` e funções `is_group_admin`/`is_group_member` existem desde features anteriores

## [delete-group] — Exclusão de Grupo pelo Admin — 2026-06-17

- Admin de um grupo pode excluí-lo permanentemente via botão "EXCLUIR GRUPO" na seção "ZONA DE PERIGO" em `/grupos/[id]`, visível somente quando `isAdmin === true`
- Modal de confirmação exibe o nome do grupo em destaque (`color-accent`), lista de consequências com ✗ (palpites e scores deletados, em `color-error`) e ✓ (perfis não afetados, em `color-win`), botões "CANCELAR" e "CONFIRMAR EXCLUSÃO"
- Estados internos do componente: idle → confirming → loading → error/sucesso; em erro o modal permanece aberto com mensagem inline e botão reabilitado; em sucesso redireciona para `/grupos`
- **Endpoint criado:** `DELETE /api/groups/[id]` (handler adicionado ao Route Handler existente) — verifica auth JWT, UUID, existência do grupo (404), membership (403 "Você não participa deste grupo."), role admin (403 "Apenas o admin pode excluir o grupo."); executa delete via `serviceClient` (service_role) com ON DELETE CASCADE para `group_members`, `predictions`, `scores` e `group_invites`; retorna `{ deleted: true, group_id }`
- **Componente criado:** `components/bolao/DeleteGroupButton.tsx` — client component com 4 estados (idle/confirming/loading/error), modal acessível (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), estilo Elifoot sem border-radius nem box-shadow, fonte JetBrains Mono, responsivo com `flex-wrap: wrap` nos botões
- **Página modificada:** `app/(dashboard)/grupos/[id]/page.tsx` — seção "ZONA DE PERIGO" com borda `color-error` adicionada após lista de participantes, condicional a `isAdmin`
- Nenhuma migration de schema ou RLS — ON DELETE CASCADE já existia nas FKs; `serviceClient` (service_role) ignora RLS por design; verificação de admin é defesa primária no Route Handler

## [date-chips-nav] — Navegação por Chips de Data — 2026-06-17

- Substituído o componente `DayNavigator` (dropdown + setas ◀ ▶) por `DateChipsNav` — faixa horizontal de chips clicáveis, um por data com jogos
- Chip da data ativa exibido em `color-accent` bold com borda amarela; chips inativos em `color-muted` com hover para `color-text`
- Scroll horizontal livre na faixa sem barra de scroll visível (Firefox: `scrollbarWidth: none`; webkit: `.date-chips-scroll::-webkit-scrollbar { display: none }`)
- Chip ativo centralizado automaticamente na viewport via `scrollIntoView({ inline: 'center' })` ao carregar e ao mudar de data
- Chips são `<button>` nativos com `aria-current="true"` no ativo; navegação por Tab funciona nativamente
- Formato de data abreviado no chip: `DD MMM` uppercase (ex: `11 JUN`, `19 JUL`)
- Estado vazio (`availableDates.length === 0`) exibe "SEM DATAS DISPONÍVEIS" em `color-muted` 11px uppercase
- Linha de contadores (`X JOGOS · Y PALPITES REGISTRADOS`) preservada abaixo da faixa
- **Componente criado:** `components/games/DateChipsNav.tsx`
- **Componente removido:** `components/games/DayNavigator.tsx`
- **Página modificada:** `app/(dashboard)/jogos/page.tsx` — import e JSX trocados
- **CSS modificado:** `app/globals.css` — regra webkit para ocultar scrollbar da faixa
- Nenhuma migration, endpoint, tabela nova ou mudança de RLS

## [date-picker-jogos] — Seletor de Datas com Jogos — 2026-06-17

- Clicar no texto da data exibida no `DayNavigator` abre um dropdown com a lista de todas as datas que possuem jogos cadastrados
- Datas exibidas no formato "DIA DA SEMANA, DD MMM YYYY" (via `formatDateDisplay`), em uppercase, fonte JetBrains Mono
- Data atual destacada em `color-accent` bold; item com foco via teclado destacado com `background: color-secondary`
- Navegação por teclado completa: `ArrowDown`/`ArrowUp` (com wrap), `Enter` para navegar, `Escape` para fechar e devolver foco, `Tab` para fechar sem travar foco nativo
- Fechar ao clicar fora via `mousedown` listener no `document` (apenas quando aberto); sem navegação ao clicar fora
- Dropdown acessível: `role="listbox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-activedescendant`, `role="option"`, `aria-selected`
- Indicador `▼`/`▲` em `color-muted` exibido após o texto da data; sem borda/fundo/sombra no trigger
- Setas `◀ ▶` existentes preservadas sem nenhuma alteração
- Conversão de timezone correta: `2026-06-12T00:00:00Z` → `2026-06-11` (jogo às 21h BRT)
- Deduplicação via `Set` garante uma entrada por dia BRT mesmo com múltiplos jogos com `match_date` UTC distintos
- **Função criada:** `matchDateToLocalDate` em `lib/date.ts` — converte `timestamptz` UTC para data BRT (`YYYY-MM-DD`) via `Intl.DateTimeFormat`, coerente com `todayInBrasilia()` e `dayBoundsInUTC()` já existentes
- **Componente modificado:** `components/games/DayNavigator.tsx` — interface estendida com `availableDates: string[]`, `<span>` da data convertido em `<button>`, dropdown absoluto adicionado
- **Página modificada:** `app/(dashboard)/jogos/page.tsx` — query de `allMatchDates` executada em paralelo com a query de jogos do dia via `Promise.all`; prop `availableDates` passada para `DayNavigator`
- Nenhuma migration, tabela nova, endpoint ou mudança de RLS

## [prediction-score-breakdown] — Detalhamento da Pontuação no Palpite — 2026-06-16

- Dentro de `GameParticipantsList` (jogo expandido), clicar na linha de um participante com palpite e score já calculado (`breakdown !== null`) revela o detalhamento da pontuação daquele palpite (accordion exclusivo por jogo)
- Linha clicável acessível via teclado (`role="button"`, `tabIndex`, `Enter`/`Espaço`, `aria-expanded`); indicador visual `▾`/`▴` apenas em linhas elegíveis
- Linhas sem palpite ou sem score calculado (jogos `pending`/`live`) permanecem inalteradas — sem indicador, sem cursor de clique
- **Componente criado:** `components/bolao/PredictionBreakdown.tsx` — apresentação pura do `breakdown jsonb`, reaproveita `BREAKDOWN_LABELS` de `lib/scoring.ts`, sem reimplementar cálculo
- **Tipo estendido:** `ParticipantEntry` (`lib/types/participant.ts`) ganha o campo `breakdown: ScoreBreakdown | null`
- `app/(dashboard)/jogos/page.tsx` passa a propagar `breakdown` junto de `points` a partir da mesma query `scores.select('*')` já existente (nenhuma query nova)
- Nenhum endpoint, migration ou RLS policy criados/alterados; nenhuma mudança em `lib/scoring.ts` ou na função Postgres `calculate_scores_for_game`

## [collapse-game-card] — Colapsar/Expandir Card de Jogo com Palpites dos Participantes — 2026-06-16

- Cada `GameCard` em `/jogos` passa a carregar **colapsado** por padrão, ocultando a seção "PALPITES DOS PARTICIPANTES" (`GameParticipantsList`); novo estado local `isParticipantsExpanded` (`useState(false)`) em `components/games/GameCard.tsx`
- Botão `<button type="button">` de toggle (renderizado apenas quando `participants.length > 0`) alterna a exibição, com texto `VER PALPITES ▾` (colapsado) / `OCULTAR PALPITES ▴` (expandido), `aria-expanded` e `aria-controls` corretos — focável via Tab, ativável via Enter/Espaço nativamente
- Estado de expansão é local a cada card via `useState`: múltiplos cards podem ficar expandidos simultaneamente, sem interferência entre eles; ao trocar de dia na navegação, os cards do dia revisitado voltam a montar colapsados (comportamento natural de desmontagem/remontagem do React, sem mecanismo de persistência)
- `useGameRealtime`/`useScoreRealtime` permanecem incondicionais no topo do componente — colapsar a seção de participantes não interrompe as subscriptions Realtime; placar e pontuação provisória continuam atualizando mesmo com o card colapsado
- Feature puramente de UI/interação client-side: sem mudança de schema, sem migration, sem endpoint novo, sem alteração em `GameParticipantsList.tsx`, `GameList.tsx` ou `app/(dashboard)/jogos/page.tsx`

## [fix-loser-score-rule] — Correção da Regra "Somente Placar do Perdedor" — 2026-06-16

- Inverte a condição do bônus "Somente placar do perdedor" (+1 pt) em `lib/scoring.ts` e na função Postgres `calculate_scores_for_game`: antes era concedido quando o usuário ERRAVA o vencedor mas acertava o placar de quem perdeu; agora exige que o usuário TAMBÉM tenha acertado o vencedor (mesmo pré-requisito já usado por "diferença de gols correta" e "somente placar do vencedor"), permanecendo mutuamente exclusivo com placar exato
- Nova migration `supabase/migrations/20260616130000_fix_loser_score_rule.sql` (`CREATE OR REPLACE FUNCTION calculate_scores_for_game`, preservando 100% das demais regras e o scoping por `group_id`), incluindo bloco de recálculo retroativo (`PERFORM calculate_scores_for_game(g.id)`) para todos os jogos `finished`, corrigindo scores já gravados pela regra antiga; migration criada mas não aplicada ao banco como parte desta correção
- `CLAUDE.md` e `components/bolao/ScoringRulesTable.tsx` atualizados para refletir o novo pré-requisito ("Somente placar do perdedor (acertou vencedor)" / nota `requer acerto do vencedor`)
- Página `/como-pontuar`: `EXEMPLO_5` reescrito para ilustrar a regra corrigida (BRA 3×1 ARG, palpite 2×1 → +4 pts); `EXEMPLO_1` e `EXEMPLO_6` ajustados porque, com a regra nova, seus cenários originais passavam a acionar `loser_score` incidentalmente (totais recalculados e validados via `calculateScore()` real)
- Sem mudança de schema, RLS, endpoints Ruby ou mecanismo de Realtime — correção isolada à lógica de pontuação

## [exemplos-por-regra] — Exemplo Dedicado por Regra de Pontuação — 2026-06-16

- Página `/como-pontuar`: os antigos 3 exemplos (cobrindo só 2 das 6 regras isoladamente) foram substituídos por 7 exemplos — 6 numerados (`EXEMPLO_1` a `EXEMPLO_6`), alinhados 1:1 e na mesma ordem das linhas de `SCORING_RULES` em `ScoringRulesTable.tsx`, mais 1 exemplo bônus de empate exato em subseção própria ("EXEMPLO COMPLEMENTAR")
- `components/bolao/ScoringExample.tsx` ganha prop opcional `ruleLabel` — renderiza rótulo `REGRA: <texto>` abaixo do título vinculando visualmente cada card à linha correspondente da tabela; comportamento existente preservado quando a prop não é usada
- Todos os 7 breakdowns (pontos e composição) foram validados programaticamente contra `calculateScore()` de `lib/scoring.ts`, tanto pelo Programador quanto de forma independente pelo Revisor — bateram byte-a-byte
- Exemplo 5 ("Somente placar do perdedor") isola corretamente o cenário em que o vencedor é errado no palpite, evitando o bug histórico do fix-1 de `como-pontuar`
- Grid responsivo ajustado: 1 coluna (`<640px`), 2 colunas (`640–1023px`), 3 colunas (`≥1024px`)
- Sem alteração de backend, banco de dados ou proteção de rotas — feature inteiramente estática

## [grupo-ativo-persistente] — Seleção Persistente de Grupo Ativo — 2026-06-16

- A seleção de "grupo ativo" passa a persistir via cookie HTTP `bolao_active_group` (`Path=/`, `SameSite=Lax`, `Secure` em produção, `Max-Age` de 1 ano, sem `HttpOnly`), eliminando a regressão em que navegar pelo menu perdia o `?group=` da URL e recalculava o primeiro grupo por `joined_at`
- **Endpoint criado:** `POST /api/groups/active` (Next.js Route Handler) — autentica via Bearer JWT, valida `group_id` (UUID + membership via `service_client`, 403 se não-membro) e grava o cookie de grupo ativo em caso de sucesso (200); único endpoint do produto autorizado a escrever esse cookie
- `lib/active-group.ts` (`resolveActiveGroup`) ganha 6º parâmetro `cookieGroupId` e nova ordem de prioridade: `?group=` (deep link, nunca grava cookie) > cookie válido (sem redirect) > primeiro grupo por `joined_at ASC` (fallback com gravação best-effort/auto-cura de cookie órfão)
- **Componente criado:** `components/bolao/AtivarGrupoButton.tsx` (client component) — único gatilho de troca de grupo ativo, presente em `/grupos` (lista, com seta `►`/badge `ATIVO`) e `/grupos/[id]` (badge `GRUPO ATIVO` ou botão conforme o caso)
- `app/(dashboard)/group-switcher.tsx` (`GroupSwitcher`, dropdown no header) removido por completo; `app/(dashboard)/layout.tsx` passa a exibir um indicador estático somente-leitura (`GRUPO: <NOME>`) linkando para `/grupos`
- `app/(dashboard)/jogos/page.tsx`, `app/(dashboard)/ranking/page.tsx`, `app/(dashboard)/meus-palpites/page.tsx` passam a ler o cookie e propagá-lo para `resolveActiveGroup`, sem nenhuma outra mudança de lógica/layout
- Sem migrations — nenhuma tabela do Supabase introduzida ou alterada; nenhuma mudança em RLS, regras de pontuação ou Realtime herdadas da feature `grupos`

## [convites-nominais] — Convites Nominais para Grupos — 2026-06-16

- **Banco de dados** (`create_group_invites`, espelhada em `supabase/migrations/` e `db/migrations/`): tabela `group_invites` (`group_id`, `invited_user_id`, `invited_by`, `status` `pending`/`accepted`/`declined`, `created_at`, `responded_at`), índices auxiliares e índice único parcial `group_invites_unique_pending` (nunca dois convites `pending` simultâneos para o mesmo par grupo/usuário); RLS habilitado com policy `group_invites_select_admin_or_invitee` (admin do grupo vê tudo do grupo, convidado vê o que é endereçado a ele); função `is_group_admin()` (`SECURITY DEFINER`, mesmo padrão de `is_group_member` de `grupos`); função `search_users_to_invite()` (`SECURITY DEFINER`) busca por nome/e-mail em `profiles`/`auth.users` sem nunca expor e-mail de terceiros no retorno
- **Endpoints (Next.js Route Handlers):** `GET /api/groups/[id]/invites/search-users` (busca de usuário a convidar, admin-only), `POST/GET /api/groups/[id]/invites` (criar convite idempotente — `already_member`/`already_pending`/`created` — e listar convites enviados, admin-only), `GET /api/invites/pending` (convites pendentes do usuário autenticado), `POST /api/invites/[id]/accept` e `POST /api/invites/[id]/decline` (resposta do convidado, com checagem de propriedade e status, `409` se já respondido)
- **Componentes/páginas:** `InviteUserSearch` (busca com debounce 400ms + convite) e `PendingInvitesList` (aceitar/recusar) novos; badge `✉ N CONVITE(S)` no header do dashboard (`app/(dashboard)/layout.tsx`); seção "Convites Recebidos" em `/grupos`; seção "Convidar Participante" + "Convites Enviados" em `/grupos/[id]` (somente admin)
- Feature aditiva: nenhuma alteração no fluxo de convite por link reutilizável (`groups.invite_token`, `/convite/[token]`, `resolve-invite`, `join`) nem em `predictions`/`scores`/`ranking`/regras de pontuação

## [grupos] — Grupos Privados (Bolões Isolados) — 2026-06-16

- **Banco de dados (7 migrations, espelhadas em `supabase/migrations/` e `db/migrations/`):**
  - `create_groups_and_members`: tabelas `groups`/`group_members`, função `is_group_member()` (`SECURITY DEFINER`), policies `groups_select_member`/`groups_insert_own`/`group_members_select_member`
  - `add_group_id_to_predictions_and_scores`: coluna `group_id` nullable + índices em `predictions`/`scores`
  - `seed_bolao_ingrisia_group`: cria grupo "Bolão da Ingrisia ABJ", torna "Hamon" admin, migra membros e dados existentes (backfill idempotente)
  - `enforce_group_id_not_null`: `group_id` passa a `NOT NULL`; nova constraint `UNIQUE(user_id, game_id, group_id)` substitui a antiga `UNIQUE(user_id, game_id)`
  - `group_scoped_rls`: policies de `SELECT` em `predictions`/`scores` reescritas para escopo por grupo via `is_group_member`
  - `group_scoped_scoring_trigger`: `calculate_scores_for_game` passa a gravar `group_id`, sem nenhuma alteração na lógica de pontuação (regra de goleada `>=4`/`>=4` preservada)
  - `get_ranking_by_group`: `get_ranking(p_group_id uuid)` substitui a função global, baseada em `group_members` filtrado por grupo
- **Endpoints (Next.js Route Handlers):** `GET/POST /api/groups`, `GET /api/groups/[id]`, `GET /api/groups/resolve-invite`, `POST /api/groups/join`; `predictions` e `ranking` agora exigem `group_id` e validam membership (403 se não-membro)
- **Componentes/páginas:** `/grupos`, `/grupos/novo`, `/grupos/[id]`, `/convite/[token]`, `GroupSwitcher`, `CreateGroupForm`, `CopyInviteLink`, `JoinGroupButton`; `/jogos`, `/ranking`, `/meus-palpites` escopados pelo grupo ativo via novo helper `lib/active-group.ts` (`resolveActiveGroup`)
- `lib/hooks/useRankingRealtime.ts` e `lib/hooks/useLivePointsByUser.ts` passam a receber `groupId` e escopam os canais Realtime por grupo
- `/login` e `/cadastro` passam a suportar `?redirect=`, com `useSearchParams()` envolvido em `Suspense` para preservar o build estático
- Observações não-bloqueantes registradas na revisão: a policy legada `predictions_insert_own` (já existente antes desta feature) foi removida sem impacto, pois todas as escritas usam `service_role`; a view `ranking_view` (não utilizada por nenhum código de aplicação) não foi escopada por grupo e deve ser limpa em uma manutenção futura

## [live-scoring] — Pontuação em Tempo Real Durante Jogos ao Vivo — 2026-06-15

- `lib/scoring.ts`: nova função `calculateLiveScore(game, prediction)` — reaproveita `calculateScore()` sem duplicar regras, tolera placar nulo (`home_score`/`away_score` ainda não definidos) retornando `null`
- `components/bolao/GameParticipantsList.tsx`: nova prop `liveGame`; durante jogos `status === 'live'`, exibe coluna `PTS*` com pontuação parcial por participante (`color-live`), `-` para quem não tem palpite, e legenda `* PROVISÓRIO — RECALCULADO AO VIVO`
- `components/games/GameCard.tsx`: passa `liveGame` (placar já mantido por `useGameRealtime`) para `GameParticipantsList`, sem nova subscription
- `lib/hooks/useLivePointsByUser.ts` (novo): busca jogos `live` + palpites, calcula pontuação parcial agregada por `user_id`, assina canal Realtime `live-points-games` (tabela `games`, evento `UPDATE`) com debounce de 1000ms; degrada graciosamente em erro de rede (loga no console, mantém último valor)
- `components/bolao/RankingTable.tsx`: combina `useRankingRealtime()` + `useLivePointsByUser()`; soma pontuação oficial + pontos parciais de jogos `live`, reordena e recalcula `rank_position` no cliente reproduzindo a semântica de `RANK()` do Postgres (empates recebem a mesma posição, próxima posição distinta "pula" o número de empatados); exibe nota `INCLUI PONTOS PROVISÓRIOS` quando aplicável; `aproveitamento` permanece calculado apenas sobre jogos `finished`
- Nenhuma migration, nenhum endpoint Ruby novo, nenhuma escrita em `scores` — cálculo 100% client-side, sem persistência
- Correção pós-revisão (fix-1): `rank_position` calculado por `applyLivePoints()` inicialmente usava numeração sequencial estrita (`index + 1`), causando regressão visual em empates no topo do ranking (apenas um líder marcado com `►`); corrigido para herdar a posição do item anterior quando os pontos totais são iguais, reproduzindo `RANK() OVER (ORDER BY total_points DESC)` usado por `get_ranking()`

## [fix-live-sync] — Correção: Status ao Vivo e Polling de Fallback — 2026-06-15

- `mapStatus` corrigido em `app/api/admin/sync-games/route.ts` e `supabase/functions/sync-games/index.ts`: passa a usar `event.status.type.state` (`"pre"` | `"in"` | `"post"`) em vez de `name` (`STATUS_IN_PROGRESS`), cobrindo todos os status ao vivo da ESPN (`STATUS_FIRST_HALF`, `STATUS_SECOND_HALF`, `STATUS_HALF_TIME`, etc.)
- Edge Function `sync-games` redeployada com `--no-verify-jwt` para compatibilidade com chamadas do `pg_cron` via `pg_net` (sem header de autorização)
- `useGameRealtime` (`lib/hooks/useGameRealtime.ts`): polling de fallback adicionado — re-fetch direto no Supabase a cada 30s quando o jogo está dentro da janela ativa (10 min antes do início até 3h após); garante atualização de status e placar mesmo se o WebSocket Realtime cair silenciosamente; não roda para jogos encerrados ou fora da janela

## [como-pontuar] — Página Como Pontuar — 2026-06-15

- Página `/como-pontuar` criada com tabela de pontuação e 3 exemplos pedagógicos de cálculo
- Componente `ScoringRulesTable` com os 6 eventos de pontuação, coluna de pontos em `color-accent`, máximo possível (+9) conforme `scoring.ts`
- Componente `ScoringExample` com breakdown linha a linha (check/cross), total e nota explicativa opcional
- Exemplo 1 (BRA 3×1 ARG palpite 3×1): placar exato → +8 pts correto
- Exemplo 2 (BRA 2×0 MEX palpite 1×0): acerto parcial → +3 pts correto (fix-1: `loser_score` não aplica quando vencedor foi acertado)
- Exemplo 3 (ALE 1×1 FRA palpite 1×1): empate exato → +8 pts correto
- Item "REGRAS" adicionado ao array `NAV_ITEMS` em `app/(dashboard)/nav-links.tsx` com comportamento `isActive` automático
- Feature inteiramente estática — sem endpoints Ruby, sem migrations, sem chamadas de API
- Proteção de rota via `DashboardLayout` existente (grupo `(dashboard)`)

## [fix-prediction-visibility] — Correção: Visibilidade Temporal dos Palpites — 2026-06-14

- Migration criada: `supabase/migrations/20260614191000_fix_prediction_visibility_policy.sql` — substitui a política irrestrita de leitura em `predictions` por uma política temporal: usuários autenticados só podem ler palpites de terceiros em jogos que não estão mais em status `pending`.
- `components/bolao/GameParticipantsList.tsx` atualizado com defesa em profundidade: em jogos `pending`, palpites de outros participantes são renderizados como `OCULTO`, independentemente dos dados recebidos do backend.
- Próprio usuário continua vendo seu palpite normalmente em qualquer status de jogo.
- Fix de lint aplicado em `app/(dashboard)/jogos/page.tsx` (uso de `const` para satisfazer `prefer-const`) e em `lib/hooks/useRankingRealtime.ts` (uso de `setTimeout` para evitar `react-hooks/set-state-in-effect`).
- Verificação técnica completa via `npm run lint` e `npm run build` confirmando integridade do projeto.

## [fix-live-scores-display] — Correção: Exibição e Atualização de Placar em Tempo Real — 2026-06-14

- Guarda defensiva adicionada em `useGameRealtime` para não sobrescrever o estado quando `payload.new` chega incompleto (sem `REPLICA IDENTITY FULL` ativo, o payload pode ser `{}`); cast alterado de `payload.new as Game` para `payload.new as Partial<Game>` com validação de `id` e `status` antes de `setGame`
- Early return adicionado em `useScoreRealtime` quando `userId` está vazio ou undefined, evitando criação de canal com nome inválido (`score-${gameId}-`) e subscription que nunca corresponderia ao usuário real
- Migration criada: `db/migrations/20260614_fix_scores_realtime_rls.sql` — política RLS `"users can read own scores"` (`FOR SELECT TO authenticated USING (user_id = auth.uid())`) garantindo que o Realtime do Supabase entregue eventos de scores ao próprio usuário
- `lib/scoring.ts` verificado: sem falsy checks em `home_score` ou `away_score`; usa `===` e `!==` em parâmetros tipados como `number`
- `components/bolao/GameParticipantsList.tsx` verificado: Server Component puro sem hooks, sem alterações necessárias
- `components/games/GameCard.tsx` verificado: lógica `hasScore ? ... : isLive ? '0 × 0' : '- × -'` confirmada correta; sem alterações
- Cleanup de canais (`supabase.removeChannel`) verificado e correto em ambos os hooks modificados

## [fix-long-names] — Correção: Nomes Longos nos Cards de Jogo — 2026-06-14

- Nomes de times longos (ex: "COSTA DO MARFIM") truncados com reticências em vez de quebrar para segunda linha, garantindo altura uniforme em todos os `GameCard`
- `minWidth: 0` adicionado nas duas divs de container de time (colunas `1fr` do grid `1fr auto 1fr`) — correção padrão para truncamento funcionar dentro de CSS Grid items
- `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` adicionados na div do `home_team` e na div do `away_team`
- `minWidth: 0` adicionado no span do venue no footer (flex item já tinha `overflow/ellipsis/nowrap/maxWidth: 160px`, mas precisava de `minWidth: 0` para respeitar essas propriedades)
- Códigos de 3 letras (`home_team_code`, `away_team_code`) e placar central (`minWidth: '80px'`, coluna `auto`) não afetados
- Correção exclusivamente de frontend — nenhuma migration, endpoint ou componente além de `components/games/GameCard.tsx`

## [fix-team-code-display] — Correção: Exibição dos Códigos de Times — 2026-06-14

- Causa raiz identificada: 17 jogos de mata-mata tinham códigos placeholder de 2 chars (`"2A"`, `"SF"`) armazenados como `char(3)` com padding de espaço (`"2A "`, `"SF "`), quebrando alinhamento em fonte monospace
- **Migration 004** (`20260614000004_fix_team_code_padding.sql`): remove espaços trailing via `trim()` e converte colunas `home_team_code`/`away_team_code` de `char(3)` para `varchar(10)` para prevenir recorrência do padding automático
- **Migration 005** (`20260614000005_fix_team_code_placeholders.sql`): converte 17 códigos de 2 chars para 3 chars com mapeamento semântico — `"2A"` → `"2GA"`, `"SF"` → `"SFX"` — regex `'^[12][A-L]$'` cobre todos os 12 grupos da Copa
- **Migration 006** (`20260614000006_team_code_check_constraints.sql`): adiciona `CHECK (length(trim(home_team_code)) = 3)` e `CHECK (length(trim(away_team_code)) = 3)` reforçando a regra de negócio (exatamente 3 chars) na camada de banco
- **`app/api/admin/sync-games/route.ts`**: constante `TEAM_CODE_FALLBACK` (mapa ESPN displayName → código 3 chars) e função `getTeamCode` com fallback e `padEnd(3, 'X')` como salvaguarda final na camada de aplicação
- Nenhum componente frontend alterado — a correção é exclusivamente na camada de dados e de ingestão

## [fix-goleada-scoring] — Correção da Regra de Goleada na Pontuação — 2026-06-14

- Regra de goleada corrigida de `>= 3 gols do vencedor real` para três condições simultâneas: acertou vencedor + vencedor no palpite marcou `>= 4 gols` + diferença real `>= 4 gols`
- Empate nunca concede bônus de goleada (sem vencedor)
- `lib/scoring.ts` — bloco da Regra 6 reescrito com `predWinnerScore >= 4 && realGoalDiff >= 4`; comentário de cabeçalho atualizado
- **Migration criada:** `supabase/migrations/20260614000003_fix_goleada_scoring.sql` — `CREATE OR REPLACE FUNCTION calculate_scores_for_game` com nova variável `v_pred_winner_score` e condição `v_pred_winner_score >= 4 AND v_real_diff >= 4`
- **Documentação:** `CLAUDE.md` — tabela de pontuação atualizada com definição correta da goleada
- Alinhamento lógico exato entre TypeScript e Postgres verificado em todos os 5 casos de teste da spec
- `api/scores/calculate.rb` não alterado (faz apenas RPC, sem lógica de pontuação própria)

## [game-participants-view] — Palpites e Pontuação dos Participantes por Jogo — 2026-06-14

- Seção "PALPITES DOS PARTICIPANTES" adicionada a cada `GameCard` em `/jogos`: lista todos os perfis do bolão com palpite e pontuação
- Palpite exibido no formato `H × A` em `color-accent`; traço `-` em `color-muted` quando participante sem palpite
- Coluna PTS exibida apenas para jogos `finished`, no formato `+N`; omitida para jogos `pending` e `live`
- Usuário logado identificado com prefixo `■` (ASCII) em `color-primary` em sua linha na tabela
- Dados carregados em `Promise.all` com 4 queries paralelas (games, profiles, all predictions, all scores) — sem N+1
- Índices em memória `predByUserGame` e `scoreByUserGame` por chave `"userId:gameId"` para montagem O(1) de `participantsByGameId`
- **Tipo criado:** `lib/types/participant.ts` — interface `ParticipantEntry { userId, name, prediction, points }`
- **Componente criado:** `components/bolao/GameParticipantsList.tsx` — Server Component (sem `'use client'`), tabela compacta estilo Elifoot
- **Componentes modificados:** `components/games/GameList.tsx` (prop `participantsByGameId`), `components/games/GameCard.tsx` (prop `participants`, renderiza `GameParticipantsList`)
- **Página modificada:** `app/(dashboard)/jogos/page.tsx` — estendida para buscar `allProfiles`, `allPredictions` e `allScores` em paralelo e montar `participantsByGameId`
- **Migration SQL:** `db/migrations/20260614_participants_read_policies.sql` — substitui `predictions_select_own` e `scores_select_own` por políticas abertas a todos os autenticados (`USING (true)`); adiciona `profiles_select_all_authenticated` de forma idempotente

## [live-scores-realtime] — Placares em Tempo Real (Realtime) — 2026-06-14

- Migration `db/migrations/20260614_enable_realtime_publications.sql` criada: habilita `REPLICA IDENTITY FULL` em `games` e `scores` e as adiciona à publicação `supabase_realtime` de forma idempotente (blocos `DO $$ IF NOT EXISTS $$`); pré-requisito para que `payload.new` contenha o registro completo nos eventos UPDATE
- `useGameRealtime` refatorado: retorna `GameRealtimeState { game, lastUpdatedAt, connectionStatus }` em vez de `Game` diretamente; callback de status do canal mapeia `SUBSCRIBED → 'connected'` e `CHANNEL_ERROR`/`TIMED_OUT → 'error'`; interface `GameRealtimeState` exportada
- `GameCard` atualizado: desestrutura `{ game: liveGame, lastUpdatedAt }` do hook; exibe `· atualizado há Xs` (ou `Xmin`) em `color-muted` (11px) no footer de jogos ao vivo, apenas após receber o primeiro evento Realtime; `setInterval` de 10s criado somente quando `isLive === true` e limpo no cleanup; `flexWrap: 'wrap'` no footer para suporte a mobile
- `useRankingRealtime` atualizado: adiciona `lastUpdatedAt: Date | null` ao retorno; atualizado após cada `fetchRanking` bem-sucedido (carga inicial e refetches por evento Realtime)
- `RankingTable` atualizado: exibe `● AO VIVO · HH:MM:SS` no header quando `lastUpdatedAt !== null`, formatado com `toLocaleTimeString('pt-BR')`; helper `formatTime` adicionado
- Cleanup de canais Realtime (`supabase.removeChannel`) verificado e correto em todos os hooks modificados
- Build TypeScript e lint passam sem erros novos; único warning pré-existente em `useRankingRealtime.ts` (`react-hooks/set-state-in-effect`) já existia na main antes desta feature
- **Migration criada:** `db/migrations/20260614_enable_realtime_publications.sql`
- **Hooks modificados:** `lib/hooks/useGameRealtime.ts`, `lib/hooks/useRankingRealtime.ts`
- **Componentes modificados:** `components/games/GameCard.tsx`, `components/bolao/RankingTable.tsx`

## [ranking-mobile-fit] — Ajuste Mobile do Ranking — 2026-06-14

- Página `/ranking` cabe inteiramente em 375x667px sem scroll vertical com até 12 participantes (estimativa: 530px de altura total)
- Coluna APROVEIT. ocultada em mobile (`hidden md:table-cell` em `<th>` e `<td>`) e visível a partir de 768px
- Título "RANKING GERAL" e subtítulo removidos de `page.tsx` — redundantes com o cabeçalho interno da `RankingTable`
- Padding das células reduzido de `0.5rem 0.75rem` para `0.35rem 0.5rem` em todos os `<th>` e `<td>`
- Font-size do nome do participante: 12px em mobile, 14px a partir de 768px via classe `.ranking-name-cell` em `globals.css`
- `overflowX: 'auto'` removido do wrapper da `RankingTable` — desnecessário com 3 colunas em mobile
- Indicador `● AO VIVO`, rodapé com legenda, destaque de líder e usuário atual preservados
- Sem alterações no banco de dados, endpoints Ruby ou hook `useRankingRealtime`
- **Componentes modificados:** `app/(dashboard)/ranking/page.tsx`, `components/bolao/RankingTable.tsx`, `components/bolao/RankingRow.tsx`
- **CSS modificado:** `app/globals.css` (regra `.ranking-name-cell`)

## [fix-ranking-visibility] — Correção: Visibilidade no Ranking — 2026-06-14

- Corrigida causa raiz do ranking vazio: `get_ranking()` e `ranking_view` usavam INNER JOIN entre `scores` e `profiles`, excluindo todos os usuários sem pontuação calculada (tabela `scores` vazia antes do primeiro jogo encerrado)
- Migration `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql` substitui INNER JOIN por `FROM profiles p LEFT JOIN scores s` com `COALESCE(SUM(s.points), 0)` — todos os perfis cadastrados aparecem com 0 pontos quando ainda sem jogos encerrados
- `RANK()` opera sobre `COALESCE(SUM(s.points), 0)`: participantes com 0 pontos recebem `rank_position = 1` (empate matematicamente correto); desempate estável por `p.name ASC`
- `COUNT(s.id)` retorna 0 corretamente no LEFT JOIN (sem COALESCE adicional necessário)
- `SECURITY DEFINER` mantido para contornar RLS `scores_select_own` e permitir agregação de pontos de todos os usuários
- **Componente modificado:** `components/bolao/RankingTable.tsx` — prop `isLeader` alterada para `entry.rank_position === 1 && entry.total_points > 0`, evitando que todos com 0 pontos sejam destacados simultaneamente como líderes
- Nenhuma alteração necessária em `route.ts`, `useRankingRealtime.ts`, `RankingRow.tsx` ou na página `/ranking` — todos já estavam alinhados

## [predictions-edit] — Edição de Palpites — 2026-06-14

- Usuário pode editar palpite existente enquanto faltam mais de 5 minutos para o jogo (deadline idêntico ao de criação)
- Botão "✎ EDITAR PALPITE" (ghost, borda `color-primary`) exibido em `PredictionDisplay` somente para jogos `pending` antes do deadline
- Clicar em EDITAR reabre o `PredictionForm` pré-preenchido com os placares anteriores
- Botão "CANCELAR" sempre visível no modo edição (independente de deadline expirado) — permite retornar ao display sem reload
- Label do CTA muda para "SALVAR ALTERAÇÃO" no modo edição; título do painel muda para "EDITAR PALPITE"
- Palpite atualizado exibido imediatamente após PATCH bem-sucedido (sem reload); `submitted_at` reflete horário da edição
- Jogos `live` ou `finished` nunca exibem botão EDITAR, mesmo que recebam `matchDate` via props
- Erros mapeados em PT-BR: `deadline_expired` → "Prazo encerrado. Não é possível editar o palpite.", `forbidden` → "Acesso negado."
- **Endpoint criado:** `PATCH /api/predictions/[id]` (Next.js Route Handler) — validações em cascata: 401 JWT → 400 UUID → 404 not found → 403 ownership → 422 status live/finished → 422 deadline temporal → 422 scores inválidos → 200 updated
- **Componentes modificados:** `PredictionDisplay.tsx` (+ `matchDate`, `onEditRequest`; `"use client"` para hover state), `PredictionForm.tsx` (+ `onCancelEdit`, `onSuccess`; modo edição com PATCH), `GameCard.tsx` (+ estado `isEditing`, `currentPrediction`; três ramos exclusivos de renderização)
- **Migration SQL:** `db/migrations/20260614_predictions_update_policy.sql` — política RLS `predictions_update_own` (`FOR UPDATE`, `USING + WITH CHECK auth.uid() = user_id`)
- **Nota:** mensagem client-side de race condition na linha 109 do `PredictionForm` usa "registrar" em vez de "editar" em modo edição — janela de ocorrência de milissegundos, sem impacto funcional

## [ranking] — Ranking em Tempo Real — 2026-06-13

- Página `/ranking` com classificação completa de todos os participantes, ordenada por pontos totais (decrescente)
- Líder destacado com `►` e cor `color-accent`; usuário atual destacado em `color-primary` com fundo sutil e sufixo `(VOCÊ)`
- Aproveitamento (%) calculado no backend: `total_points / (games_predicted * 9) * 100`
- Ranking atualiza automaticamente em tempo real via Supabase Realtime (canal `ranking-scores`, tabela `scores`) — sem reload
- Indicador `"● AO VIVO"` piscante no cabeçalho da tabela
- Links de navegação adicionados ao header do dashboard: `JOGOS | RANKING | PALPITES` com destaque de rota ativa
- **Banco:** `db/migrations/20260613_create_ranking_view.sql` — view `ranking_view`, função `get_ranking()` com `SECURITY DEFINER` para contornar RLS de `scores`
- **Endpoint criado:** `GET /api/ranking` (Ruby) — chama `get_ranking()` via RPC; aproveitamento calculado no servidor; 401/500 tratados
- **Tipo criado:** `lib/types/ranking.ts` — interface `RankingEntry`
- **Hook criado:** `lib/hooks/useRankingRealtime.ts` — fetch inicial + subscription Realtime com cleanup automático
- **Componentes criados:** `components/bolao/RankingRow.tsx`, `components/bolao/RankingTable.tsx` — tabela densa estilo Elifoot
- **Página criada:** `app/(dashboard)/ranking/page.tsx` — Server Component, auth via `supabase.auth.getUser()`
- **Componentes criados:** `app/(dashboard)/nav-links.tsx` — Client Component com `usePathname()` para destaque de nav ativa
- **Componente modificado:** `app/(dashboard)/layout.tsx` — integra `NavLinks` no header

## [scoring] — Pontuação por Jogo em Tempo Real — 2026-06-13

- Cálculo automático de pontos via trigger Postgres `on_game_finished`: quando admin muda status para `finished`, todos os palpites do jogo são calculados e persistidos em `scores` via UPSERT (sem chamada manual)
- Breakdown de bônus exibido no `GameCard` após jogo encerrado: `✓ Acertou o vencedor +3`, `✓ Placar exato +5`, etc. — apenas itens com pontos > 0
- Pontuação atualiza em tempo real via Supabase Realtime (hook `useScoreRealtime`, tabela `scores`)
- Página `/meus-palpites` com tabela compacta estilo Elifoot: JOGO | PALPITE | RESULTADO | PONTOS; total de pontos no rodapé
- Recálculo manual via `POST /api/scores/calculate` (admin-only, `X-Admin-Secret`) para casos de correção de placar pós-encerramento
- **Migration SQL:** `db/migrations/20260613_create_scores.sql` — tabela `scores`, função `calculate_scores_for_game`, trigger `on_game_finished`, RLS (SELECT próprio usuário)
- **Lib criada:** `lib/scoring.ts` — `calculateScore(game, prediction)` espelha a lógica Postgres em TypeScript; `BREAKDOWN_LABELS` em português
- **Tipos criados:** `lib/types/score.ts` — interfaces `Score` e `ScoreBreakdown`
- **Hook criado:** `lib/hooks/useScoreRealtime.ts` — subscription Realtime para tabela `scores` com filtragem por `userId`
- **Componente criado:** `components/bolao/ScoreDisplay.tsx` — breakdown visual com borda `color-primary`, pontos em `color-accent`, checks em `color-win`
- **Endpoint criado:** `POST /api/scores/calculate` (Ruby) — recálculo via RPC Supabase; 401/400/404/422/500 tratados
- **Componentes modificados:** `GameCard.tsx` (+ props `score`, `userId`; integra `ScoreDisplay`), `GameList.tsx` (+ props `scoresByGameId`, `userId`), `app/(dashboard)/jogos/page.tsx` (busca scores server-side)

## [live-scores] — Placares em Tempo Real — 2026-06-13

- Placares e status de jogos atualizados em tempo real via Supabase Realtime (WAL replication), sem reload de página
- Cada `GameCard` subscreve ao canal `game-${gameId}` individualmente; cleanup ao desmontar (sem memory leak)
- Badge "██ AO VIVO ██" pisca (CSS `blink`) em jogos com `status === 'live'`; placar em `color-accent` para jogos `live` e `finished`
- Latência alvo de < 2s desde UPDATE no banco até atualização na tela do usuário
- **Hook criado:** `lib/hooks/useGameRealtime.ts` — `useGameRealtime(gameId, initialGame)` com subscription Realtime e cleanup automático
- **Componente modificado:** `components/games/GameCard.tsx` — integra o hook; interface de props sem alteração
- **Endpoint criado:** `PATCH /api/admin/games/[id]` (Ruby) — atualiza `home_score`, `away_score`, `status`; autenticação via `X-Admin-Secret` header (env var `ADMIN_SECRET`); 401/404/422/500 tratados
- **Banco:** nenhuma migration SQL; configuração manual necessária: `ALTER TABLE games REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE games`

## [predictions] — Palpites — 2026-06-13

- Sistema de palpites na rota `/jogos`: cada GameCard exibe formulário inline para jogos pendentes
- Formulário com dois inputs numéricos estilo LED (borda `color-accent`) para placar casa × visitante
- Deadline automático de 5 minutos antes do início: inputs bloqueados, mensagem "✗ PRAZO ENCERRADO"
- Countdown visual "⏱ FECHA EM Xh Ymin" quando faltam < 2h; muda para `color-error` quando < 30min
- Palpite enviado exibido com "✓ SEU PALPITE" em borda `color-primary`, placar `color-accent`; imutável após envio
- Jogos ao vivo e encerrados: exibe palpite (se enviado) ou "SEM PALPITE" em `color-muted`
- Feedback visual imediato: loading durante envio, mensagem de sucesso/erro após resposta da API
- **Endpoints criados:** `POST /api/predictions` (registra com validação deadline + JWT), `GET /api/predictions?game_id=UUID`
- **Componentes criados:** `PredictionForm.tsx` (Client), `PredictionDisplay.tsx`
- **Componentes modificados:** `GameCard.tsx` (Client Component + prop prediction), `GameList.tsx` (prop predictionsByGameId), `app/(dashboard)/jogos/page.tsx` (busca predictions server-side)
- **Tipos:** `lib/types/prediction.ts` — interface `Prediction`
- **Migration SQL:** `db/migrations/20260613_create_predictions.sql` — tabela `predictions`, UNIQUE(user_id, game_id), RLS (SELECT + INSERT apenas próprio usuário, sem UPDATE/DELETE)

## [game-navigation] — Navegação de Jogos — 2026-06-13

- Visualização de jogos da Copa 2026 por dia na rota `/jogos` (substituiu placeholder)
- Navegação entre dias com botões `◀` e `▶` via URL `?date=YYYY-MM-DD`
- Data padrão ao acessar `/jogos`: dia atual no horário de Brasília (UTC-3)
- Destaque visual para o dia atual ("HOJE") em `color-accent`
- Contagem de jogos por dia e palpites registrados no cabeçalho de navegação
- Jogos ao vivo com badge `██ AO VIVO ██` piscante (`blink`) e borda em `color-live`
- Placar exibido em `color-accent` (quando disponível); status "PENDENTE", "AO VIVO", "ENCERRADO"
- Estado vazio: "NENHUM JOGO NESTE DIA" quando não há jogos na data
- **Endpoints criados:** `GET /api/games?date=YYYY-MM-DD` (autenticado, 401/400/500 tratados)
- **Componentes criados:** `GameCard.tsx`, `GameList.tsx`, `DayNavigator.tsx`
- **Tipos:** `lib/types/game.ts` — interface `Game`, type `GameStatus`
- **Migration SQL:** `db/migrations/20260613_create_games.sql` — tabela `games`, RLS, índices, `UNIQUE(home_team_code, away_team_code, match_date)`
- **Migration adicional:** `db/migrations/20260613_games_unique_match.sql` — adiciona UNIQUE constraint em bancos já existentes
- **Seed script:** `db/seeds/seed_games.rb` — 15 jogos placeholder/fictícios da Copa 2026 em 6 dias (11–16 jun), explicitamente não oficiais; fail-closed em erros de verificação de duplicata; segunda linha de defesa via `on_conflict + resolution=ignore-duplicates`
- **Utilitário de data:** `lib/date.ts` — `dayBoundsInUTC()` calcula limites do dia BRT em UTC com suporte a DST (UTC-3/UTC-2) via `Intl.DateTimeFormat`; `isValidDateString()` com rejeição de datas impossíveis; `todayInBrasilia()`

---

## [auth] — Autenticação — 2026-06-13

- Sistema de autenticação completo via Supabase Auth (e-mail e senha)
- Cadastro de novos participantes com criação automática de perfil na tabela `profiles` via trigger `on_auth_user_created`
- Login com mapeamento de erros em português ("E-mail ou senha incorretos", "E-mail já cadastrado. Faça login.")
- Proteção de rotas via Next.js middleware: não autenticado → `/login`; autenticado em rota pública → `/jogos`
- Persistência de sessão via cookies HttpOnly gerenciados pelo `@supabase/ssr`
- Botão de logout funcional no header do dashboard
- Paleta DESIGN.md aplicada (`color-bg`, `color-surface`, `color-border`, `color-primary`, `color-accent`, `color-error`, `color-muted`, `color-text`)
- Fonte JetBrains Mono em toda a interface via `next/font/google`
- Interface 100% em português, dark mode only, mobile-first (max-width 400px)
- **Componentes criados:** `Button.tsx`, `Input.tsx`, `LogoutButton.tsx`
- **Arquivos de infraestrutura:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`
- **Páginas:** `app/(auth)/login/page.tsx`, `app/(auth)/cadastro/page.tsx`, `app/(dashboard)/jogos/page.tsx` (placeholder)
- **Layouts:** `app/layout.tsx` (root), `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`
- **Migration SQL** (execução manual no Supabase SQL Editor): tabela `profiles`, RLS policies, trigger `on_auth_user_created`
