# Spec: Navegação por Chips de Data

**Slug:** date-chips-nav
**Data:** 2026-06-17
**Status:** spec

---

## Objetivo

Substituir completamente o componente `DayNavigator` (dropdown + setas ◀ ▶) por uma faixa horizontal de chips clicáveis, onde cada chip representa uma data com jogos. A faixa suporta scroll horizontal em mobile. O chip da data ativa fica em destaque (`color-accent`, bold) e é automaticamente centralizado na viewport ao carregar.

---

## Histórias de Usuário

- Como participante do bolão, quero ver todas as datas com jogos de uma só vez para navegar diretamente para qualquer data sem precisar clicar em setas repetidamente.
- Como usuário mobile, quero deslizar horizontalmente pela faixa de chips sem ver barra de scroll para ter uma experiência limpa em tela pequena.
- Como usuário, quero que a data que estou vendo fique sempre visível e em destaque na faixa, sem precisar rolar manualmente.

---

## Modelo de Dados

Nenhuma tabela nova ou modificada. Nenhuma migration necessária.

As datas são derivadas de `games.match_date` (já existente), com a lógica de `matchDateToLocalDate()` já presente em `lib/date.ts` para converter UTC → BRT.

A query de `availableDates` já existe em `app/(dashboard)/jogos/page.tsx` e é repassada como prop — nenhuma alteração nessa lógica é necessária.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. Esta feature é puramente frontend.

---

## Frontend — Componentes React

### DateChipsNav

**Arquivo:** `components/games/DateChipsNav.tsx`

**Substitui:** `components/games/DayNavigator.tsx` (o arquivo antigo deve ser removido)

**Props:**

```typescript
interface DateChipsNavProps {
  currentDate: string      // YYYY-MM-DD — data ativa atualmente exibida
  availableDates: string[] // YYYY-MM-DD[] ordenado ASC — datas com pelo menos 1 jogo
  gameCount: number        // total de jogos no dia atual (exibido abaixo da faixa)
  guessCount: number       // palpites do usuário no dia atual (exibido abaixo da faixa)
}
```

**Estados:**

- `empty`: `availableDates` é vazio → exibe mensagem "SEM DATAS DISPONÍVEIS" em `color-muted`, 11px uppercase
- `populated`: exibe faixa de chips + linha de contadores

**Comportamento e lógica de UI:**

1. Faixa de chips (`<div>` com `overflow-x: auto`, `scrollbar-width: none`, `-webkit-overflow-scrolling: touch`):
   - Um `<button>` ou `<a>` por data em `availableDates`
   - Scroll horizontal livre; sem barra de scroll visível (CSS: `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`)
   - Não quebra em múltiplas linhas (`white-space: nowrap` no container, ou `flex-shrink: 0` em cada chip)

2. Cada chip:
   - Elemento: `<button>` (não `<a>`) com `onClick` que chama `router.push('/jogos?date=YYYY-MM-DD')`
   - `aria-current="true"` no chip ativo; ausente nos demais
   - Label: data formatada abreviada — `DD MMM` em uppercase (ex: `11 JUN`, `12 JUN`) — **não** o formato longo do DayNavigator
   - Chip ativo: `color: var(--color-accent)`, `font-weight: bold`, `border: 1px solid var(--color-accent)`, background `var(--color-surface)`
   - Chip inativo: `color: var(--color-muted)`, `font-weight: normal`, `border: 1px solid var(--color-border)`, background `var(--color-surface)`
   - Hover (chip inativo): `color: var(--color-text)`, `border-color: var(--color-muted)`
   - Sem `border-radius` (0px — conforme DESIGN.md)
   - Padding: `0.35rem 0.75rem`
   - Fonte: `JetBrains Mono`, 12px, uppercase, `letter-spacing: 0.05em`
   - `cursor: pointer`; `transition: color 0.1s, border-color 0.1s`

3. Scroll automático ao carregar (e ao mudar `currentDate`):
   - Cada chip ativo deve ter uma `ref` (`activeChipRef`)
   - Em `useEffect` com dependência `[currentDate]`: chamar `activeChipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })`
   - Isso centraliza o chip ativo na área visível da faixa sem afetar o scroll vertical da página

4. Navegação por teclado:
   - Chips são `<button>` nativos — tabulação sequencial funciona automaticamente
   - `Enter` / `Space` no chip ativo: não navega (já está na data)
   - `Enter` / `Space` em chip inativo: navega para a data
   - Não é necessário arrow-key roving (os chips são elementos focáveis individualmente via Tab)

