# Spec: Corrigir Agrupamento de Jogos no Calendário para Usar UTC

**Slug:** calendar-utc-fix
**Data:** 2026-06-20
**Status:** spec

---

## Objetivo

Corrigir o agrupamento de jogos no calendário da rota `/jogos` para usar sempre a data UTC do campo `match_date`, em vez da data convertida para o fuso horário de Brasília (BRT, UTC-3). Jogos cujo `match_date` UTC cai em um determinado dia estão sendo exibidos em outro dia porque a função `matchDateToLocalDate` converte para BRT antes de extrair a data.

---

## Histórias de Usuário

- Como participante do bolão, quero ver os jogos agrupados pela data UTC do `match_date` para que o jogo Turquia x Paraguai apareça no chip do dia 19 (data UTC) e não no dia 20 (data BRT).
- Como participante do bolão, quero que os chips de data correspondam exatamente à data UTC do calendário da Copa 2026, sem deslocamento de fuso.

---

## Diagnóstico do Bug

### Local exato do bug

**Arquivo:** `app/(dashboard)/jogos/page.tsx`
**Linha:** 96
**Código problemático:**
```typescript
new Set(allMatchDates.map((row) => matchDateToLocalDate(row.match_date)))
```

**Função responsável pela conversão errada:**
**Arquivo:** `lib/date.ts`
**Linhas 8–15**
```typescript
export function matchDateToLocalDate(isoUtcString: string): string {
  return new Date(isoUtcString)
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
}
```

### Como o bug se manifesta

O campo `match_date` no Supabase é `timestamptz` armazenado em UTC. Quando um jogo tem `match_date = '2026-06-19T23:30:00Z'` (dia 19 UTC às 23:30), em BRT (UTC-3) isso corresponde a `2026-06-20T20:30:00-03:00` — ou seja, dia 20 às 20h30 em BRT.

A função `matchDateToLocalDate` converte para BRT e retorna `'2026-06-20'`, fazendo o jogo aparecer no chip do dia 20. Mas o `match_date` UTC é claramente dia 19, e o PM especificou que o agrupamento deve seguir a data UTC.

### Cenários de divergência BRT vs UTC

| `match_date` UTC | Data UTC (esperada) | Data BRT (atual) | Bug? |
|---|---|---|---|
| `2026-06-19T00:00:00Z` | 2026-06-19 | **2026-06-18** | Sim — mostra no chip 18 |
| `2026-06-19T03:00:00Z` | 2026-06-19 | 2026-06-19 | Sem divergência |
| `2026-06-19T23:30:00Z` | 2026-06-19 | **2026-06-20** | Sim — mostra no chip 20 |
| `2026-06-20T00:00:00Z` | 2026-06-20 | **2026-06-19** | Sim — mostra no chip 19 |
| `2026-06-20T03:00:00Z` | 2026-06-20 | 2026-06-20 | Sem divergência |

O caso relatado (Turquia x Paraguai aparecendo no dia 20 em vez do dia 19) corresponde a um jogo com `match_date` UTC de `2026-06-19T2X:XX:XXZ` cujo horário BRT já é dia 20.

---

## Modelo de Dados

### Nenhuma alteração de schema necessária

O `match_date` é `timestamptz` e já está armazenado corretamente em UTC no Supabase. O fix é puramente no frontend — extração da data UTC do string ISO 8601, sem modificar o banco.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma alteração necessária. O filtro de data nos endpoints existentes já usa `dayBoundsInUTC` que opera em BRT — porém o escopo desta feature é exclusivamente a geração dos chips de data (`availableDates`). O filtro de jogos por dia (`dayBoundsInUTC`) não é alterado.

> Nota: Manter `dayBoundsInUTC` como está é intencional. O filtro de quais jogos aparecem em `/jogos?date=2026-06-19` continua calculando os limites BRT em UTC (exemplo: dia 19 BRT = de `2026-06-19T03:00:00Z` a `2026-06-20T02:59:59Z`). Esse filtro é independente da geração dos chips. Os chips passam a representar dias UTC; ao clicar no chip `2026-06-19` (UTC), o sistema busca jogos no range BRT correspondente via `dayBoundsInUTC`. Há uma inconsistência conceitual resultante: um jogo com `match_date = '2026-06-19T23:30:00Z'` aparecerá no chip `2026-06-19` (UTC) mas ao clicar nesse chip, o range BRT de `2026-06-19` vai de `T03:00:00Z` a `T02:59:59Z` (dia seguinte), incluindo o jogo — portanto o jogo aparecerá corretamente na listagem. A spec não altera o `dayBoundsInUTC` pois a alteração dessa função afetaria features de produção já estabilizadas.

---

## Frontend — Componentes React

### Mudança 1: nova função `matchDateToUTCDate` em `lib/date.ts`

**Arquivo:** `lib/date.ts`

Adicionar função que extrai a data UTC diretamente do string ISO 8601, sem conversão de fuso:

```typescript
/**
 * Extrai a data UTC de um timestamptz ISO 8601 no formato YYYY-MM-DD.
 * Usado para agrupar match_date de games por data UTC (não local).
 *
 * Exemplos:
 *   '2026-06-19T23:30:00Z'     -> '2026-06-19'
 *   '2026-06-19T03:00:00+00:00' -> '2026-06-19'
 *   '2026-06-20T00:00:00Z'     -> '2026-06-20'
 */
export function matchDateToUTCDate(isoUtcString: string): string {
  return new Date(isoUtcString).toISOString().slice(0, 10)
}
```

