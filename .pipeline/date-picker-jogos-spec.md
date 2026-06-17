# Spec: Seletor de Datas com Jogos

**Slug:** date-picker-jogos
**Data:** 2026-06-17
**Status:** spec

---

## Objetivo

Ao clicar na data exibida no `DayNavigator` (ex: "SÁBADO, 13 JUN 2026"), abrir um dropdown listando apenas as datas que possuem pelo menos um jogo cadastrado no Supabase, permitindo navegação direta a qualquer data sem clicar seta a seta. As setas `◀ ▶` existentes continuam funcionando sem alteração.

---

## Histórias de Usuário

- Como participante do bolão, quero clicar na data exibida no DayNavigator para ver uma lista de todas as datas com jogos, para que eu possa navegar diretamente a qualquer rodada sem precisar avançar/recuar dia a dia
- Como participante do bolão, quero que a data atual apareça destacada na lista de datas, para que eu identifique rapidamente onde estou
- Como participante do bolão, quero poder fechar o seletor sem selecionar nada (clique fora ou Esc), para que eu não seja forçado a mudar de data ao explorar a lista
- Como participante com deficiência motora, quero navegar pelo seletor com teclado (setas, Enter, Esc), para que eu tenha acesso pleno à funcionalidade

---

## Modelo de Dados

### Nenhuma tabela nova ou modificada

As datas disponíveis são derivadas da query existente sobre `games.match_date`. Nenhuma migration é necessária.

### Query para buscar datas disponíveis

```sql
SELECT DISTINCT match_date
FROM games
ORDER BY match_date ASC
```

O resultado (array de `timestamptz`) é convertido para datas BRT (`YYYY-MM-DD`) usando a mesma lógica de `dayBoundsInUTC` — mas na direção inversa: cada `timestamptz` é convertido para data local em `America/Sao_Paulo` via `Intl.DateTimeFormat`. Datas duplicadas após a conversão (dois jogos no mesmo dia BRT com `match_date` em UTC distintos) são deduplicadas com `Set`.

---

## Backend — Sem endpoints novos

As datas são buscadas diretamente no Server Component `JogosPage` usando o client Supabase server-side já disponível (`createClient()` de `lib/supabase/server.ts`). Não há novo endpoint Ruby/Sinatra.

---

## Frontend — Componentes React

### 1. Utilitário `matchDateToLocalDate` em `lib/date.ts`

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/lib/date.ts`

Adicionar a função abaixo ao módulo existente (sem remover nenhuma função já existente):

```typescript
/**
 * Converte um timestamptz ISO 8601 (UTC) para data local em BRT (YYYY-MM-DD).
 * Usado para mapear match_date de games para a data do dia em que o jogo ocorre
 * no fuso de Brasília.
 */
export function matchDateToLocalDate(isoUtcString: string): string {
  return new Date(isoUtcString)
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
}
```

### 2. `JogosPage` — passar `availableDates` para `DayNavigator`

**Arquivo:** `app/(dashboard)/jogos/page.tsx`

Adicionar query ao Server Component logo após a resolução do grupo ativo (em paralelo com as queries de jogos do dia, usando `Promise.all` se viável — caso contrário sequencialmente antes do bloco `if (user && games...)`):

```typescript
// Buscar todas as datas com jogos (para o date picker)
const { data: allMatchDates } = await supabase
  .from('games')
  .select('match_date')
  .order('match_date', { ascending: true })

// Converter para datas BRT únicas e ordenadas
const availableDates: string[] = allMatchDates
  ? Array.from(
      new Set(allMatchDates.map((row) => matchDateToLocalDate(row.match_date)))
    ).sort()
  : []
```

Importar `matchDateToLocalDate` de `@/lib/date`.

Passar `availableDates` para `DayNavigator`:

```tsx
<DayNavigator
  currentDate={currentDate}
  gameCount={games?.length ?? 0}
  guessCount={guessCount}
  availableDates={availableDates}