5. Linha de contadores (abaixo da faixa, mesmo visual atual do DayNavigator):
   - `X JOGOS · Y PALPITES REGISTRADOS`
   - Fonte 11px, uppercase, `color-muted`; palpites em `color-primary` se `guessCount > 0`
   - Centralizado horizontalmente

**Container externo:**
```
border: 1px solid var(--color-border)
background: var(--color-surface)
font-family: 'JetBrains Mono', 'Courier New', monospace
padding: 0.75rem 1rem 0.5rem 1rem
```

A faixa de chips fica dentro do container. A linha de contadores fica dentro do container, abaixo da faixa, separada por `padding-top: 0.5rem` (sem border-top — diferentemente do DayNavigator atual que usa `borderBottom` entre as duas linhas).

**Formato da data no chip:**

Criar função interna `formatChipDate(dateStr: string): string`:
```typescript
function formatChipDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`)
  const day = date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit' })
  const month = date.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' })
  return `${day} ${month.replace('.', '').toUpperCase()}`
  // Ex: "11 JUN", "12 JUN", "19 JUL"
}
```

**Diretiva de cliente:**

O componente usa `useRouter` e `useEffect` — portanto deve ter `'use client'` no topo.

---

## Alterações em Arquivos Existentes

### `app/(dashboard)/jogos/page.tsx`

- Remover import de `DayNavigator`
- Adicionar import de `DateChipsNav`
- Substituir `<DayNavigator ... />` por `<DateChipsNav ... />` com as mesmas props:
  - `currentDate={currentDate}`
  - `availableDates={availableDates}`
  - `gameCount={games?.length ?? 0}`
  - `guessCount={guessCount}`
- O bloco `Promise.all` com a query de `allMatchDates` e o cálculo de `availableDates` permanecem **intactos** — a lógica de busca não muda

### `components/games/DayNavigator.tsx`

- **Deletar o arquivo** após criação e integração do `DateChipsNav`

---

## Regras de Negócio

- Apenas datas presentes em `availableDates` aparecem como chips. Esse array já é filtrado no Server Component (`page.tsx`) para conter somente datas com pelo menos 1 jogo.
- Clicar em qualquer chip navega para `/jogos?date=YYYY-MM-DD` — o mecanismo de URL existente permanece inalterado.
- O chip da data ativa é determinado por comparação direta `date === currentDate` (string YYYY-MM-DD).
- Não há lógica de deadline, scoring ou autenticação neste componente — responsabilidade exclusivamente de navegação visual.

---

## Proteção de Rotas

Nenhuma alteração. A rota `/jogos` já é protegida pelo Server Component (`page.tsx` redireciona para `/login` se não há `authUser`). O `DateChipsNav` é um componente de apresentação puro, sem lógica de autenticação.

---

## Integração Supabase Realtime

Nenhuma. Este componente não usa canais Realtime.

---

## Critérios de Aceite

- [ ] O componente `DayNavigator` (arquivo `components/games/DayNavigator.tsx`) foi removido do projeto
- [ ] O componente `DateChipsNav` foi criado em `components/games/DateChipsNav.tsx`
- [ ] A página `/jogos` importa `DateChipsNav` em vez de `DayNavigator`
- [ ] Apenas datas presentes em `availableDates` aparecem como chips (mesmo critério já usado)
- [ ] O chip da data ativa exibe `color-accent` e `font-weight: bold`
- [ ] Os chips inativos exibem `color-muted` e `font-weight: normal`
- [ ] Ao carregar a página com qualquer data ativa, o chip correspondente é automaticamente centralizado na faixa via `scrollIntoView`
- [ ] A faixa suporta scroll horizontal sem barra de scroll visível (testado em viewport 375px)
- [ ] Clicar em um chip inativo navega para `/jogos?date=YYYY-MM-DD` da data correspondente
- [ ] Chips são elementos `<button>` com `aria-current="true"` no chip ativo
- [ ] Navegação por Tab entre chips funciona corretamente
- [ ] Fonte exclusivamente JetBrains Mono; nenhum `border-radius`; sem sombras
- [ ] Linha de contadores (X JOGOS · Y PALPITES) preservada abaixo da faixa
- [ ] Design segue DESIGN.md (paleta verde/amarelo/azul, monospace, dense, sem ícones decorativos)
- [ ] Funciona em mobile (coluna única, scroll horizontal suave)
- [ ] `npm run build` passa sem erros de TypeScript
- [ ] `npm run lint` não introduz novos erros
