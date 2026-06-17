# Changelog: Navegação por Chips de Data

**Slug:** date-chips-nav
**Branch:** feature/date-chips-nav
**Data:** 2026-06-17
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/games/DateChipsNav.tsx` — novo componente cliente que substitui o `DayNavigator`. Renderiza uma faixa horizontal de chips `<button>`, um por data em `availableDates`. O chip da data ativa exibe `color-accent`, `font-weight: bold` e `border: 1px solid var(--color-accent)`. Chips inativos exibem `color-muted` com hover que altera cor para `color-text` e borda para `color-muted`. O scroll horizontal é livre (`overflow-x: auto`, `scrollbarWidth: none`) sem barra de scroll visível. Ao montar e a cada mudança de `currentDate`, um `useEffect` chama `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` no chip ativo via `activeChipRef`. A linha de contadores (`X JOGOS · Y PALPITES REGISTRADOS`) é preservada abaixo da faixa, separada por `padding-top: 0.5rem`. O estado vazio (`availableDates.length === 0`) exibe "SEM DATAS DISPONÍVEIS" em `color-muted`, 11px, uppercase.

- `app/globals.css` — adicionada regra `.date-chips-scroll::-webkit-scrollbar { display: none }` para ocultar a barra de scroll no webkit, complementando o `scrollbarWidth: none` já aplicado via style inline para Firefox.

- `app/(dashboard)/jogos/page.tsx` — trocado import de `DayNavigator` por `DateChipsNav`; substituída a JSX `<DayNavigator ... />` por `<DateChipsNav ... />` com as mesmas props (mesma ordem das propriedades do Server Component, sem alteração na lógica de busca de dados).

### Removido

- `components/games/DayNavigator.tsx` — arquivo deletado após substituição completa pelo `DateChipsNav`.

---

## Decisões técnicas

- **Hover via handlers inline (`onMouseEnter`/`onMouseLeave`):** A alternativa seria uma className com `:hover` em CSS global. Optou-se por handlers para manter o estado de cor acoplado à lógica de `isActive` no próprio botão, sem necessidade de uma classe CSS adicional ou variáveis de estado React.

- **`scrollbarWidth: none` via style inline + classe CSS webkit:** O `scrollbarWidth` é uma propriedade CSS padrão (Firefox/Chrome moderno) suportada como inline style em React. O pseudo-elemento `::-webkit-scrollbar` não pode ser aplicado via inline style, portanto exige uma classe CSS global (`date-chips-scroll`) em `globals.css`.

- **`useEffect` com `[currentDate]` como dependência:** Ao contrário de `[availableDates]`, a dependência em `currentDate` garante que o scroll seja disparado somente quando a data ativa muda — e não ao recarregar a lista toda (ex: em futuras integrações com Realtime).

- **Nenhuma alteração no Server Component:** A lógica de busca de `availableDates`, `guessCount` e `games` no `page.tsx` permanece intacta. O `DateChipsNav` é um leaf component de apresentação puro.

---

## Pontos de atenção para o Revisor

- Verificar se a regra `.date-chips-scroll::-webkit-scrollbar { display: none }` em `globals.css` está corretamente aplicada e não entra em conflito com outros componentes.
- Confirmar que o `scrollIntoView` com `inline: 'center'` centraliza corretamente o chip ativo sem deslocar o scroll vertical da página.
- Verificar o estado de `availableDates.length === 0` — atualmente a query sempre retorna datas pois os jogos já estão seeded, mas o estado vazio deve ser coberto.
- Os erros e warnings de lint pré-existentes (`group-switcher.tsx:48` erro de imutabilidade, warnings em `RankingTable.tsx` e `jogos/page.tsx`) não foram introduzidos por esta feature — confirmado via `git stash` + `npm run lint` na branch sem as mudanças.

---

## Commits realizados

```
772bbed feat(date-chips-nav): remove DayNavigator substituído por DateChipsNav
76e34d0 feat(date-chips-nav): substitui DayNavigator por DateChipsNav na página de jogos
9a89060 feat(date-chips-nav): cria componente DateChipsNav com faixa de chips e scroll automático
f982790 chore(date-chips-nav): adiciona plano de implementação
```
