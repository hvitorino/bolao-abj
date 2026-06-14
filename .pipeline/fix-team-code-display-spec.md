# Spec: Correção — Exibição dos Códigos de Times

**Slug:** fix-team-code-display
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Corrigir a exibição dos códigos (abreviações) dos times nos cards de jogos e na página de palpites, onde apenas a primeira letra está sendo exibida (ex: "G" em vez de "GER") tanto no card principal de jogo quanto no resumo de palpite.

---

## Histórias de Usuário

- Como participante do bolão, quero ver as abreviações completas dos times (ex: "GER", "BRA", "CUR") nos cards de jogos, para identificar facilmente as seleções
- Como participante do bolão, quero ver as abreviações completas dos times no meu resumo de palpite em `/meus-palpites`, para entender qual jogo corresponde a cada linha

---

## Diagnóstico — Hipóteses de Causa Raiz

O bug mostra **somente a primeira letra** do código (ex: "G" em vez de "GER"). Isso descarta renderização com truncamento CSS (que mostraria as 3 letras mas cortaria visualmente). A causa deve ser num dos três planos:

### Hipótese A — Dado no banco com 1 caractere (mais provável)

O campo `home_team_code char(3)` no PostgreSQL aceita strings de até 3 chars, mas não rejeita strings menores — apenas adiciona espaços à direita para completar. Se o dado foi inserido como `"G"`, o banco armazena `"G  "` (G + 2 espaços). A API Supabase retorna via JSON como `"G  "` e o React renderiza `"G  "` — visualmente aparece como "G" porque espaços não são visíveis.

**Como isso teria ocorrido:** A rota `/api/admin/sync-games/route.ts` (linha 160-161) faz `.toUpperCase().slice(0, 3)` na `abbreviation` retornada pela ESPN. Se a ESPN retornou `"G"` (1 char) para algum time, o slice preserva `"G"`. Times como Curaçau podem ter abreviação diferente da esperada na ESPN.

**Verificação:** Executar a query SQL abaixo no Supabase SQL Editor:
```sql
SELECT id, home_team, home_team_code, away_team, away_team_code
FROM games
WHERE length(trim(home_team_code)) < 3
   OR length(trim(away_team_code)) < 3;
```
Se retornar linhas, a causa raiz é os dados no banco.

### Hipótese B — Acesso por índice no componente React

Se em algum ponto do código TypeScript o campo `home_team_code` fosse acessado como `game.home_team_code[0]` (índice 0 de string), retornaria apenas a primeira letra. Uma busca por `[0]` nos arquivos relevantes descartaria ou confirmaria esta hipótese.

**Verificação:** Executar `grep -rn "team_code\[0\]" components/ app/` — se não retornar nada, a hipótese B está descartada.

### Hipótese C — Coluna com tipo errado em ambiente de produção

A migration `20260613000002_create_games.sql` define `char(3)` corretamente. Porém, se o banco foi criado a partir de uma versão anterior (antes do ajuste), a coluna pode estar como `char(1)`. Nesse caso, o banco truncaria qualquer string para 1 caractere no INSERT.

**Verificação:** Executar no Supabase SQL Editor:
```sql
SELECT column_name, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'games'
  AND column_name IN ('home_team_code', 'away_team_code');
```
Se `character_maximum_length` for 1, a causa raiz é a migration.

---

## Mapeamento de Arquivos Afetados

