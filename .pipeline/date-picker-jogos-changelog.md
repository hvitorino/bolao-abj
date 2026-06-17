# Changelog: Seletor de Datas com Jogos

**Slug:** date-picker-jogos
**Branch:** feature/date-picker-jogos
**Data:** 2026-06-17
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)
- Nenhuma alteração. Sem endpoints novos.

### Frontend (Next.js/React)

- `lib/date.ts` — adicionada função `matchDateToLocalDate(isoUtcString: string): string`, que converte um `timestamptz` UTC para data local BRT (`YYYY-MM-DD`) via `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. Coerente com `todayInBrasilia()` e `dayBoundsInUTC()` já existentes.

- `app/(dashboard)/jogos/page.tsx` — as duas queries (jogos do dia + todas as datas com jogos) agora são executadas em paralelo via `Promise.all`. `availableDates` é calculado convertendo cada `match_date` para BRT e deduplicando com `Set`, resultando em array ordenado `YYYY-MM-DD[]`. O array é passado como prop `availableDates` para `DayNavigator`.

- `components/games/DayNavigator.tsx` — componente reescrito com as seguintes adições:
  - Interface `DayNavigatorProps` estendida com `availableDates: string[]`
  - Container raiz recebe `position: 'relative'` para âncora do dropdown absoluto
  - O `<span>` estático da data foi convertido em `<button>` com `aria-haspopup="listbox"` e `aria-expanded`, mantendo exatamente o mesmo visual (transparente, sem borda, fonte monospace, cor baseada em `isToday`)
  - Indicador `▼`/`▲` em `color-muted` exibido após o texto da data
  - Dropdown com `position: absolute`, `top: 100%`, `border: 1px solid var(--color-border)`, `borderTop: none`, `maxHeight: 240px`, `overflowY: auto`, `boxShadow: none`, `borderRadius: 0`
  - Lista `<ul role="listbox">` com cada item `<li role="option" aria-selected>` exibindo `formatDateDisplay(date)` em uppercase
  - Data atual destacada em `color-accent bold`; item com foco por teclado destacado em `background: color-secondary`
  - Fechar ao clicar fora via `mousedown` listener no `document` (apenas quando aberto)
  - Scroll automático via `scrollIntoView({ block: 'nearest' })` observando `focusedIndex`
  - Função `openPicker()` abre o dropdown e define `focusedIndex` na data atual (ou 0)
  - Função `closePicker(returnFocus?)` fecha o picker e reseta `focusedIndex`, opcionalmente devolvendo foco ao trigger
  - Navegação por teclado completa: `ArrowDown`/`ArrowUp` com wrap, `Enter` para navegar, `Escape` para fechar e voltar foco, `Tab` para fechar sem travar foco nativo
  - Setas `◀ ▶` existentes sem alteração

### Banco de Dados
- Nenhuma migration ou tabela nova. As datas disponíveis são derivadas de `SELECT match_date FROM games` já existente.

---

## Decisões técnicas

**Sem useEffect para reset de focusedIndex:** A spec sugeria um `useEffect` que observava `isPickerOpen` para resetar `focusedIndex`. O linter React (regra `react-hooks/set-state-in-effect`) proíbe `setState` síncrono no body de um `useEffect`. A solução foi centralizar o fechamento na função `closePicker(returnFocus?)`, que executa `setIsPickerOpen(false)` e `setFocusedIndex(-1)` juntos, eliminando a necessidade do effect. O `useEffect` do click-fora também foi atualizado para chamar ambos os setters dentro do callback do evento (que é permitido).

**Promise.all para a query de datas:** A query `SELECT match_date FROM games` é independente da query de jogos do dia. Colocá-las em `Promise.all` reduz a latência do Server Component sem complicar o código.

**Deduplicação no cliente:** A spec define deduplicação via `Set` no frontend após converter cada `match_date` para BRT. Isso é correto porque dois jogos no mesmo dia BRT podem ter `match_date` UTC distintos (ex: 00:00Z e 01:00Z ambos são o mesmo dia BRT), e `SELECT DISTINCT` no Supabase operaria sobre UTC bruto.

---

## Pontos de atenção para o Revisor

1. **Erro preexistente no lint:** `group-switcher.tsx` tem erro de lint (`react-hooks/immutability` em `document.cookie = ...`) que já existia antes desta feature. Confirmado via `git stash` e reexecução do lint. Não é regressão introduzida aqui.

2. **Conversão de timezone:** Verificar que `matchDateToLocalDate('2026-06-12T00:00:00Z')` retorna `'2026-06-11'` (jogo às 21:00 BRT de 11/06 gravado em UTC como 12/06). A função usa `toLocaleDateString` com `timeZone: 'America/Sao_Paulo'`, idêntico a `todayInBrasilia()`.

3. **overflow: visible no container:** O container raiz do `DayNavigator` mudou de `overflow: 'hidden'` para `overflow: 'visible'` para permitir que o dropdown absoluto apareça fora dos limites do componente. Verificar se isso quebra algum layout pai.

4. **Acessibilidade:** `aria-activedescendant` aponta para `date-option-${focusedIndex}` no `<ul>`, e cada `<li>` recebe `id={date-option-${index}}`. Verificar conformidade com WAI-ARIA Listbox Pattern.

5. **Build e lint sem novos erros:** `npm run build` passou sem erros de TypeScript. `npm run lint` não introduz novos erros além dos preexistentes.

---

## Commits realizados

```
446401c feat(date-picker-jogos): adiciona date picker dropdown ao DayNavigator com navegação por teclado e acessibilidade
ec529b2 feat(date-picker-jogos): busca availableDates no JogosPage e passa para DayNavigator
8705ecb feat(date-picker-jogos): adiciona matchDateToLocalDate em lib/date.ts
28ed0c6 chore(date-picker-jogos): adiciona plano de implementação
```
