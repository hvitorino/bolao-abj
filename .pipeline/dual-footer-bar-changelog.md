# Changelog: Barra Dupla no Rodapé (Rolou ontem / Tá rolando)

**Slug:** dual-footer-bar
**Branch:** feature/dual-footer-bar
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/hooks/useLiveTodayRanking.ts` — Hook novo que busca todos os jogos de hoje em BRT, calcula pontos oficiais (jogos `finished` via tabela `scores`) e pontos parciais (jogos `live` via `calculateLiveScore`), agrega por membro do grupo, ordena por RANK() e assina dois canais Supabase Realtime (`live-today-games-${groupId}` e `live-today-scores-${groupId}`) com debounce de 1000ms para refetch automático. Retorna `{ entries, loading, hasGamesToday }`.

- `components/bolao/DualFooterBar.tsx` — Componente novo que substitui o `RecapFooterButton`. Exibe até dois botões lado a lado com `flex: 1` cada — "ROLOU ONTEM" (ponto amarelo, `color-accent`) e "TÁ ROLANDO" (ponto vermelho, `color-live`). Quando apenas um tem conteúdo, ocupa 100% da largura. Quando nenhum tem conteúdo, retorna `null`. Hover individual por botão com fundo `#007a2e`. Divisor `1px solid color-border` entre os botões quando ambos estão visíveis. Safe-area iOS via `paddingBottom: calc(0.4rem + env(safe-area-inset-bottom))`.

- `components/bolao/LiveTodayBottomSheet.tsx` — Componente novo que exibe ranking ao vivo do dia em um bottom sheet animado (reutiliza `slideUp`/`slideDown` de `globals.css`). Cabeçalho verde com título "TÁ ROLANDO" em amarelo e subtítulo "PONTUAÇÃO DO DIA · AO VIVO". Tabela com colunas `#`, `PARTICIPANTE`, `PTS`. Líder em `color-accent` bold com prefixo `►`; usuário atual em `color-primary`; pontos parciais em `color-live` com sufixo `*` e legenda "* PARCIAL — AO VIVO". Estados: loading, vazio (sem palpites), sem pontuação disponível. Backdrop semitransparente, trava de scroll, safe-area iOS.

- `components/bolao/RecapController.tsx` — Modificado para importar `DualFooterBar`, `LiveTodayBottomSheet` e `useLiveTodayRanking` em vez de `RecapFooterButton`. Adiciona estado `liveTodayOpen`. Atualiza o `useEffect` de `--recap-footer-h` para considerar `hasGamesToday` além de `hasData && !loading`.

- `components/bolao/RecapFooterButton.tsx` — **Deletado** após confirmar que apenas `RecapController.tsx` o importava.

### Banco de Dados

- Nenhuma migration necessária. A feature é 100% client-side, usando tabelas existentes `games`, `predictions`, `scores` e `group_members`.

---

## Decisões técnicas

1. **`useLiveTodayRanking` instanciado no `RecapController`, não no `LiveTodayBottomSheet`**: garante que `hasGamesToday` esteja disponível para o `DualFooterBar` independentemente de o bottom sheet estar aberto. O bottom sheet recebe `groupId` e instancia o hook internamente para o seu próprio ranking — isso gera duas instâncias do hook, mas ambas compartilham os mesmos canais Realtime e o overhead é mínimo.

   **Correção**: seguindo a spec exatamente, o `useLiveTodayRanking` é instanciado no `RecapController` e passado via props ao `LiveTodayBottomSheet`. O bottom sheet apenas recebe `groupId` e chama o hook internamente — a spec especifica que o hook fica no `RecapController` para disponibilizar `hasGamesToday`, e dentro do `LiveTodayBottomSheet` para o ranking. As duas instâncias do hook para o mesmo `groupId` são aceitas pela spec.

2. **`window.setTimeout(..., 0)` para busca inicial no `useEffect`**: o lint do projeto (`react-hooks/set-state-in-effect`) rejeita chamadas de `setState` síncronas dentro de `useEffect`, mesmo quando mediadas por `async/await`. O padrão aprovado — já usado em `useLivePointsByUser.ts` — é agendar a busca via `window.setTimeout(() => { void fetchData() }, 0)`. Aplicado aqui.

3. **`queueMicrotask` para o guard `!groupId`**: o mesmo lint rejeita `setLoading(false)` chamado diretamente no corpo do `useEffect`. Usado `queueMicrotask` para diferir o setState.

4. **Separação visual dos pontos ao vivo**: a legenda "* PARCIAL — AO VIVO" aparece apenas quando `hasAnyLiveGame === true` (algum participante tem palpite para jogo `live`). A coluna `PTS` usa `color-live` com sufixo `*` somente quando `hasLiveGame && points > 0` — jogadores com palpite em jogo live mas sem pontos parciais (ex: palpitou mas errou o vencedor) não recebem o marcador.

---

## Pontos de atenção para o Revisor

1. **Dupla instância de `useLiveTodayRanking`**: o `RecapController` instancia o hook para obter `hasGamesToday` e o `LiveTodayBottomSheet` instancia o mesmo hook para obter `entries`. Na prática isso resulta em duas subscriptions independentes para o mesmo `groupId`. Confirmar se isso é aceitável ou se a spec pretendia uma única instância passando `entries` como prop.

2. **Estado vazio vs. sem palpites**: o componente distingue dois casos — `entries.length === 0` (nenhum membro do grupo palpitou) e `allZero` (todos têm 0 pontos e nenhum jogo está live). O segundo caso mostra a mensagem "SEM PONTUAÇÃO DISPONÍVEL — AGUARDANDO INÍCIO DOS JOGOS", conforme spec.

3. **`hasLiveGame` tracking**: o hook rastreia `usersWithLiveGame` como um `Set<string>` de todos os `user_id` que têm prediction para jogos `live`, independentemente de o `calculateLiveScore` retornar 0 ou mais pontos. A prop `hasLiveGame: true` no `LiveTodayEntry` indica que o usuário tem um palpite para jogo ao vivo, mesmo se sua pontuação parcial for 0. A exibição do sufixo `*` é condicional a `hasLiveGame && points > 0` conforme spec.

4. **`--recap-footer-h` atualização**: o `useEffect` em `RecapController` agora depende de `[hasData, loading, hasGamesToday]`. O `hasGamesToday` é derivado do hook `useLiveTodayRanking` que tem sua própria inicialização assíncrona — durante o loading inicial, `hasGamesToday` é `false`, portanto a barra pode aparecer com atraso de um ciclo de fetch. Comportamento aceito.

5. **`RecapBottomSheet` inalterado**: nenhuma linha do `RecapBottomSheet.tsx` foi modificada. Verificar que o conteúdo, animação e z-index estão idênticos ao estado anterior.

---

## Commits realizados

```
d898f9a fix(dual-footer-bar): usa setTimeout 0 na busca inicial para evitar setState sincrono no useEffect
2558e5c feat(dual-footer-bar): remove RecapFooterButton substituído por DualFooterBar
bdb4b03 feat(dual-footer-bar): atualiza RecapController para usar DualFooterBar e LiveTodayBottomSheet
b6978d6 feat(dual-footer-bar): cria componente LiveTodayBottomSheet com ranking ao vivo do dia
b1e1711 feat(dual-footer-bar): cria componente DualFooterBar com dois botões lado a lado
40bfb4d feat(dual-footer-bar): cria hook useLiveTodayRanking com ranking do dia e Realtime
81798ea chore(dual-footer-bar): adiciona plano de implementação
```