A implementação via `new Date(isoUtcString).toISOString().slice(0, 10)` é segura:
- `new Date(isoUtcString)` parseia corretamente strings ISO 8601 com e sem offset explícito
- `.toISOString()` retorna sempre em UTC (ex: `'2026-06-19T23:30:00.000Z'`)
- `.slice(0, 10)` extrai os 10 primeiros caracteres = `'YYYY-MM-DD'` UTC

**Importante:** A função `matchDateToLocalDate` existente **não deve ser removida** — pode ser usada por outras features. Apenas adicionar a nova função.

### Mudança 2: substituir `matchDateToLocalDate` por `matchDateToUTCDate` na geração de `availableDates`

**Arquivo:** `app/(dashboard)/jogos/page.tsx`
**Linha:** 96

Alterar:
```typescript
new Set(allMatchDates.map((row) => matchDateToLocalDate(row.match_date)))
```

Para:
```typescript
new Set(allMatchDates.map((row) => matchDateToUTCDate(row.match_date)))
```

Também atualizar o import na linha 2 do arquivo para incluir `matchDateToUTCDate` (e remover `matchDateToLocalDate` do import se não for mais usado):
```typescript
import { dayBoundsInUTC, isValidDateString, matchDateToUTCDate, todayInBrasilia } from '@/lib/date'
```

### `DateChipsNav` — nenhuma alteração necessária

O componente `components/games/DateChipsNav.tsx` recebe `availableDates: string[]` já pré-formatado pelo Server Component. A função interna `formatChipDate` em `DateChipsNav.tsx` (linha 16–19) já está correta — ela constrói `new Date(\`\${dateStr}T12:00:00Z\`)` e usa `timeZone: 'UTC'` para formatar, portanto não haverá mudança visual na exibição dos chips ao migrar de datas BRT para datas UTC.

### `GameCard` — nenhuma alteração necessária

O `GameCard` exibe o horário do jogo em BRT via `formatMatchTime` (linha 28–33 de `GameCard.tsx`) usando `timeZone: 'America/Sao_Paulo'`. Isso é correto e deve permanecer — o horário exibido ao usuário continua em BRT. A mudança é apenas em QUAL dia o chip de data aponta, não no horário exibido dentro do card.

---

## Regras de Negócio

1. **Data dos chips = data UTC do `match_date`**: cada chip em `DateChipsNav` representa um dia UTC. Se dois jogos têm `match_date = '2026-06-19T00:30:00Z'` e `'2026-06-19T23:00:00Z'`, ambos aparecem no chip `2026-06-19`.

2. **Horário dentro do card = BRT**: a exibição de `matchTime` dentro de cada `GameCard` continua usando `America/Sao_Paulo` (`formatMatchTime`). A mudança não afeta o horário exibido ao usuário.

3. **URL `?date=YYYY-MM-DD` = data UTC**: o parâmetro de URL passa a representar a data UTC. O `dayBoundsInUTC` converte a string de data para os bounds BRT correspondentes no banco, o que continua funcionando pois os bounds UTC calculados incluem o intervalo correto para a data UTC passada.

4. **`todayInBrasilia()` permanece para `currentDate`**: ao carregar `/jogos` sem parâmetro, `currentDate` continua sendo calculado em BRT (`todayInBrasilia()`). Isso é intencional — o usuário vê os jogos do seu "hoje brasileiro" por padrão. Apenas a geração de `availableDates` muda para UTC.

5. **Sem alteração em `dayBoundsInUTC`**: o filtro de quais jogos aparecem ao selecionar um chip não muda. A potencial inconsistência (chip UTC x filtro BRT) é aceitável e não altera a experiência do usuário porque os bounds BRT sempre superam o dia UTC (um dia BRT começa 3h antes do UTC e termina 3h depois — ou seja, o range BRT do dia D sempre contém todos os jogos com `match_date` UTC = D).

---

## Proteção de Rotas

Nenhuma alteração em proteção de rotas. A rota `/jogos` permanece protegida como hoje.

---

## Integração Supabase Realtime

Nenhuma alteração.

---

## Critérios de Aceite

- [ ] O jogo Turquia x Paraguai (com `match_date` UTC no dia 19) aparece no chip `2026-06-19` no calendário
- [ ] Jogos com `match_date` UTC em um determinado dia aparecem no chip desse dia, independentemente do horário BRT
- [ ] A função `matchDateToUTCDate` está em `lib/date.ts` e implementada como `new Date(isoUtcString).toISOString().slice(0, 10)`
- [ ] `availableDates` em `app/(dashboard)/jogos/page.tsx` usa `matchDateToUTCDate` (não `matchDateToLocalDate`)
- [ ] O import em `page.tsx` referencia `matchDateToUTCDate` (não `matchDateToLocalDate`)
- [ ] `matchDateToLocalDate` permanece em `lib/date.ts` (não foi removida — pode ser usada por outras features)
- [ ] `DateChipsNav` não foi alterado (nenhuma mudança em `components/games/DateChipsNav.tsx`)
- [ ] `GameCard` não foi alterado (horários continuam exibidos em BRT)
- [ ] `dayBoundsInUTC` não foi alterado (filtro de jogos por dia continua funcionando)
- [ ] Nenhuma migration SQL foi criada ou alterada
- [ ] Nenhuma regressão: navegação entre chips, swipe horizontal, scroll para chip ativo, contador de jogos e palpites funcionam normalmente
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros
- [ ] Design segue DESIGN.md — nenhuma mudança visual nos chips (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (faixa de chips com scroll horizontal)
