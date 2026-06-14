# Changelog: Correção — Exibição dos Códigos de Times

**Slug:** fix-team-code-display
**Branch:** feature/fix-team-code-display
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js API Route)

- `app/api/admin/sync-games/route.ts` — Adicionada constante `TEAM_CODE_FALLBACK` (mapa de displayName ESPN → código de 3 chars para times com abreviação curta) e função `getTeamCode` que substitui o inline `.abbreviation.toUpperCase().slice(0, 3)`. A função garante sempre 3 chars com `padEnd(3, 'X')` como última salvaguarda.

### Banco de Dados

- **Migration `20260614000004_fix_team_code_padding.sql`:** Remove espaços de padding dos códigos existentes (`trim(home_team_code)`) e converte as colunas de `char(3)` para `varchar(10)`. O tipo `char(3)` adicionava automaticamente espaços à direita para strings menores que 3 chars; `varchar` não adiciona padding, prevenindo recorrência do bug.

- **Migration `20260614000005_fix_team_code_placeholders.sql`:** Atualiza os 17 registros de jogos de mata-mata (oitavas de final) que ficaram com 2 chars após o trim. Converte usando regra semântica: `"2A"` → `"2GA"` (2nd place Group A), `"1C"` → `"1GC"` (Winner Group C), `"SF"` → `"SFX"` (Semifinal placeholder).

---

## Diagnóstico — Causa Raiz Identificada

### Hipótese B — Descartada
`grep -rn "team_code[0]"` nos componentes e páginas não retornou nenhum resultado. Nenhum componente acessa o código por índice.

### Hipótese C — Descartada
A migration `20260613000002_create_games.sql` define `char(3)` corretamente, e os dados dos jogos da fase de grupos (76 registros) têm todos 3 chars. O tipo estava correto; o problema era nos dados.

### Hipótese A — Confirmada
17 registros de jogos de mata-mata foram inseridos via sync ESPN com abreviações de 2 chars (ex: `"2A"`, `"SF"`, `"1C"`). O PostgreSQL `char(3)` armazenava como `"2A "` (com padding de espaço). O React renderizava `"2A "` — visualmente aparecia como "2A" pois espaços não são visíveis, mas quebrava o alinhamento em fonte monospace e os critérios de aceite da spec exigem exatamente 3 chars.

**Exemplo dos registros afetados:**
```
Group A 2nd Place  ('2A ') vs Group B 2nd Place  ('2B ')
Group C Winner     ('1C ') vs Group F 2nd Place   ('2F ')
Semifinal 1 Loser  ('SF ') vs Semifinal 2 Loser   ('SF ')
```

---

## Decisões técnicas

**Conversão de `char(3)` para `varchar(10)`:** O tipo `char(N)` no PostgreSQL adiciona automaticamente espaços à direita para preencher até N chars. `varchar(N)` não adiciona padding. Usar `varchar(10)` (em vez de `varchar(3)`) é mais permissivo para futuros códigos placeholder (ex: "3RD", "RD1", "RD3", "QFW" que já existiam com 3 chars) sem perder a validação de comprimento razoável.

**Mapeamento semântico dos placeholders:** Os códigos `"1A"`, `"2A"` etc. foram convertidos para `"1GA"`, `"2GA"` seguindo a convenção `[posição][G][grupo]` (ex: 1º colocado do Grupo A → "1GA"). Isso mantém legibilidade para o admin e respeita a limitação de 3 chars. O "SF" virou "SFX" (Semifinal placeholder).

**Fallback `padEnd(3, 'X')` no `getTeamCode`:** Última salvaguarda na camada de aplicação para que nem mesmo um caso extremo (displayName de 1 char) gere um código menor que 3 chars no futuro.

---

## Pontos de atenção para o Revisor

1. **Frontend não foi alterado** — conforme a spec, os componentes `GameCard.tsx`, `PredictionDisplay.tsx`, `PredictionForm.tsx` e `meus-palpites/page.tsx` não foram modificados. A correção é exclusivamente na camada de dados e na rota de sync.

2. **Verificar exibição dos jogos de mata-mata** — os códigos placeholder agora são "2GA", "1GC" etc. São tecnicamente corretos (3 chars), mas são diferentes do que a ESPN exibe para esses jogos. Quando a ESPN tiver os times definidos, um novo sync substituirá esses placeholders pelos códigos reais dos times.

3. **Função `getTeamCode`** — revisar se o mapa `TEAM_CODE_FALLBACK` está completo o suficiente para os 48 times da Copa 2026. Times que a ESPN pode abreviar com menos de 3 chars estão incluídos com base nas hipóteses da spec.

4. **Schema `varchar(10)` vs `char(3)`** — a mudança de tipo é mais permissiva que o original. O Revisor deve verificar se isso pode causar inconsistências com outros componentes que assumam comprimento fixo de 3 chars.

---

## Commits realizados

```
e880c79 fix(fix-team-code-display): adiciona padEnd para garantir sempre 3 chars no getTeamCode
9b39531 fix(fix-team-code-display): migrations para corrigir padding e placeholders nos codigos de times
bc40ef4 fix(fix-team-code-display): implementa getTeamCode com fallback para abreviações < 3 chars
2266c57 chore(fix-team-code-display): adiciona plano de implementação
```