| Arquivo | Localização do uso de `team_code` | Afetado? |
|---------|-----------------------------------|----------|
| `components/games/GameCard.tsx` | Linhas 169, 209: `{liveGame.home_team_code}` / `{liveGame.away_team_code}` (corpo do card) | Sim — card principal |
| `components/games/GameCard.tsx` | Linhas 386-413, 430-431, 448-449: props `homeTeamCode` / `awayTeamCode` passadas para `PredictionForm` e `PredictionDisplay` | Sim — resumo de palpite |
| `components/bolao/PredictionDisplay.tsx` | Linhas 93, 112: `{homeTeamCode}` / `{awayTeamCode}` exibidos no display de palpite enviado | Sim — resumo de palpite |
| `components/bolao/PredictionForm.tsx` | Linhas 257, 295: `{homeTeamCode}` / `{awayTeamCode}` exibidos ao lado dos inputs | Sim — formulário de palpite |
| `app/(dashboard)/meus-palpites/page.tsx` | Linha 258: `{game.home_team_code} × {game.away_team_code}` na coluna "JOGO" | Sim — tabela de palpites |
| `app/api/admin/sync-games/route.ts` | Linhas 160-161: `.toUpperCase().slice(0, 3)` ao construir `GameRecord` | Potencialmente — origem dos dados |
| `db/seeds/seed_games.rb` | Todas as entradas de `home_team_code` / `away_team_code` com 3 chars corretos | Não afetado (seed usa 3 chars) |

**Nota:** `components/bolao/GameParticipantsList.tsx` exibe apenas `home_score × away_score` (placar numérico), não os códigos de time. Este componente não está afetado.

---

## Modelo de Dados

### Tabela existente (sem mudança de schema)

```sql
games (
  home_team_code char(3) NOT NULL,
  away_team_code char(3) NOT NULL,
  ...
)
```

O schema está correto. A correção é nos dados ou na rota de sync, não na migration.

### Migration de correção de dados (condicional)

Se a Hipótese A for confirmada (dados com 1 char no banco), executar update pontual:

```sql
-- Identificar registros problemáticos
SELECT id, home_team, home_team_code, away_team, away_team_code
FROM games
WHERE length(trim(home_team_code)) < 3
   OR length(trim(away_team_code)) < 3;

-- Corrigir dados com base no mapeamento de times conhecidos
-- (ver seção "Mapeamento de Abreviações" abaixo)
UPDATE games
SET home_team_code = 'CUR'
WHERE trim(home_team_code) = 'C' AND home_team ILIKE '%Cura%';

-- Repetir para cada time afetado encontrado na query de diagnóstico
```

Se a Hipótese C for confirmada (coluna com `char(1)`), adicionar migration:

**Arquivo:** `supabase/migrations/20260614000004_fix_team_code_char3.sql`

```sql
-- Fix: altera colunas de char(1) para char(3)
ALTER TABLE games
  ALTER COLUMN home_team_code TYPE char(3),
  ALTER COLUMN away_team_code TYPE char(3);
```

### Mapeamento de Abreviações

Times que a ESPN pode retornar com abreviação incorreta ou diferente do esperado:

| Time | Código esperado | Possível código ESPN |
|------|-----------------|----------------------|
| Curaçau | CUR | C, CU |
| Alemanha | GER | G, GE |
| Coreia do Sul | KOR | K, KO |

O Programador deve verificar quais times estão com código incorreto executando a query de diagnóstico da Hipótese A antes de implementar as correções de dados.

---

## Backend — Correção na Rota de Sync ESPN

### `app/api/admin/sync-games/route.ts` (linhas 160-161)

Adicionar fallback para quando a ESPN retorna abreviação com menos de 3 caracteres. A correção deve usar um mapa de fallback baseado no `displayName` do time:

```typescript
// Mapa de fallback: displayName ESPN → código de 3 chars
const TEAM_CODE_FALLBACK: Record<string, string> = {
  'Curacao': 'CUR',
  'Germany': 'GER',
  'South Korea': 'KOR',
  // Adicionar outros conforme necessário após diagnóstico
}

function getTeamCode(team: { abbreviation: string; displayName: string }): string {
  const code = team.abbreviation.toUpperCase().slice(0, 3).trim()
  if (code.length === 3) return code
  // Fallback: buscar no mapa ou usar displayName truncado
  return TEAM_CODE_FALLBACK[team.displayName] ?? team.displayName.toUpperCase().slice(0, 3)
}
```

Substituir as linhas 160-161 de:
```typescript
home_team_code: homeCompetitor.team.abbreviation.toUpperCase().slice(0, 3),
away_team_code: awayCompetitor.team.abbreviation.toUpperCase().slice(0, 3),
```

