# Changelog: Aba de Palpites com Jogos ao Vivo e Ranking

**Slug:** palpites-ao-vivo
**Branch:** feature/palpites-ao-vivo
**Data:** 2026-06-25
**Status:** aprovado

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhum endpoint novo — a feature usa exclusivamente o endpoint existente `GET /api/ranking?group_id=<id>` e queries Supabase client-side diretas.

### Frontend (Next.js/React)

- `lib/hooks/usePalpitesAoVivo.ts` — hook client-side com polling de 10 segundos. Busca jogos live+finished, palpites e scores do grupo via Supabase, ranking via `/api/ranking`. Calcula pontos parciais de jogos live via `calculateLiveScore()`. Retorna `liveGames`, `rankingWithDetails` (com detalhamento de games por participante), `loading`, `error` e `lastPolledAt`. Usa `window.setTimeout(..., 0)` para a busca inicial (padrão do projeto em `useRankingRealtime`).
- `components/bolao/PalpitesLiveCard.tsx` — cards compactos de jogos ao vivo com bandeiras, placar real em `color-accent` (24px bold), badge `██ AO VIVO ██` piscante em `color-live`, e linha de palpite do usuário logado. Estado vazio exibe "NENHUM JOGO AO VIVO NO MOMENTO". Scroll horizontal quando 2+ jogos ao vivo.
- `components/bolao/PalpitesRankingRow.tsx` — linha do ranking com accordion de breakdown por jogo. Linha principal clicável (`role="button"`, teclado via Enter/Espaço). Accordion acessível (`role="region"`, `aria-expanded`, `aria-controls`). Breakdown mostra o palpite do participante (nunca o placar real), pontos (provisórios com `*` em `color-live` para live, oficiais em `color-accent` para finished). Labels de breakdown via `BREAKDOWN_LABELS` de `lib/scoring.ts`.
- `components/bolao/PalpitesRanking.tsx` — tabela de ranking recebendo dados como props (sem instanciar o hook — evita duplo polling). Animação FLIP manual com `useLayoutEffect` idêntica ao padrão de `PublicParticipantsList.tsx`: `rowRefs`, `prevPositions`, `isFirstRender`, algoritmo FIRST→LAST→INVERT→PLAY com transition 350ms ease-in-out. Inclui `NextUpdateCountdown` — contador regressivo em tempo real mostrando "PRÓX. ATU. EM Ns".
- `app/(dashboard)/palpites/page.tsx` — Server Component que resolve `currentUserId` e `groupId` via sessão Supabase e cookie `bolao_active_group` (lógica idêntica ao `layout.tsx`). Redireciona para `/grupos` se sem grupo ativo.
- `app/(dashboard)/palpites/palpites-live-section.tsx` — Client Component orquestrador: instancia `usePalpitesAoVivo` uma única vez e distribui os dados para `PalpitesLiveCard` (sticky) e `PalpitesRanking`. Separa responsabilidades: Server Component resolve auth/grupo; Client Component gerencia polling e estado.
- `components/bolao/TabBar.tsx` — adicionado item `{ href: '/palpites', label: 'PALPITES' }` entre JOGOS e RANKING. Font-size reduzido de `13px` para `12px` e `letterSpacing` de `0.05em` para `0.04em` para acomodar 5 elementos (EU, JOGOS, PALPITES, RANKING, MAIS) em telas de 320px.

### Banco de Dados

Nenhuma migration ou policy nova — a feature usa exclusivamente tabelas existentes: `games`, `predictions`, `scores`, `profiles`, `group_members`.

---

## Decisões técnicas

**Arquitetura com um único hook:** `PalpitesRanking` recebe dados como props em vez de instanciar `usePalpitesAoVivo` internamente. Isso evita dois polls paralelos de 10 segundos. O hook é instanciado apenas em `PalpitesLiveSection`, que distribui os dados para os dois componentes visuais.

**Contador regressivo (`NextUpdateCountdown`):** Implementado como sub-componente usando `setInterval(tick, 500)` — 500ms é suficiente para atualizar o contador sem ser impreciso. O intervalo de 500ms garante que a transição de "10s" para "9s" apareça sem delay perceptível ao usuário.

**Jogos pending fora do breakdown:** A spec determina que apenas jogos `live` e `finished` aparecem no breakdown (visibilidade de palpites de terceiros). A filtragem é feita em `PalpitesRankingRow` com `.filter((g) => g.status === 'live' || g.status === 'finished')`. O hook ainda inclui todos os jogos em `games` para não perder dados caso o status mude durante o polling.

