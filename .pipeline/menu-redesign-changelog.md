# Changelog: Redesign da Navegação (Header + Tab Bar + Pull Tabs)

**Slug:** menu-redesign
**Branch:** feature/menu-redesign
**Data:** 2026-06-22
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/TabBar.tsx` — tab bar fixa no rodapé com 4 itens: CAMPANHA, JOGOS, RANKING e MAIS. O botão MAIS abre popover para cima com links GRUPOS, REGRAS e CONFIG. Item ativo exibe `borderTop: 2px solid var(--color-primary)` e cor `color-primary`. Fonte 13px JetBrains Mono uppercase. Altura de conteúdo 52px + `env(safe-area-inset-bottom)`. Fecha o popover ao clicar fora via `useEffect/mousedown`.

- `components/bolao/RecapPanelContent.tsx` — conteúdo do painel ONTEM (antes era `RecapBottomSheet`). Exibe mensagem lúdica, cards de jogos de ontem, tabela de ranking do dia e destaques (badges). Sem wrapper de `position: fixed`, backdrop ou animação — apenas o conteúdo scrollável. Cabeçalho gerenciado pelo `SidePanelContainer`.

- `components/bolao/LiveTodayPanelContent.tsx` — conteúdo do painel AO VIVO (antes era `LiveTodayBottomSheet`). Exibe cards de jogos de hoje, tabela de ranking ao vivo e legenda de pontos parciais. Sem wrapper de posicionamento.

- `components/bolao/ChatPanelContent.tsx` — conteúdo do chat (antes era `GroupChatWidget`). Mantém toda a lógica: subscription Realtime em `group_messages`, carregamento lazy de mensagens, envio, `unreadCount` exposto via `onUnreadCountChange`, scroll automático ao `isVisible` mudar para `true`. Sem chip flutuante e sem drag.

- `components/bolao/SidePanelContainer.tsx` — orquestrador dos pull tabs e do painel lateral. Gerencia:
  - Pull tab ONTEM (`color-accent`, visível apenas quando `!loading && hasData`)
  - Pull tab AO VIVO (`color-live` com animação `blink`, visível apenas quando `hasGamesToday`)
  - Pull tab CHAT (`color-primary`, sempre visível; exibe badge de não-lidas)
  - Painel lateral: `85vw`, `translateX(0/100%)` com `transition 250ms ease-out/in`
  - Backdrop transparente que fecha o painel ao clicar
  - Cabeçalho do painel com título e `[ FECHAR ]`
  - Abertura automática do recap (localStorage `bolao_recap_YYYY-MM-DD`)
  - Lazy-mount do `ChatPanelContent` (montado na primeira abertura, nunca desmontado)

- `app/(dashboard)/layout.tsx` — refatorado:
  - Header de uma linha (44px de conteúdo + `env(safe-area-inset-top)`): logo `BOLÃO DA COPA` + `GroupMenu`
  - Removidos: `NavLinks`, `GroupChatWidget`, `RecapController`
  - `paddingTop` do `<main>`: `calc(44px + env(safe-area-inset-top) + 1.5rem)`
  - `paddingBottom` do `<main>`: `calc(52px + env(safe-area-inset-bottom) + 1.5rem)` — sempre aplicado
  - Adicionados: `<TabBar />` e `<SidePanelContainer groupId currentUserId activeGroupName />` (quando `activeGroup` existir)

- `app/(dashboard)/group-switcher.tsx` — `fontSize` do objeto `MONO` alterado de `11px` para `13px`.

### Componentes não mais renderizados no layout (arquivos mantidos no repositório)

- `DualFooterBar.tsx` — substituído pelos pull tabs ONTEM e AO VIVO
- `RecapController.tsx` — lógica absorvida pelo `SidePanelContainer`
- Chip flutuante de `GroupChatWidget.tsx` — substituído pelo pull tab CHAT
- `nav-links.tsx` — não mais importado pelo layout

---

## Decisões técnicas

**Cabeçalho do painel no SidePanelContainer:** A spec indica que cada `PanelContent` deveria ter um cabeçalho interno com `[ FECHAR ]`. No entanto, o `SidePanelContainer` já gerencia o cabeçalho do painel (título dinâmico + botão FECHAR) para todos os painéis de forma uniforme. Manter o cabeçalho nos `PanelContent` geraria duplicação. A decisão foi centralizar o cabeçalho no `SidePanelContainer` e remover o cabeçalho interno dos `PanelContent`. A prop `onClose` foi mantida na interface (prefixada com `_` na implementação) para compatibilidade futura.

**Overflow do painel do chat:** O `ChatPanelContent` usa `display: flex; flex-direction: column; height: 100%` internamente. O container pai no `SidePanelContainer` usa `overflow-y: hidden` quando o painel de chat está aberto, para que o scroll seja gerenciado internamente pelo chat. Os outros painéis (recap, live) usam `overflow-y: auto` no container.

**Prop `activeGroupName` no layout:** A spec não previa essa prop explicitamente, mas o `SidePanelContainer` precisa do nome do grupo para exibir no cabeçalho do painel de chat ("CHAT — NOME DO GRUPO"). A prop foi adicionada ao `SidePanelContainer` com valor padrão `''`.

**CSS custom properties `--header-h` e `--tabbar-h`:** A spec sugeria defini-las no `<html>`. Para simplicidade, os componentes usam os valores via `var(--header-h, 44px)` e `var(--tabbar-h, 52px)` com fallback inline — sem necessidade de injetar as variáveis via JavaScript no `layout.tsx`.

---

## Pontos de atenção para o Revisor

1. **Pull tabs: ordem e bordas** — as bordas superior/inferior dos pull tabs são condicionais dependendo de quais abas estão visíveis. Verificar se as bordas se comportam corretamente quando apenas CHAT é visível (sem ONTEM e sem AO VIVO).

2. **Animação `blink` no pull tab AO VIVO** — o `@keyframes blink` é definido em `globals.css`. Confirmar que o keyframe já existe e está disponível globalmente; caso contrário, precisaria ser injetado via `<style>` no componente.

3. **Lazy-mount do chat** — o `ChatPanelContent` é renderizado com `display: none` quando `openPanel !== 'chat'`. Confirmar que a subscription Realtime continua ativa mesmo com `display: none` (deve continuar, pois o componente está montado).

4. **`nav-links.tsx` não importado** — o arquivo existe em `app/(dashboard)/nav-links.tsx` mas não é mais referenciado em nenhum componente ativo. O Revisor deve confirmar que não há outras importações do arquivo na codebase.

5. **Compatibilidade com `DualFooterBar`** — o `DualFooterBar` ainda existe em `components/bolao/DualFooterBar.tsx`. O `RecapController` não é mais renderizado, mas ambos os arquivos permanecem no repositório. O Revisor deve decidir se os arquivos devem ser removidos ou mantidos como referência.

6. **`meus-palpites` não está na TabBar** — o item PALPITES que estava no `NavLinks` foi omitido da `TabBar` conforme a spec (que não o lista nos 3 itens principais). Confirmar se isso está correto com base na spec.

---

## Commits realizados

```
3bfd88f fix(menu-redesign): remove cabeçalho duplicado dos painéis (gerenciado pelo SidePanelContainer)
1effee1 feat(menu-redesign): aumenta fontSize do GroupMenu de 11px para 13px
3050a36 feat(menu-redesign): refatora layout para header de uma linha, TabBar e SidePanelContainer
ddac20b feat(menu-redesign): cria SidePanelContainer com pull tabs e painel lateral deslizante
0115436 feat(menu-redesign): cria ChatPanelContent extraído do GroupChatWidget sem chip flutuante
bd95449 feat(menu-redesign): cria LiveTodayPanelContent extraído do LiveTodayBottomSheet
bf747a3 feat(menu-redesign): cria RecapPanelContent extraído do RecapBottomSheet
717b8d5 feat(menu-redesign): cria TabBar com 4 itens e popover MAIS para cima
80ddb9b chore(menu-redesign): adiciona plano de implementação
```