/>
```

### 3. `DayNavigator` — adicionar date picker dropdown

**Arquivo:** `components/games/DayNavigator.tsx`

#### Interface atualizada

```typescript
interface DayNavigatorProps {
  currentDate: string     // YYYY-MM-DD
  gameCount: number       // total de jogos no dia atual
  guessCount: number      // palpites do usuário no dia atual
  availableDates: string[] // datas YYYY-MM-DD com pelo menos 1 jogo, ordenadas ASC
}
```

#### Novos estados internos

```typescript
const [isPickerOpen, setIsPickerOpen] = useState(false)
const [focusedIndex, setFocusedIndex] = useState<number>(-1)
const pickerRef = useRef<HTMLDivElement>(null)
const triggerRef = useRef<HTMLButtonElement>(null)
const listRef = useRef<HTMLUListElement>(null)
```

#### Comportamento do trigger

A área de exibição da data (atualmente um `<span>` estático) é convertida em um `<button>` clicável:

- Tag: `<button>` com `type="button"`, `aria-haspopup="listbox"`, `aria-expanded={isPickerOpen}`, `aria-label="Selecionar data"`
- Ao clicar: alterna `isPickerOpen` entre `true`/`false`
- Aparência: mantém exatamente o mesmo visual do `<span>` atual — texto uppercase, cor `color-accent` quando hoje / `color-text` caso contrário, `font-family` monospace, `fontSize: 'clamp(11px, 3vw, 14px)'`, `fontWeight: 'bold'`, `letterSpacing: '0.08em'` — sem borda adicional, sem fundo, sem sombra, `background: transparent`, `border: none`, `cursor: pointer`
- Adicionar um indicador visual sutil de interatividade: `▼` (ou `▲` quando aberto) após o texto da data, em `color-muted`, `fontSize: '10px'`, `marginLeft: '0.4rem'`

#### Dropdown overlay

Quando `isPickerOpen === true`, renderizar um `<div>` posicionado absolutamente abaixo do trigger:

**Container do DayNavigator:** adicionar `position: 'relative'` ao `<div>` pai mais externo.

**O dropdown:**

```
position: 'absolute'
top: '100%'          // imediatamente abaixo do DayNavigator
left: 0
right: 0
zIndex: 100
backgroundColor: 'var(--color-surface)'
border: '1px solid var(--color-border)'
borderTop: 'none'
maxHeight: '240px'
overflowY: 'auto'
fontFamily: "'JetBrains Mono', 'Courier New', monospace"
```

Sem sombra (`boxShadow: 'none'`). Sem bordas arredondadas (`borderRadius: 0`).

**Lista de datas:** `<ul role="listbox" aria-label="Datas com jogos">` referenciada por `listRef`.

Cada item da lista é um `<li role="option" aria-selected={date === currentDate}>`:

- Texto: resultado de `formatDateDisplay(date)` — ex: "SÁBADO, 13 JUN 2026"
- `fontSize: '12px'`, `padding: '0.4rem 1rem'`, `cursor: 'pointer'`
- Estado padrão: `color: 'var(--color-text)'`, sem fundo especial
- Data atual (`date === currentDate`): `color: 'var(--color-accent)'`, `fontWeight: 'bold'`
- Item focado via teclado (por índice `focusedIndex`): `backgroundColor: 'var(--color-secondary)'`, `color: 'var(--color-text)'`
- Quando data atual E focada: `backgroundColor: 'var(--color-secondary)'`, `color: 'var(--color-accent)'`
- `borderBottom: '1px solid var(--color-border)'` em todos exceto o último
- Ao clicar: `navigate(date)` + `setIsPickerOpen(false)` + foco volta ao trigger

#### Fechar ao clicar fora

Efeito `useEffect` com listener `mousedown` no `document`:

```typescript
useEffect(() => {
  if (!isPickerOpen) return
  function handleClickOutside(e: MouseEvent) {
    if (
      pickerRef.current &&
      !pickerRef.current.contains(e.target as Node)
    ) {
      setIsPickerOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [isPickerOpen])
```

O `pickerRef` é atribuído ao container mais externo do componente (que engloba tanto o trigger quanto o dropdown), para que cliques dentro de qualquer parte do componente não fechem o picker.

#### Navegação por teclado

Handler `onKeyDown` no `<button>` trigger e no `<ul>` da lista:

| Tecla | Comportamento |
|-------|--------------|
| `Enter` / `Space` (no trigger, picker fechado) | Abre o picker; `focusedIndex` vai para o índice da `currentDate` em `availableDates` (ou 0 se não encontrada); move foco para a lista (`listRef.current?.focus()`) |
| `ArrowDown` (picker aberto) | Incrementa `focusedIndex` (com wrap: se no último, vai para 0); rola item para visualização |
| `ArrowUp` (picker aberto) | Decrementa `focusedIndex` (com wrap: se no primeiro, vai para o último); rola item para visualização |
| `Enter` (picker aberto, `focusedIndex >= 0`) | Navega para `availableDates[focusedIndex]`; fecha picker; devolve foco ao trigger |
| `Escape` (picker aberto) | Fecha picker; devolve foco ao trigger (`triggerRef.current?.focus()`) |
| `Tab` (picker aberto) | Fecha picker (deixa o fluxo de foco nativo ocorrer) |

O `<ul>` recebe `tabIndex={-1}` (focável programaticamente, fora do tab order). Cada `<li>` recebe `id={`date-option-${index}`}` para que o container `<ul>` use `aria-activedescendant`.

#### Scroll automático do item focado

Usar `useEffect` que observa mudanças em `focusedIndex`:

```typescript
useEffect(() => {
  if (focusedIndex < 0 || !listRef.current) return
  const item = listRef.current.children[focusedIndex] as HTMLElement
  item?.scrollIntoView({ block: 'nearest' })
}, [focusedIndex])
```

#### Reset de focusedIndex ao fechar

```typescript
useEffect(() => {
  if (!isPickerOpen) setFocusedIndex(-1)
}, [isPickerOpen])
```

#### Setas ◀ ▶ — sem alteração

Os botões de seta existentes (◀ dia anterior, ▶ próximo dia) continuam exatamente como estão. Nenhuma mudança na lógica de `offsetDate` ou `navigate`.

---

## Regras de Negócio

1. **Somente datas com jogos aparecem:** a lista vem de `SELECT DISTINCT match_date FROM games`, convertida para datas BRT. Se `availableDates` estiver vazio (banco sem jogos), o trigger não abre nenhum dropdown (ou exibe mensagem "SEM DATAS DISPONÍVEIS" no dropdown — mas dado que o sistema já tem jogos seedados, o estado vazio é edge case e não requer tratamento sofisticado além de não quebrar).

2. **Conversão de timezone:** `match_date` é armazenado como `timestamptz` UTC no Supabase. Um jogo de 21:00 BRT de 11/06 está gravado como `2026-06-12T00:00:00Z` — deve aparecer na lista como `2026-06-11` (data BRT). A função `matchDateToLocalDate` resolve isso via `Intl`/`toLocaleDateString` com `timeZone: 'America/Sao_Paulo'`, coerente com `todayInBrasilia()` e `dayBoundsInUTC()` já existentes.

3. **Deduplica antes de exibir:** múltiplos jogos no mesmo dia BRT resultam em uma única entrada na lista. O `Set` garante isso na `JogosPage`.

4. **Data atual destacada:** `date === currentDate` na lista recebe `color: 'var(--color-accent)'` e `fontWeight: 'bold'`. Este destaque é visual, não um elemento HTML diferente.

5. **Não altera a navegação por seta:** `availableDates` é usado apenas pelo picker; as setas continuam usando `offsetDate(currentDate, ±1)` sem restrição ao conjunto de datas com jogos (comportamento atual preservado).

---

## Proteção de Rotas

Nenhuma rota nova. O `DayNavigator` vive dentro de `/jogos`, que já requer autenticação (redirect para `/login` feito no Server Component `JogosPage`). O picker não introduz novos vetores de acesso.

---

## Integração Supabase Realtime

Não aplicável. O conjunto de datas disponíveis é buscado no Server Component no load da página. Como `games` raramente muda estruturalmente durante uma sessão (novas partidas não são adicionadas em tempo real pelo usuário), uma atualização com reload de página é suficiente.

---

## Critérios de Aceite

- [ ] Clicar no texto da data exibida no `DayNavigator` abre um dropdown com a lista de datas com jogos
- [ ] A lista exibe apenas datas com pelo menos 1 jogo (sem datas fantasma)
- [ ] Datas são exibidas no formato "DIA DA SEMANA, DD MMM YYYY" (usando `formatDateDisplay`)
- [ ] A data atualmente selecionada (`currentDate`) aparece destacada em `color-accent` bold
- [ ] Clicar em uma data fecha o dropdown e navega para `/jogos?date=YYYY-MM-DD`
- [ ] Clicar fora do componente fecha o dropdown sem navegar
- [ ] Tecla `Esc` fecha o dropdown e devolve o foco ao botão trigger
- [ ] Setas do teclado (`ArrowDown`/`ArrowUp`) movem o foco entre os itens da lista
- [ ] `Enter` com item focado no teclado navega para a data correspondente
- [ ] O dropdown é acessível: `role="listbox"`, `aria-expanded`, `aria-activedescendant` corretos
- [ ] As setas `◀ ▶` do `DayNavigator` continuam funcionando normalmente (sem regressão)
- [ ] Nenhuma migration, tabela nova ou endpoint criado
- [ ] Conversão de timezone correta: jogo `2026-06-12T00:00:00Z` aparece na data `2026-06-11`
- [ ] Design segue DESIGN.md: fonte JetBrains Mono, paleta verde/amarelo/azul, sem sombras, bordas `1px solid var(--color-border)`, dense, uppercase
- [ ] Funciona em mobile (coluna única, dropdown ocupa largura total do componente)
- [ ] `npm run lint` e `npm run build` sem erros após a implementação
