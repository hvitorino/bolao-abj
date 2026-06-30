# Changelog: Classificação do Grupo no Bottom Sheet

**Slug:** group-standings-bottomsheet
**Branch:** feature/group-standings-bottomsheet
**Data:** 2026-06-29
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handler)
- `app/api/analise-data/route.ts` — Estendido com:
  - Importação de `calculateGroupStandings` do novo módulo
  - Step 4b: quando `game.round?.startsWith('Grupo')`, faz query em `games` filtrando pelo mesmo `round`, coletando todos os jogos do grupo (`allGroupGames`)
  - Step 7b: chama `calculateGroupStandings(allGroupGames, game.match_date)` para jogos de grupo; retorna `null` para mata-mata
  - Campo `groupStandings` adicionado ao JSON de resposta (`StandingEntry[] | null`)

### Frontend (Next.js/React)
- `components/bolao/GroupStandingsCard.tsx` — Novo componente com:
  - Header verde (`color-primary`) com `► CLASSIFICAÇÃO — GRUPO X`
  - Cabeçalho de colunas: `#`, `TIME`, `P`, `J`, `V`, `E`, `D`, `GP`, `GC`, `SG`
  - Grid CSS com `gridTemplateColumns: '20px 1fr 22px 22px 20px 20px 20px 24px 24px 26px'`
  - Flag emoji + código do time na coluna TIME via `getTeamFlag()`
  - Linhas zebra (par transparente, ímpar `rgba(26,74,46,0.08)`)
  - Times do confronto destacados com `rgba(0,156,59,0.15)` e `fontWeight: bold`
  - Posição dos times destacados em `color-accent`
  - Coluna SG: `+N` em `color-win`, `-N` em `color-error`, `0` em `color-muted`
  - Estado vazio: mensagem "— sem jogos encerrados anteriores —" quando `standings.length === 0`
- `components/bolao/GameAnaliseDrawer.tsx` — Estendido com:
  - Import de `GroupStandingsCard` e tipo `StandingEntry`
  - Campo `groupStandings: StandingEntry[] | null` na interface `AnaliseData`
  - Renderização condicional após `RecentGamesSection`: aparece apenas quando `data.groupStandings !== null && data.game.round`

### Banco de Dados
- Nenhuma migration necessária. Usa tabela `games` já existente.

### Nova Biblioteca
- `lib/analytics/group-standings.ts` — Módulo puro com:
  - Tipo `StandingEntry` exportado
  - Função `calculateGroupStandings(allGroupGames, beforeDate)`:
    - Extrai times únicos do grupo a partir de todos os jogos (sem filtro)
    - Inicializa acumuladores zerados para todos os times
    - Filtra jogos elegíveis: `status === 'finished'` + `home_score !== null` + `away_score !== null` + `match_date < beforeDate`
    - Acumula resultados (vitória +3, empate +1, derrota 0)
    - Ordena por: pontos DESC → saldo DESC → gols pró DESC → nome ASC
    - Retorna array com `position` 1-based

---

## Decisões técnicas

- **Opção A (estender `/api/analise-data`)** foi escolhida conforme spec: evita round-trip extra, reutiliza auth/membership já validados, pattern idêntico ao `calculateTeamStats` existente.
- A query de jogos do grupo usa `.eq('round', game.round)` sem filtro de data/status, garantindo que todos os 4 times apareçam mesmo quando nenhum jogo foi encerrado ainda (R3 da spec).
- O estado vazio renderiza todos os times com 0 em todas as colunas (comportamento default do acumulador zerado) — não uma mensagem de "sem dados", conforme critério de aceite.
- `isGroupStage` usa `(game.round ?? '').startsWith('Grupo')` defensivamente para evitar erro em `round = null`.

---

## Pontos de atenção para o Revisor

1. **Critério de aceite "estado vazio":** a spec diz "todos os 4 times aparecem com 0 em todas as colunas" (não "sem dados anteriores"). O estado vazio (`standings.length === 0`) só ocorre se `allGroupGames` é vazio — na prática impossível, pois o próprio jogo exibido já pertence ao grupo. Verificar se a mensagem "— sem jogos encerrados anteriores —" está alinhada com a expectativa do Revisor ou se deve ser removida.
2. **Mobile overflow:** o grid usa `20px 1fr 22px 22px 20px 20px 20px 24px 24px 26px` e o conteúdo tem padding de `0.5rem` nas laterais + `0.75rem` do drawer. Em ~290px de largura útil, o total fixo de colunas é ≈ 20+22+22+20+20+20+24+24+26 = 198px mais a coluna `1fr` e os paddings laterais. Verificar no dispositivo real.
3. **A página `/jogos/[gameId]/analise`** não importa `GroupStandingsCard` — o campo extra `groupStandings` no JSON é simplesmente ignorado pela interface local da página, conforme spec.
4. **Lint:** existem 6 erros de lint pré-existentes em arquivos fora do escopo desta feature. Nenhum erro introduzido.
5. **Build:** passou sem erros ou warnings novos.

---

## Commits realizados

```
4582393 feat(group-standings-bottomsheet): integra GroupStandingsCard no GameAnaliseDrawer
5f5fd6b feat(group-standings-bottomsheet): cria componente GroupStandingsCard
ff4a8e1 feat(group-standings-bottomsheet): estende /api/analise-data com query e cálculo de groupStandings
8b8d563 feat(group-standings-bottomsheet): cria módulo calculateGroupStandings em lib/analytics
52b79af chore(group-standings-bottomsheet): adiciona plano de implementação
```
