# Changelog: Modo Acompanhar

**Slug:** modo-acompanhar
**Branch:** feature/modo-acompanhar
**Data:** 2026-06-27
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/AcompanharToggle.tsx` — Botão toggle de dois estados (outline "◉ ACOMPANHAR" vs preenchido "● ACOMPANHANDO"). Usa `flex: 1` para ocupar metade da linha junto com o CompartilharButton. Cor primária (#009c3b) como borda sempre; fundo preenchido apenas quando ativo.

- `components/bolao/CompartilharButton.tsx` — Extração da lógica de cópia de link que estava embutida em `palpites-live-section.tsx`. Copia `origin/publico/:groupId/:selectedDate`, exibe feedback "✓ COPIADO!" por 2s em `var(--color-win)`. Nunca tem estado "ativo" — sempre borda `color-border` e cor `color-muted`.

- `components/bolao/AcompanharCarrossel.tsx` — Carrossel horizontal de mini-cards (80px mínimo, `overflow-x: auto`, `scrollbar-width: none`). Cada card exibe horário em BRT, códigos de time, placar e label de status em um de 4 estados:
  - `em-breve` — placar `×` em cinza, label "EM BREVE"
  - `ao-vivo` — placar `N×N` em accent, borda `2px solid var(--color-live)`, label "● AO VIVO"
  - `final` — placar `N×N` em muted, label "FINAL"
  - `pontuado` — placar `N×N` em accent, label `+N PTS` em `var(--color-win)` (>0) ou `+0` em muted (0)
  - A distinção entre `final` e `pontuado` usa `officialPoints !== null && !== undefined` (não apenas `> 0`)

- `components/bolao/AcompanharRanking.tsx` — Tabela estática de ranking do dia. Sem accordion, sem animação FLIP. Indicadores: `► ` em accent para líder, `■ ` em primary para usuário atual. Linha do usuário com `backgroundColor: rgba(0,151,59,0.08)`. Asterisco `*` em `var(--color-live)` após pontos quando `hasLivePoints`. Estados de loading (3 linhas esqueleto) e vazio ("NENHUM PARTICIPANTE").

- `app/(dashboard)/palpites/palpites-live-section.tsx` — Adicionados:
  - Estado `viewMode` inicializado via `sessionStorage.getItem('palpites_mode')`
  - `useEffect` para persistir `viewMode` no sessionStorage a cada mudança
  - `useRef(groupId)` + `useEffect([groupId])` para resetar para `preencher` e limpar sessionStorage ao trocar de grupo
  - Substituição do botão único "⎘ COPIAR LINK DO DIA" pela `div flex` com `AcompanharToggle` + `CompartilharButton`
  - `PalpitesLiveCard` condicional apenas no modo Preencher (dentro do sticky header)
  - Renderização condicional: modo Preencher → `PalpitesRanking`; modo Acompanhar → `AcompanharCarrossel` + `AcompanharRanking`
  - Cálculo de `currentUserGameScores` a partir de `rankingWithDetails.find(userId)?.games`

### CSS

- `app/globals.css` — Adicionada regra `.acompanhar-carrossel::-webkit-scrollbar { display: none }` para ocultar scrollbar em navegadores webkit, complementando o `scrollbar-width: none` inline que cobre Firefox.

### Banco de Dados

Sem alterações — todos os dados necessários já estavam disponíveis via `games`, `predictions`, `scores` e `group_members`.

---

## Decisões técnicas

- **`overflow-x: auto` em vez de `scroll`**: garante que quando os mini-cards cabem na tela, o carrossel não exibe barra de scroll nem comportamento de arraste involuntário.
- **Sem `transition` no AcompanharToggle**: a spec pede transição instantânea entre os estados visuais; isso evita flash/glitch ao comutar rapidamente.
- **`useRef` para detectar mudança de groupId**: `useEffect([groupId])` com `prevGroupId.current !== groupId` isola exatamente a mudança de grupo sem disparar na montagem inicial.
- **Índice por `gameId`**: `AcompanharCarrossel` constrói `scoreByGameId` localmente para lookup O(1) ao iterar jogos — sem prop drilling de índice.
- **`GameAnaliseDrawer` mantido na seção**: permanece montado em ambos os modos, mas `selectedGameId` só é setado via `PalpitesLiveCard` (visível apenas no modo Preencher), portanto o drawer nunca abre no modo Acompanhar.

---

## Pontos de atenção para o Revisor

1. **Estado `pontuado` vs `final`**: verificar que `officialPoints === 0` exibe `+0` (pontuado) e `officialPoints === null` exibe `FINAL`.
2. **Reset por grupo**: testar trocar de grupo ativo e confirmar que `viewMode` volta para `preencher`.
3. **Persistência por data**: trocar a data selecionada e confirmar que o modo escolhido é mantido.
4. **PalpitesLiveCard oculto no modo Acompanhar**: confirmar que o sticky header fica mais curto no modo Acompanhar (sem o strip de mini-cards) e o conteúdo principal é carrossel + ranking.
5. **Sem regressão no modo Preencher**: `PalpitesLiveCard` clicável e `GameAnaliseDrawer` abrindo normalmente.
6. **TypeScript**: `npx tsc --noEmit` retornou zero erros.

---

## Commits realizados

```
506a586 feat(modo-acompanhar): integra toggle, carrossel e ranking na palpites-live-section
896e93b feat(modo-acompanhar): adiciona regra CSS para ocultar scrollbar do carrossel
9e13d61 feat(modo-acompanhar): cria componente AcompanharRanking com tabela simples do dia
a9775e2 feat(modo-acompanhar): cria componente AcompanharCarrossel com mini-cards e 4 estados
799baf8 feat(modo-acompanhar): cria componente CompartilharButton
dc2878c feat(modo-acompanhar): cria componente AcompanharToggle
5bcae76 chore(modo-acompanhar): adiciona plano de implementação
```