Para:
```typescript
home_team_code: getTeamCode(homeCompetitor.team),
away_team_code: getTeamCode(awayCompetitor.team),
```

**Nota:** Esta função `getTeamCode` deve ser implementada no mesmo arquivo `route.ts`, antes de `mapEventToGame`.

---

## Frontend — Nenhuma Alteração Necessária

Os componentes frontend (`GameCard.tsx`, `PredictionDisplay.tsx`, `PredictionForm.tsx`, `meus-palpites/page.tsx`) acessam os campos corretamente como strings inteiras. **Nenhum desses arquivos deve ser modificado** — a correção é exclusivamente nos dados e na rota de sync.

Exceção: se a investigação revelar que algum componente usa indexação por posição (ex: `team_code[0]`), esse acesso deve ser corrigido para `team_code` sem índice.

---

## Processo de Implementação

O Programador deve seguir esta ordem:

### Passo 1 — Diagnóstico no banco

Executar as queries de verificação das Hipóteses A e C no Supabase SQL Editor e documentar os resultados no changelog. Isso define quais correções são necessárias.

### Passo 2 — Correção do código (sync-games)

Implementar a função `getTeamCode` em `app/api/admin/sync-games/route.ts` e substituir as linhas 160-161. Esta correção previne recorrência independentemente do estado atual dos dados.

### Passo 3 — Correção dos dados (condicional)

- Se Hipótese A confirmada: executar UPDATE direto no Supabase para corrigir os registros problemáticos. Documentar quais times foram corrigidos.
- Se Hipótese C confirmada: criar e aplicar a migration `20260614000004_fix_team_code_char3.sql`.
- Se ambas confirmadas: executar ambas as correções nesta ordem (schema primeiro, dados depois).

### Passo 4 — Re-sync via ESPN (opcional)

Após corrigir o código da rota, acionar `/api/admin/sync-games?days=7` com o header `X-Admin-Secret` correto para re-sincronizar os dados vindos da ESPN com os códigos corrigidos. Isso só é necessário se a correção de dados manual (Passo 3) não cobrir todos os jogos afetados.

---

## Regras de Negócio

- Códigos de time devem ter sempre exatamente 3 caracteres maiúsculos (ex: "BRA", "GER", "CUR")
- O banco aceita `char(3)` — strings menores são aceitas com padding de espaços, mas devem ser prevenidas na camada de aplicação
- O frontend não deve adicionar lógica de sanitização de `team_code` — a responsabilidade é da camada de ingestão de dados (sync ESPN e seed)

---

## Proteção de Rotas

Não há novas rotas nesta feature. As rotas existentes permanecem:
- `/jogos` — requer autenticação (sem mudança)
- `/meus-palpites` — requer autenticação (sem mudança)
- `/api/admin/sync-games` — requer `X-Admin-Secret` ou `CRON_SECRET` (sem mudança)

---

## Integração Supabase Realtime

Não se aplica a esta correção. Os canais Realtime existentes (`games`, `scores`) não são alterados.

---

## Critérios de Aceite

- [ ] Query de diagnóstico executada e causa raiz identificada e documentada no changelog
- [ ] Todos os registros na tabela `games` com `trim(home_team_code)` ou `trim(away_team_code)` de menos de 3 chars foram corrigidos para 3 chars
- [ ] `GameCard.tsx` exibe código de 3 letras no corpo do card (ex: "GER" em vez de "G")
- [ ] `PredictionDisplay.tsx` exibe código de 3 letras no resumo de palpite enviado
- [ ] `PredictionForm.tsx` exibe código de 3 letras ao lado dos inputs de placar
- [ ] Página `/meus-palpites` exibe `GER × DEN` (3 chars) na coluna JOGO
- [ ] Função `getTeamCode` implementada em `sync-games/route.ts` com fallback para abreviações < 3 chars
- [ ] Nenhum outro componente que exibe nomes de times (ex: `home_team`, `away_team`) foi alterado
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot) — nenhuma mudança visual além da correção do código
- [ ] Funciona em mobile (coluna única)
- [ ] Branch `feature/fix-team-code-display` criada e commits em português
