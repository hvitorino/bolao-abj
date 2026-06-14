# Changelog: Palpites e Pontuação dos Participantes por Jogo

**Slug:** game-participants-view
**Branch:** feature/game-participants-view
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `db/migrations/20260614_participants_read_policies.sql` — Migration idempotente que:
  - Remove a política `predictions_select_own` (SELECT restrito ao próprio usuário) e cria `predictions_select_all_authenticated` (SELECT para qualquer autenticado, `USING (true)`)
  - Remove a política `scores_select_own` e cria `scores_select_all_authenticated` com mesma lógica
  - Adiciona política `profiles_select_all_authenticated` de forma idempotente (via bloco `DO $$ IF NOT EXISTS $$`), pois a tabela `profiles` não tinha migration de RLS explícita no repositório

### Frontend (Next.js/React)

- `lib/types/participant.ts` — Interface `ParticipantEntry { userId, name, prediction, points }` usada por toda a cadeia de componentes

- `components/bolao/GameParticipantsList.tsx` — Server Component (sem `'use client'`) que recebe `participants: ParticipantEntry[]`, `gameStatus` e `currentUserId`:
  - Renderiza título `PALPITES DOS PARTICIPANTES` em `color-muted`, 10px, uppercase
  - Estado vazio: linha `SEM PARTICIPANTES`
  - Tabela com colunas PARTICIPANTE / PALPITE / PTS (PTS apenas quando `gameStatus === 'finished'`)
  - Usuário logado identificado com prefixo `■` em `color-primary`
  - Palpite formatado `H × A` em `color-accent` bold 12px, ou `-` em `color-muted` quando ausente
  - Pontuação em `color-accent` quando `> 0`, em `color-muted` quando `=== 0`, `-` quando sem palpite
  - Separado do restante do card por `border-top: 1px dashed var(--color-border)`, padding `0.75rem`
  - Fonte monospace `JetBrains Mono`, sem sombras, sem ícones SVG decorativos

- `app/(dashboard)/jogos/page.tsx` — Estendido para:
  - Buscar `allProfiles`, `allPredictions` (todos os usuários) e `allScores` (todos os usuários) em paralelo com `Promise.all` junto à query de palpites do usuário logado (total: 4 queries em paralelo, sem N+1)
  - Construir índices `predByUserGame` e `scoreByUserGame` keyed por `"userId:gameId"` para acesso O(1)
  - Montar `participantsByGameId: Record<string, ParticipantEntry[]>` para cada game_id do dia
  - Repassar `participantsByGameId` ao `GameList`

- `components/games/GameList.tsx` — Adicionada prop `participantsByGameId?: Record<string, ParticipantEntry[]>` com default `{}`, repassada ao `GameCard`

- `components/games/GameCard.tsx` — Adicionada prop `participants?: ParticipantEntry[]` com default `[]`; renderiza `<GameParticipantsList>` ao final do card quando `participants.length > 0`, fora da `div` de área de palpite existente, com separação visual por `border-top: 1px dashed var(--color-border)` já presente no componente `GameParticipantsList`

---

## Decisões técnicas

**Sem nova query N+1:** A strategy de `Promise.all` com 4 queries flat (games, profiles, all_predictions, all_scores) e indexação em memória por `"userId:gameId"` garante que nenhum componente faz fetch adicional. O `GameCard`, apesar de ser Client Component, recebe os dados prontos via props sem nenhuma chamada ao Supabase.

**`select('*')` para allScores:** A query de allScores foi alterada de seleção parcial para `select('*')` para que o tipo inferido pelo SDK Supabase seja compatível com a interface `Score` existente (que inclui `prediction_id` e `calculated_at`). A seleção parcial gerava erro de tipagem ao fazer cast explícito.

**`typedAllScores` como variável intermediária:** Em vez de `(allScores ?? []).filter(...)` com cast inline, foi criada a variável `typedAllScores = (allScores ?? []) as Score[]` para reutilização tanto no `myScores.filter` quanto no loop de `scoreByUserGame`, eliminando cast duplicado.

**Visibilidade de palpites sem restrição temporal:** A spec explicitamente não requer ocultar palpites antes do início do jogo — a competição já está em andamento. Palpites ficam visíveis para qualquer usuário logado independente do status do jogo.

**RLS: substituição em vez de adição:** As políticas antigas de SELECT filtrado por `user_id` foram substituídas por políticas abertas a todos os autenticados. As políticas de INSERT/UPDATE mantêm o filtro por `user_id` — apenas leitura foi liberada.

---

## Pontos de atenção para o Revisor

1. **Migration de RLS é breaking change:** A remoção das políticas `predictions_select_own` e `scores_select_own` e substituição por políticas abertas altera o comportamento de queries existentes que dependiam do filtro por `user_id`. Verificar se alguma outra parte do sistema (ex: `meus-palpites`) continua funcionando corretamente — essas queries fazem filtro explícito por `user_id` no código, então devem ser imunes.

2. **Migration de `profiles`:** A tabela `profiles` não tinha migration explícita de criação no repositório. A política de SELECT foi adicionada de forma idempotente via bloco `DO $$`. Se o Supabase Auth já tivesse configurado RLS para `profiles` via dashboard, pode haver conflito de nomes de policy — a verificação `IF NOT EXISTS` previne o erro.

3. **`GameCard` é Client Component:** `GameParticipantsList` é um Server Component, mas ao ser renderizado dentro de `GameCard` (que usa `'use client'`), ele atua como Client Component na prática (Next.js não pode hidratar Server Components dentro de Client Components a menos que sejam passados como children). O componente funciona corretamente pois não tem dependências de servidor (sem fetch, sem uso de `cookies()`, sem `async`).

4. **Coluna PTS exibe `+0`:** Quando um jogo está `finished`, um participante com palpite mas 0 pontos exibe `+0` em `color-muted`. A spec diz que quando `points === 0`, a cor é `color-muted` — mas não especifica se deve exibir `+0` ou `-`. A implementação exibe `+0` por consistência com o formato `+N`.

5. **Truncamento do nome do participante:** A coluna PARTICIPANTE usa `maxWidth: 120px` com `text-overflow: ellipsis`. Em mobile, nomes muito longos serão truncados visualmente.

---

## Commits realizados

```
0971692 fix(game-participants-view): corrige tipagem de allScores para compatibilidade com Score
b12aa8a feat(game-participants-view): adiciona migration para políticas RLS de leitura por todos os autenticados
d89d61e feat(game-participants-view): integra GameParticipantsList no GameCard
78365c3 feat(game-participants-view): adiciona prop participantsByGameId ao GameList
edb264a feat(game-participants-view): estende JogosPage para buscar perfis, todos os palpites e scores em paralelo
eaef48c feat(game-participants-view): cria componente GameParticipantsList
3433737 feat(game-participants-view): cria tipo auxiliar ParticipantEntry
ccf946c chore(game-participants-view): adiciona plano de implementação
```
