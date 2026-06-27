# Changelog: Redesign da Navegação (Abas)

**Slug:** nav-redesign
**Branch:** feature/nav-redesign
**Data:** 2026-06-27
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/ChatBottomSheet.tsx` — novo componente bottom sheet para o chat do grupo. Implementa lazy-mount do `ChatPanelContent` (montado na primeira abertura, nunca desmontado), drag handle com swipe-to-close (threshold 60px), backdrop com click-to-close, handler de ESC, trava de scroll do body e animação slide-up idêntica ao `GameAnaliseDrawer` (posição, dimensões, borderRadius e transição CSS).

- `components/bolao/TabBar.tsx` — reordenação das abas para EU | RANKING | PALPITES | CHAT | MAIS. A aba JOGOS foi removida. CHAT é um `<button>` (não Link) que abre o `ChatBottomSheet`. Badge de não lidas (`color-accent` / `color-bg`, 14px) aparece no canto superior direito do botão CHAT quando `chatOpen === false && chatUnreadCount > 0`. Com `groupId === ''`, o botão CHAT tem cursor default e não abre drawer. Adicionada nova interface de props: `groupId`, `currentUserId`, `activeGroupName`.

- `app/(dashboard)/layout.tsx` — passa as três novas props para `<TabBar>`: `groupId={activeGroup?.id ?? ''}`, `currentUserId={user.id}` e `activeGroupName={activeGroup?.name ?? ''}`.

- `components/bolao/SidePanelContainer.tsx` — removidos: pull tab CHAT, painel CHAT, import de `ChatPanelContent`, estados `chatEverOpened` e `chatUnreadCount`, callback `handleUnreadCountChange`, `useEffect` de lazy-mount do chat, `showChatTab`, chave `chat` de `panelTitles`. Tipo `PanelId` simplificado de `'recap' | 'live' | 'chat' | null` para `'recap' | 'live' | null`. `overflowY` do container de conteúdo simplificado para `'auto'` fixo. O parâmetro `activeGroupName` foi mantido na interface mas não é mais usado internamente (poderia ser removido, mas mantém retrocompatibilidade).

---

## Decisões técnicas

**`ChatBottomSheet` dentro do DOM da `TabBar`:** A spec orienta renderizar o `ChatBottomSheet` no return da `TabBar`. Como o componente usa `position: fixed`, o posicionamento é relativo ao viewport, não ao ancestral. Nenhum ancestral usa `transform`/`perspective`/`filter`, portanto a renderização no DOM da TabBar é correta e não cria contexto de stacking problemático.

**`Promise.resolve().then()` no useEffect de abertura:** Padrão já estabelecido no `GameAnaliseDrawer` para evitar o erro de lint `react-hooks/set-state-in-effect` ao chamar múltiplos `setState` dentro de um effect. A microtask garante que os estados sejam aplicados fora do ciclo de commit do React.

**`everOpened` como state (não ref):** Precisamos que a condição `{everOpened && <ChatPanelContent />}` no JSX force uma re-renderização ao se tornar `true`. Se fosse um ref, a mudança não disparia render e o `ChatPanelContent` não seria montado.

**Remoção do `activeGroupName` da lista de parâmetros usados no `SidePanelContainer`:** O parâmetro ainda está na interface pois o caller (`layout.tsx`) continua passando-o. Como a spec não instrui remover do caller, manteve-se a assinatura compatível para evitar TS error — o parâmetro simplesmente não é mais utilizado internamente.

---

## Pontos de atenção para o Revisor

1. Verificar se a ordem das abas está exatamente EU | RANKING | PALPITES | CHAT | MAIS no mobile (375px) sem truncamento.
2. Confirmar que o `ChatBottomSheet` abre com as mesmas dimensões do `GameAnaliseDrawer`: `bottom: calc(52px + env(safe-area-inset-bottom))`, `left: calc(28px + 1.5rem)`, `right: 1.5rem`, `maxHeight: 72vh`, `borderRadius: 8px 8px 0 0`.
3. Verificar que a subscription Realtime do `ChatPanelContent` não é duplicada entre aberturas (lazy-mount garante uma única montagem).
4. Confirmar que os painéis ONTEM e AO VIVO do `SidePanelContainer` funcionam sem regressão.
5. Verificar que a rota `/jogos` continua existindo e acessível via URL direta.
6. Confirmar que `npm run build` e `npm run lint` não apresentam erros novos (houve redução de 6 para 5 erros — todos os erros remanescentes são pré-existentes).

---

## Commits realizados

```
1afc642 fix(nav-redesign): usa Promise.resolve().then() para evitar setState síncrono no useEffect
55138a0 feat(nav-redesign): remove pull tab CHAT e painel CHAT do SidePanelContainer
d6d8b2f feat(nav-redesign): passa groupId, currentUserId e activeGroupName para TabBar no layout
c05aab0 feat(nav-redesign): reordena tab bar (EU, RANKING, PALPITES, CHAT, MAIS) e adiciona badge de não lidas
ec5c9c2 feat(nav-redesign): cria ChatBottomSheet com lazy-mount, swipe-to-close e animação slide-up
e52df2c chore(nav-redesign): adiciona plano de implementação
```
