# Changelog: Confrontos Contribuintes por Troféu

**Slug:** trophy-contributing-games
**Branch:** feature/trophy-contributing-games
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handler)
- `app/api/profile/trophies/route.ts` — adicionado campo `contributing_games: ContributingGame[]` à interface `TrophyResult`; nova interface `ContributingGame` com `game_id`, `home_team_code`, `away_team_code`, `home_score`, `away_score`; função `extractContributingGame` para extrair dados de jogo do join Supabase; função `findStreakContributingGames(threshold)` para calcular janela de sequência; todas as queries paralelas atualizadas para incluir `games(home_team_code, away_team_code, home_score, away_score)`; `makeTrophy` atualizado para receber e propagar `contributingGames`; lógica de extração de jogos contribuintes implementada para todos os 15 troféus.

### Frontend (Next.js/React)
- `components/bolao/perfil/TrophiesPanel.tsx` — adicionada interface `ContributingGame`; campo `contributing_games` adicionado à interface `Trophy`; novo componente interno `ContributingGameLine` que renderiza uma linha de jogo no formato `[FLAG] [COD] [SCORE] × [SCORE] [COD] [FLAG]`; cada card de troféu exibe a lista de jogos contribuintes abaixo da descrição do critério; cor `color-win` para troféus desbloqueados, `color-muted` para locked; seção silenciosamente omitida quando `contributing_games.length === 0`.

---

## Decisões técnicas

- **`videnteRes` sem `limit(25)`**: a spec exige todos os acertos de vencedor para `contributing_games`; o total de 25 para progresso e unlock usa `totalWinnerCount` (query separada com `count: exact`). Esta é a escolha correta da spec.
- **`profetaGames` reutiliza `cravadaGames`**: ambos os troféus são baseados em placares exatos. A spec confirma que os jogos são os mesmos — `cravadaItems` (todos os exatos) serve para os dois.
- **`findStreakContributingGames` retorna janela mínima**: retorna os últimos N jogos consecutivos da primeira sequência que atingiu o limiar (não a melhor sequência histórica). Conforme especificado.
- **Jogos com `home_score === null` ou `away_score === null` são omitidos**: `extractContributingGame` retorna `null` nesses casos, e o filtro `.filter((g): g is ContributingGame => g !== null)` garante que apenas jogos com placar finalizado aparecem.
- **`cartola` e `podio` sempre recebem `[]`**: baseados em snapshots de posição, sem jogo associável. A seção de confrontos nunca renderiza.
- **Erros de lint pré-existentes**: os 2 erros de lint (`group-switcher.tsx` e `GroupChatWidget.tsx`) existiam antes desta feature e não foram introduzidos por esta implementação. Confirmado via git stash.

---

## Pontos de atenção para o Revisor

1. **Query de `estreia`**: o campo `game_id` foi adicionado ao select de `predictions` (que antes selecionava apenas `submitted_at`). O campo `estreiaAt` ainda é extraído via `estreiaRes.data?.submitted_at`. Verificar se o Supabase client TypeScript aceita o select ampliado sem erro de tipo.
2. **`videnteRes` sem limit**: removido `.limit(25)`. Para grupos grandes com muitos acertos, essa query pode retornar muitas linhas. Aceitável para o contexto (bolão pequeno de amigos).
3. **Queries sequenciais em `perfeito_na_rodada` e `fiel`**: quando o dia perfeito/fiel é encontrado, uma query adicional busca os detalhes dos jogos. Essa query extra acontece apenas 1 vez (após encontrar o dia com `break`), não é um loop N+1 completo.
4. **Tipagem do `estreiaRes.data`**: a query de predictions retorna mais campos agora (`game_id`, `games(...)`), mas o cast `as { submitted_at: string } | null` ainda funciona porque TS aceita cast parcial nesse contexto. Revisor pode querer um cast mais amplo para clareza.

---

## Commits realizados

```
063d95a feat(trophy-contributing-games): exibe lista de jogos contribuintes no card de cada troféu
3beccf4 feat(trophy-contributing-games): atualiza route handler com contributing_games para todos os troféus
317491c chore(trophy-contributing-games): adiciona plano de implementação
```
