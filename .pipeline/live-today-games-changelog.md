# Changelog: Jogos do Dia no Bottom Sheet "Tá Rolando"

**Slug:** live-today-games
**Branch:** feature/live-today-games
**Data:** 2026-06-19
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/hooks/useLiveTodayRanking.ts` — adicionada interface exportada `LiveTodayGame` com os 9 campos especificados (id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, match_date); SELECT da query de jogos ampliado para incluir os campos de times e `match_date`; estado `games: LiveTodayGame[]` adicionado ao hook; `setGames([])` chamado no branch sem jogos; `setGames(...)` populado imediatamente após `setHasGamesToday(true)`; retorno do hook atualizado para incluir `games`

- `components/bolao/LiveTodayBottomSheet.tsx` — importados `LiveTodayGame` e `getTeamFlag`; prop `games: LiveTodayGame[]` adicionada à interface e desestruturação do componente; sub-componente `LiveTodayGameCard` criado inline (acima do componente principal) com layout horizontal time casa | placar | time visitante, badge "AO VIVO" com `animation: blink 1s step-end infinite` em `color-live`, badge "ENCERRADO" em `color-muted` sem animação, e placar `— × —` (travessão U+2014) para jogos pending; keyframes `blink` injetados via tag `<style>` no painel; seção "JOGOS DE HOJE" com separador inserida antes do conteúdo de ranking existente (renderizada condicionalmente quando `games.length > 0`)

- `components/bolao/RecapController.tsx` — desestruturado `games: liveTodayGames` do hook `useLiveTodayRanking`; prop `games={liveTodayGames}` passada ao `LiveTodayBottomSheet`

### Banco de Dados

Nenhuma migration necessária. Todos os campos já existiam em `games`.

### Backend

Nenhum endpoint novo ou modificado. Toda a lógica é client-side via Supabase JS SDK.

---

## Decisões técnicas

- **`<style>` tag para keyframes:** Os keyframes `blink` foram injetados via `<style>` tag dentro do JSX do painel, conforme especificado. Alternativa seria adicionar no `globals.css`, mas a spec prescreveu inline para manter o componente auto-contido.
- **Sem `React.CSSProperties` import:** O tipo já estava disponível via `React` global no JSX, portanto não foi necessário importar explicitamente.
- **Reuso do `getTeamFlag` existente:** A função `lib/utils/teamFlag.ts` já existia e foi reutilizada sem modificação, conforme especificado.
- **Erros de lint pré-existentes:** Os 2 erros de lint (`group-switcher.tsx` e `GroupChatWidget.tsx`) existem na base antes desta feature e não foram introduzidos pelas mudanças; os arquivos modificados passaram sem erros.

---

## Pontos de atenção para o Revisor

- Verificar que o placar `— × —` usa travessão Unicode (U+2014), não hífen `-`
- Confirmar que `blink 1s step-end infinite` corresponde ao comportamento definido em DESIGN.md
- Confirmar que a seção "JOGOS DE HOJE" aparece mesmo quando `loading === true` (se `games` já estiver populado de render anterior) — comportamento correto segundo spec
- Verificar que `setGames([])` é chamado antes de `setLoading(false)` no branch de `games.length === 0` para evitar dados stale em rerenders
- Confirmar que o Supabase Realtime já existente (`live-today-games-{groupId}`) atualiza `games` automaticamente ao chamar `fetchData()`, pois agora o SELECT inclui todos os campos necessários

---

## Commits realizados

```
141ba76 feat(live-today-games): passa prop games ao LiveTodayBottomSheet no RecapController
1c3889a feat(live-today-games): adiciona LiveTodayGameCard e seção JOGOS DE HOJE no bottom sheet
7b2b971 feat(live-today-games): amplia useLiveTodayRanking com LiveTodayGame e estado games
4c00ddd chore(live-today-games): adiciona plano de implementação
```