**Sticky container com `z-index: 10`:** O container dos cards de jogos ao vivo usa `position: sticky; top: calc(44px + env(safe-area-inset-top))` com `z-index: 10` para sobrepor corretamente o conteúdo da lista ao fazer scroll, respeitando o header fixo de 44px.

**`window.setTimeout(..., 0)` para busca inicial:** Padrão estabelecido em `useRankingRealtime.ts` para evitar o erro de lint `react-hooks/set-state-in-effect` — o `void fetchAll()` dentro do `useEffect` aciona setters de estado de forma assíncrona via `setTimeout(fn, 0)`, não diretamente no corpo do effect.

---

## Pontos de atenção para o Revisor

1. **Escopo de jogos no hook:** O hook busca todos os jogos `live` e `finished`, incluindo os de grupos diferentes. As queries de `predictions` e `scores` filtram por `group_id`, mas `games` não tem `group_id`. Isso é correto — jogos são globais; apenas palpites e scores são por grupo.

2. **Tab bar em 320px:** Com 5 elementos (`EU`, `JOGOS`, `PALPITES`, `RANKING`, `MAIS`), cada item tem ~64px em tela de 320px. "PALPITES" tem 8 caracteres — o maior label. Com `fontSize: 12px` e `letterSpacing: 0.04em`, ocupa ~75px medidos; a `flex: 1` distribui igualmente e pode comprimir. Verificar em dispositivo real ou devtools 320px se o label não trunca.

3. **Animação FLIP e accordion:** Quando o accordion de um participante está expandido e o ranking reordena, o FLIP anima o wrapper `<div ref={getRowRef}>` que contém tanto a linha principal quanto o accordion. Isso é correto — a posição absoluta do wrapper muda, não apenas a linha. Verificar se a altura expandida não causa saltos visuais inesperados durante a animação.

4. **`isFirstRender` em `PalpitesRanking`:** A ref `isFirstRender` garante que a animação FLIP não rode no primeiro render. Porém, se o componente receber `rankingWithDetails` não-vazio já no primeiro render (SSR hydration), o FLIP vai capturar posições iniciais corretamente e não animar — comportamento esperado.

5. **Sem `useCallback` em `fetchAll`:** A função `fetchAll` é definida dentro do `useEffect` implicitamente via closure sobre `groupId` e `currentUserId`. Isso é intencional — o `useEffect` recria `fetchAll` sempre que `groupId` ou `currentUserId` mudam, garantindo que o polling use sempre os valores mais recentes.

---

---

## Correções Fix 1

### Problema corrigido

**`useLayoutEffect` trocado por `useEffect` no `NextUpdateCountdown`** (`components/bolao/PalpitesRanking.tsx`, linha 314).

`useLayoutEffect` é reservado para leituras e mutações síncronas do DOM antes da pintura do browser. Usar esse hook para configurar um `setInterval` (subscrição assíncrona) era semanticamente incorreto. Substituído por `useEffect`, que é o hook correto para efeitos colaterais com timers/subscrições.

O `useLayoutEffect` na linha 44 (animação FLIP — leitura de `getBoundingClientRect` e aplicação de `transform` síncronos) permanece inalterado, pois seu uso é correto.

O import do React foi atualizado para incluir `useEffect` ao lado de `useLayoutEffect` (ambos ainda usados no arquivo).

---

## Commits realizados

```
3bde48b fix(palpites-ao-vivo): substitui useLayoutEffect por useEffect no NextUpdateCountdown
ec16814 feat(palpites-ao-vivo): adiciona item PALPITES na tab bar entre JOGOS e RANKING
3c5d6ee feat(palpites-ao-vivo): cria página /palpites com server component e seção client
6d88c78 feat(palpites-ao-vivo): cria componente PalpitesRanking com animação FLIP
0b1352e feat(palpites-ao-vivo): cria componente PalpitesRankingRow com accordion de breakdown
5dc3cb9 feat(palpites-ao-vivo): cria componente PalpitesLiveCard para jogos ao vivo
c2b49cb feat(palpites-ao-vivo): cria hook usePalpitesAoVivo com polling de 10 segundos
31b132e chore(palpites-ao-vivo): adiciona plano de implementação
```
