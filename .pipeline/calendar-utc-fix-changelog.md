# Changelog: Corrigir Agrupamento de Jogos no Calendário para Usar UTC

**Slug:** calendar-utc-fix
**Branch:** feature/calendar-utc-fix
**Data:** 2026-06-20
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/date.ts` — adicionada função `matchDateToUTCDate(isoUtcString: string): string` que extrai a data UTC de um timestamptz ISO 8601 usando `new Date(isoUtcString).toISOString().slice(0, 10)`, sem nenhuma conversão de fuso horário. A função `matchDateToLocalDate` existente foi preservada integralmente.
- `app/(dashboard)/jogos/page.tsx` — import atualizado de `matchDateToLocalDate` para `matchDateToUTCDate`; geração de `availableDates` (linha 96) substituída para usar `matchDateToUTCDate` em vez de `matchDateToLocalDate`. Com isso, cada chip de data no calendário passa a representar um dia UTC, eliminando o deslocamento de ±1 dia causado pela conversão para BRT.

### Backend (Ruby/Sinatra)

Nenhuma alteração.

### Banco de Dados

Nenhuma migration. O `match_date` já é `timestamptz` armazenado em UTC no Supabase — o problema era exclusivamente no frontend.

---

## Decisões técnicas

- **Preservação de `matchDateToLocalDate`**: a função não foi removida conforme exigido pela spec — pode ser usada por outras features não mapeadas nesta branch.
- **`dayBoundsInUTC` não alterado**: o filtro de quais jogos aparecem ao clicar em um chip continua operando em BRT, conforme especificado. A nota da spec confirma que os bounds BRT de um dia D sempre incluem todos os jogos com `match_date` UTC = D, portanto não há regressão funcional.
- **`todayInBrasilia()` mantido para `currentDate`**: a data padrão ao abrir `/jogos` sem parâmetro continua sendo o "hoje brasileiro" — apenas a geração dos chips mudou para UTC.
- **Implementação via `.toISOString().slice(0, 10)`**: abordagem idiomática, sem dependências externas, segura para strings ISO 8601 com e sem offset explícito.

---

## Pontos de atenção para o Revisor

- Verificar que `matchDateToLocalDate` ainda existe em `lib/date.ts` (não foi removida).
- Confirmar que `DateChipsNav`, `GameCard` e `dayBoundsInUTC` não foram alterados.
- Confirmar que os 2 erros de lint pré-existentes (`group-switcher.tsx` e `GroupChatWidget.tsx`) não foram introduzidos por esta feature.
- O caso de jogo com `match_date = '2026-06-19T23:30:00Z'` deve agora aparecer no chip `2026-06-19` (UTC), não no `2026-06-20` (BRT).

---

## Commits realizados

```
5aa93c1 fix(calendar-utc-fix): usa matchDateToUTCDate para agrupar chips de data por UTC em vez de BRT
827d2c9 feat(calendar-utc-fix): adiciona matchDateToUTCDate para extrair data UTC sem conversão de fuso
4a19f7d chore(calendar-utc-fix): adiciona plano de implementação
```
