# Changelog: Página Pública por Data

**Slug:** public-date-view
**Branch:** feature/public-date-view
**Data:** 2026-06-25
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `app/publico/[groupId]/[date]/page.tsx` — Server Component assíncrono da página pública por data. Valida `groupId` e `date` (usando `isValidDateString`), exibe erros inline preservando o header público. Busca jogos filtrados por `match_day`, membros do grupo via join `group_members + profiles`, palpites com visibilidade condicional por status (pending: só existência; live/finished: valores reais), e scores para jogos encerrados — tudo via `createServiceClient()`. Monta `initialGameParticipants: Record<gameId, ParticipantEntry[]>` e passa ao `PublicDateClient`. Inclui `generateMetadata` com título `{N} JOGOS · {DD MMM YYYY} — Bolão da Copa` e `export const revalidate = 0`.

- `app/publico/[groupId]/[date]/public-date-client.tsx` — Client Component pai. Mantém estado `games` e `gameParticipants` atualizados via Supabase Realtime (dois canais: `public-date-games-${groupId}-${date}` e `public-date-scores-${groupId}-${date}`). Calcula ranking do dia em tempo real: pontos oficiais (jogos `finished`) + pontos provisórios (jogos `live` via `calculateLiveScore()`). Renderiza `PublicDateRanking` e uma `PublicDateGameSection` por jogo da data em ordem cronológica.

- `components/bolao/PublicDateGameSection.tsx` — Seção de um jogo. Exibe mini placar (home_team_code × away_team_code) com badge de status (■ AO VIVO / □ ENCERRADO / PENDENTE), formatação de rodada (remove prefixo "Copa do Mundo NNNN - ") + horário BRT. Reutiliza `PublicParticipantsList` existente para a tabela de palpites, garantindo consistência com a página pública de jogo individual e reaproveitando toda a lógica de visibilidade e animação FLIP.

- `components/bolao/PublicDateRanking.tsx` — Tabela de ranking do dia. Exibe posição, nome (com `►` para o líder), pontos totais (oficial + ao vivo), badge `★ AO VIVO` quando `hasLivePoints=true`. Rodapé `* PONTOS AO VIVO SÃO PROVISÓRIOS` visível apenas quando há pontos ao vivo. Ordenação por pontos totais decrescente, desempate por nome pt-BR.

- `app/(dashboard)/palpites/palpites-live-section.tsx` (modificado) — Adicionado botão `⎘ COPIAR LINK DO DIA` com largura total, abaixo do `DateChipsNav`, que copia `${window.location.origin}/publico/${groupId}/${selectedDate}`. Feedback visual por 2 segundos: texto muda para `✓ COPIADO!` em `color-win`. Try/catch silencioso para contextos sem permissão de clipboard.

### Banco de Dados

- Nenhuma migration nova. A rota usa `createServiceClient()` (service_role) para as queries SSR, que bypassa RLS. As políticas anon para Realtime de `games` e `scores` já existem desde `20260624000010_public_read_games_scores.sql` (feature `public-game-view`).

### Tipos

- `lib/types/public-date.ts` — Interfaces `PublicDateGame` e `ProfileEntry`.

---

## Decisões técnicas

**Reutilização de `PublicParticipantsList`:** Em vez de criar um novo componente de tabela de palpites, `PublicDateGameSection` reutiliza o componente existente. Isso aproveita a lógica de visibilidade (OCULTO/PENDENTE), a animação FLIP e a subscription Realtime de scores própria do componente para jogos `finished`. O canal Realtime do `PublicParticipantsList` (`public-scores-${gameId}-${groupId}`) é complementar ao canal `public-date-scores-${groupId}-${date}` do `PublicDateClient` — para jogos `finished`, ambos recebem os mesmos eventos, mas o `PublicDateClient` usa o evento para atualizar o ranking do dia enquanto o `PublicParticipantsList` atualiza a tabela interna do jogo.

**Dois canais Realtime em vez de N canais:** Seguindo a decisão da spec, o `PublicDateClient` usa um único canal para `games` (sem filtro de linha, filtra no handler por `gameId IN ids`) e um único canal para `scores` (filtra no handler por `group_id` e `game_id IN ids`). Isso evita criar N canais para N jogos.

**`gameIdsKey` como string de dependência:** Para evitar problemas de referential equality em arrays como dependency do `useEffect`, os `gameIds` são convertidos para string (`join(',')`) e derivados novamente dentro de cada efeito via `split(',')`.

**Header público sem TabBar/SidePanelContainer:** Idêntico ao padrão da página pública de jogo — header minimalista com "BOLÃO DA COPA" (color-accent) e "VISUALIZAÇÃO PÚBLICA" (color-muted).

**Erros inline sem `notFound()`:** Conforme spec e padrão estabelecido em `public-game-view-group-fix`, erros são exibidos inline preservando o header público, nunca gerando 404.

---

## Pontos de atenção para o Revisor

- Verificar que a query `match_day` filtra corretamente os jogos — a coluna `match_day` já existe no schema (usada por `usePalpitesAoVivo`, `useLiveTodayRanking` e `useDailyRecap`).
- Confirmar que o `PublicParticipantsList` recebe `groupId` real em `PublicDateGameSection` (não string vazia) — corrigido após build inicial.
- Verificar comportamento em mobile 375px: `PublicDateGameSection` usa grid `1fr auto 1fr` para o placar; nomes dos times com overflow ellipsis.
- Confirmar que o botão "⎘ COPIAR LINK DO DIA" não quebra o layout sticky da aba de palpites — está posicionado entre `DateChipsNav` e `PalpitesLiveCard`, dentro do container `position: sticky`.
- O `PublicParticipantsList` existente tem subscription Realtime própria para jogos `finished`. Verificar se dupla subscription (do `PublicParticipantsList` + `PublicDateClient`) não causa problema — funcionalmente são idempotentes mas geram dois canais Supabase para o mesmo evento de score.

---

## Commits realizados

```
634409c fix(public-date-view): passa groupId ao PublicDateGameSection e corrige dependencies do useEffect
0260e1b feat(public-date-view): adiciona botão 'COPIAR LINK DO DIA' na aba de palpites
415e246 feat(public-date-view): cria Server Component, Client Component, PublicDateGameSection e PublicDateRanking
7586611 feat(public-date-view): cria tipos PublicDateGame e ProfileEntry
9c41fd5 chore(public-date-view): adiciona plano de implementação
```
