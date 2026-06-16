# Spec: Pontuação em Tempo Real Durante Jogos ao Vivo

**Slug:** live-scoring
**Data:** 2026-06-15
**Status:** spec

---

## Objetivo

Exibir, enquanto um jogo está com `status = 'live'`, a pontuação parcial/provisória de cada palpiteiro, recalculada automaticamente a cada mudança de `home_score`/`away_score` recebida via Supabase Realtime — aplicando exatamente a mesma lógica cumulativa de `calculateScore()` (`lib/scoring.ts`) ao placar parcial atual. Hoje a pontuação só aparece depois que o jogo termina (quando o trigger Postgres `calculate_scores_for_game` popula a tabela `scores`); esta feature antecipa essa visão para o período em que o jogo está rolando, deixando claro visualmente que o número é provisório, e garante que, ao finalizar (`status` → `finished`), a pontuação final batida pelo trigger Postgres seja idêntica à última pontuação parcial mostrada para aquele mesmo placar.

O cálculo é **100% client-side**: não há nova tabela, não há persistência de pontuação parcial em `scores` (que continua exclusiva da pontuação oficial pós-jogo), e não há novo endpoint Ruby ou Postgres. O ranking em `/ranking` passa a somar pontuação oficial (`scores`, jogos `finished`) + pontuação parcial calculada no cliente (jogos `live`).

---

## Avaliação da abordagem client-side (confirmação e riscos)

A abordagem proposta pelo PM — calcular a pontuação parcial inteiramente no cliente, reaproveitando `calculateScore()` sobre os dados já disponíveis via `useGameRealtime` e `predictions` — **é a abordagem correta e está confirmada nesta spec**. Razões:

1. `lib/scoring.ts` já espelha exatamente a função Postgres `calculate_scores_for_game` (versão corrigida em `supabase/migrations/20260614000003_fix_goleada_scoring.sql`), incluindo a regra de goleada `>= 4 gols` em ambos os lados. Não há divergência de lógica entre as duas implementações hoje — confirmado lendo as duas fontes lado a lado.
2. `calculateScore(game, prediction)` é uma função pura (sem I/O), already trivially reusável tanto para o placar final quanto para um placar parcial — a assinatura não distingue "final" de "parcial", apenas recebe `{home_score, away_score}` de ambos os lados.
3. Não há necessidade de nova tabela: persistir pontuação parcial em `scores` (ou em tabela nova) criaria uma segunda fonte de verdade que precisaria ser invalidada/apagada ao finalizar o jogo, e poderia colidir com o `UNIQUE(prediction_id)` já usado pela pontuação oficial. Calcular sob demanda no cliente evita esse problema inteiramente.
4. **Risco identificado e mitigação:** como o cálculo client-side depende de `predictions` carregadas no client (via props do Server Component ou fetch), é necessário garantir que a pontuação parcial só seja exibida para jogos cujos palpites já são visíveis pela regra de `fix-prediction-visibility` (jogos `live`/`finished` mostram palpites de todos; jogos `pending` escondem palpites de terceiros). Como esta feature só atua em jogos `live`, e a regra de visibilidade já libera os palpites de todos os participantes nesse status, **não há conflito** — confirmado lendo `game-participants-view-changelog.md` e a spec de `fix-prediction-visibility` (jogos `live`/`finished` exibem todos os palpites).
5. **Risco identificado e mitigação (ranking):** o ranking hoje (`GET /api/ranking` → RPC `get_ranking()`) soma exclusivamente a tabela `scores`, populada apenas por jogos `finished`. Para refletir pontuação parcial de jogos `live`, o **frontend** (não o backend) precisa somar ao resultado do `/api/ranking` a pontuação parcial calculada no cliente para os jogos `live` do dia atual. Isso exige que o cliente tenha acesso a todos os palpites e ao placar ao vivo de todos os jogos `live` no momento — não apenas os do dia selecionado em `/jogos`. Ver seção "Ranking" abaixo para o desenho exato dessa busca adicional.
6. **Risco identificado (não bloqueante):** se em algum momento `lib/scoring.ts` e a função Postgres divergirem (ex: um fix futuro aplicado em um lado e esquecido no outro), a pontuação parcial exibida ao vivo pode não bater com a pontuação final no instante da virada de status. Esta spec não introduz mecanismo de sincronização automática entre os dois lados (fora de escopo), mas o critério de aceite abaixo cobre teste manual de paridade no momento da virada `live` → `finished`.

**Conclusão:** segue-se com a abordagem client-side conforme proposto, sem alternativa de tabela nova ou endpoint novo.

---

## Histórias de Usuário

- Como participante do bolão, quero ver minha pontuação provisória durante um jogo ao vivo, para acompanhar como meu palpite está se saindo antes do jogo terminar.
- Como participante do bolão, quero ver a pontuação provisória de todos os outros participantes durante um jogo ao vivo, para comparar meu desempenho com o deles em tempo real.
- Como participante do bolão, quero que a interface deixe claro que aquela pontuação ainda é provisória (não oficial), para não confundir com a pontuação final já fechada.
- Como participante do bolão, quero que o ranking geral reflita também os pontos que estou fazendo nos jogos que estão rolando agora, e não apenas os jogos já encerrados.
- Como participante do bolão, quero que, quando o jogo termina, a pontuação exibida continue a mesma que eu vi durante o jogo (assumindo que o placar não mudou mais), sem "pulos" inexplicados.

---

## Modelo de Dados

**Nenhuma tabela nova. Nenhuma migration SQL nesta feature.**

- `games` — inalterada. Campos relevantes já existentes: `status` (`pending`|`live`|`finished`), `home_score`, `away_score` (nullable).
- `predictions` — inalterada. Campos relevantes já existentes: `user_id`, `game_id`, `home_score`, `away_score`.
- `scores` — inalterada e **continua exclusiva da pontuação oficial pós-jogo**, populada apenas pelo trigger `on_game_finished` → `calculate_scores_for_game`. Esta feature nunca escreve em `scores`.

Não há alteração em políticas RLS: as políticas de leitura de `predictions` já são abertas a todos os autenticados para jogos não-`pending` (ver `db/migrations/20260614_fix_prediction_visibility_policy.sql` / `supabase/migrations/20260614191000_fix_prediction_visibility_policy.sql`), o que já cobre o caso `live` necessário aqui.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

**Nenhum endpoint novo ou modificado.** Esta feature não toca em `api/scores/calculate.rb` nem cria novos endpoints Ruby. A pontuação oficial continua calculada exclusivamente pelo trigger Postgres `on_game_finished`.

O endpoint Next.js `GET /api/ranking` (`app/api/ranking/route.ts`) **também não é modificado no backend** — ele continua retornando apenas a soma oficial de `scores` via RPC `get_ranking()`. A combinação com a pontuação parcial de jogos `live` é feita inteiramente no **frontend**, na camada de hook/componente que consome esse endpoint (ver seção "Frontend" e "Regras de Negócio" abaixo). Isso evita duplicar a lógica de pontuação em Ruby/Postgres apenas para um valor provisório que nunca é persistido.

---

## Frontend — Componentes e Hooks React

### `lib/scoring.ts` (reuso, sem alteração de assinatura)

Nenhuma mudança de assinatura. `calculateScore(game: {home_score, away_score}, prediction: {home_score, away_score}): { points, breakdown }` já serve perfeitamente tanto para o placar final quanto para o placar parcial — basta passar o placar atual do jogo `live` (vindo de `useGameRealtime`) no lugar de `game`.

Se o time de implementação identificar necessidade de um pequeno helper para "placar ainda não definido" (ex: `home_score`/`away_score` nulos antes do jogo começar a ter gols, embora já `live`), criar uma função wrapper **em `lib/scoring.ts`**, não duplicar a lógica em componente:

```ts
// lib/scoring.ts — função nova, adicionar ao final do arquivo
export function calculateLiveScore(
  game: { home_score: number | null; away_score: number | null },
  prediction: { home_score: number; away_score: number }
): ScoringResult | null {
  if (game.home_score === null || game.away_score === null) return null
  return calculateScore(
    { home_score: game.home_score, away_score: game.away_score },
    prediction
  )
}
```

Justificativa: jogos `live` sempre têm `home_score`/`away_score` numéricos a partir do momento em que entram em `live` no fluxo atual (placar inicia em 0×0 — confirmar com o comportamento de `GameCard.tsx`, que já assume `0 × 0` como exibição padrão quando `isLive && !hasScore`). Ainda assim, o wrapper protege contra o caso defensivo de placar nulo, retornando `null` em vez de quebrar `calculateScore`.

### `GameParticipantsList.tsx` (modificado)

**Arquivo:** `components/bolao/GameParticipantsList.tsx`

**Props (novas, demais inalteradas):**
```ts
interface GameParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  currentUserId?: string
  liveGame?: { home_score: number | null; away_score: number | null } // NOVO — placar atual ao vivo
}
```

**Comportamento atual (mantido):**
- `showPoints = gameStatus === 'finished'` continua controlando a coluna `PTS` no caso de pontuação oficial.

**Comportamento novo:**
- Introduzir `showLivePoints = gameStatus === 'live'`.
- Quando `showLivePoints`, exibir a mesma coluna de pontos (renomeada no header para `PTS*` ou `PTS (PROV.)` — ver seção Design), calculada por participante via `calculateLiveScore(liveGame, participant.prediction)` quando `participant.prediction !== null`, e `null`/`-` quando o participante não tem palpite.
- A coluna de pontos passa a ser exibida em **3 estados** de header conforme `gameStatus`:
  - `pending`: coluna oculta (comportamento atual, inalterado).
  - `live`: coluna visível com header `PTS*` e valores calculados client-side via `calculateLiveScore`.
  - `finished`: coluna visível com header `PTS` e valores vindos de `participant.points` (pontuação oficial, comportamento atual, inalterado).
- Adicionar uma legenda/indicador abaixo da tabela (ou ao lado do título da seção) quando `gameStatus === 'live'`: texto `█ PROVISÓRIO — AO VIVO` ou similar (ver seção Design), em `color-live`, sinalizando que os pontos daquela coluna ainda não são oficiais.
- O cálculo é feito **dentro do componente** (ou em um pequeno helper de módulo dedicado, ver abaixo) a cada render — é barato (operações aritméticas simples sobre poucos participantes) e não precisa de memoização adicional além do que React já faz.

**Estados:** loading | error | empty | populated — inalterados (este componente já era síncrono, recebe os dados prontos via props; não há fetch novo).

**Supabase Realtime:** não direto. O componente em si não abre subscription — ele recebe `liveGame` já atualizado via Realtime pelo componente pai `GameCard` (que já mantém `liveGame` via `useGameRealtime`). Ao `liveGame.home_score`/`away_score` mudarem, o React re-renderiza `GameParticipantsList` com o novo placar e os pontos parciais são recalculados automaticamente — sem necessidade de subscription própria.

### `GameCard.tsx` (modificado)

**Arquivo:** `components/games/GameCard.tsx`

**Mudança:** ao renderizar `<GameParticipantsList>`, passar a nova prop `liveGame`:

```tsx
{participants.length > 0 && (
  <GameParticipantsList
    participants={participants}
    gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
    currentUserId={userId}
    liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}
  />
)}
```

`liveGame` já existe no componente (retornado por `useGameRealtime(game.id, game)` na linha 73 do arquivo atual) — não é necessário nenhum novo hook ou fetch em `GameCard`. Apenas repassar o placar já reativo.

### `ScoreDisplay.tsx` (reuso opcional, sem alteração obrigatória)

Não é obrigatório reaproveitar `ScoreDisplay` para a pontuação parcial — ele já é usado apenas no contexto "meu palpite" dentro do card individual do usuário (área de palpite no topo do `GameCard`, visível quando `isFinished`). Se o Programador optar por também exibir o breakdown detalhado (não apenas o total) da pontuação parcial do **próprio usuário** na área de palpite (acima de `GameParticipantsList`, onde hoje só aparece quando `isFinished`), pode reaproveitar `ScoreDisplay` passando o resultado de `calculateLiveScore`, desde que:
- Adicione um indicador visual de "provisório" no próprio `ScoreDisplay` (nova prop opcional `isLive?: boolean`) **ou** envolva o componente em um wrapper com o badge de "AO VIVO" por fora, sem modificar a lógica interna do componente.

Essa extensão é **desejável, mas não obrigatória** para o critério de aceite — o requisito mínimo de aceite é a pontuação parcial aparecer em `GameParticipantsList` (visão de todos os participantes), pois é o componente que já exibe pontuação por jogo na superfície principal (`/jogos`). Se o Programador implementar também no card individual de "meu palpite" via `ScoreDisplay`, deve seguir o mesmo padrão visual de indicador "provisório" descrito na seção Design.

### `useRankingRealtime.ts` (modificado) e novo cálculo combinado

**Arquivo:** `lib/hooks/useRankingRealtime.ts`

Hoje o hook busca **apenas** `GET /api/ranking` (soma de `scores`) e atualiza via Realtime no canal de `scores`. Para refletir pontuação parcial de jogos `live`, é necessário que o hook (ou um hook companheiro) também tenha:
1. A lista de jogos `live` no momento (com seus placares atuais).
2. Os palpites de todos os participantes para esses jogos `live`.

**Abordagem recomendada:** criar um novo hook `useLiveRankingAdjustment` (ou estender `useRankingRealtime` diretamente — decisão de implementação do Programador, mas a opção de hook separado é preferível para não inflar um hook que já tem responsabilidade clara) que:

```ts
// lib/hooks/useLivePointsByUser.ts (novo arquivo sugerido)
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'

export interface LivePointsByUser {
  [userId: string]: number // soma de pontos parciais de todos os jogos `live` para aquele usuário
}

/**
 * Busca todos os jogos com status 'live' e os palpites de todos os usuários para esses jogos,
 * calcula a pontuação parcial client-side via calculateLiveScore, e soma por usuário.
 * Subscreve ao canal `games` (filtro por status via re-fetch) para recalcular quando
 * home_score/away_score ou status de qualquer jogo mudar.
 */
export function useLivePointsByUser(): { livePoints: LivePointsByUser; loading: boolean } {
  // implementação: fetch inicial de games (status='live') + predictions desses games,
  // recalcula localmente, expõe somatório por user_id.
  // Re-fetch disparado por subscription Realtime na tabela `games` (event: '*', sem filtro
  // de coluna — qualquer UPDATE em games pode mudar quem está `live` ou o placar de quem já está).
}
```

**Integração em `RankingTable.tsx`:**
- `RankingTable` passa a chamar tanto `useRankingRealtime()` (pontuação oficial) quanto `useLivePointsByUser()` (pontuação parcial agregada por usuário).
- Para cada `entry` do ranking oficial, o total exibido passa a ser `entry.total_points + (livePoints[entry.user_id] ?? 0)`.
- O `aproveitamento` exibido **continua calculado apenas sobre `entry.total_points` e `entry.games_predicted` oficiais** (não recalcular aproveitamento sobre pontuação provisória — ver Regras de Negócio) para não exigir mudança no endpoint Ruby/Next que já calcula esse campo.
- A ordenação (`rank_position`) exibida na tabela deve ser **recalculada no cliente** após somar a pontuação parcial, pois a posição vinda do backend reflete apenas `scores` oficiais. Ou seja: somar `total_points + livePoints`, depois reordenar desc (critério de empate: nome A-Z, mesmo critério do backend) e renumerar `rank_position` 1..N no cliente antes de passar para `RankingRow`.
- Indicar visualmente quando a posição/pontos exibidos incluem ajuste provisório — ver seção Design (ex: badge `AO VIVO` no cabeçalho da tabela já existe; adicionar nota textual menor "inclui pontos provisórios de jogos ao vivo" quando `livePoints` tiver pelo menos uma entrada > 0).

**Estados:** loading | error | empty | populated — o estado de loading combinado deve esperar tanto o ranking oficial quanto o cálculo de pontos live antes de exibir a tabela (evitar "flash" de pontuação sem o ajuste provisório). Se `useLivePointsByUser` falhar (erro de rede), a tabela deve degradar graciosamente exibindo apenas a pontuação oficial (não bloquear o ranking inteiro por falha no cálculo provisório) — logar o erro no console, não exibir banner de erro adicional.

**Supabase Realtime:**
- Canal existente `ranking-scores` (tabela `scores`, evento `*`) — inalterado, continua disparando refetch do ranking oficial quando um jogo finaliza e o trigger popula `scores`.
- Canal novo (dentro de `useLivePointsByUser`), ex: `live-points-games` — tabela `games`, evento `UPDATE` (sem filtro de `id`, pois qualquer jogo pode entrar/sair de `live` ou mudar placar). Ao receber evento, refaz fetch de jogos `live` + predictions e recalcula a soma. Aplicar debounce semelhante ao já usado em `useRankingRealtime` (1000ms) para evitar avalanche de re-cálculos quando múltiplos jogos atualizam ao mesmo tempo.

---

## Regras de Negócio

1. **Cálculo da pontuação parcial:** para cada jogo com `status === 'live'` e `home_score`/`away_score` não nulos, e para cada participante com um palpite registrado (`predictions` para aquele `game_id`), a pontuação parcial é `calculateScore({home_score, away_score}, prediction).points` — **idêntica** à fórmula usada para a pontuação final, só que aplicada ao placar momentâneo em vez do placar final.

2. **Participante sem palpite:** se o participante não tem `prediction` para aquele jogo, a pontuação parcial não é calculada (exibir `-`, igual ao comportamento já existente para jogos `finished` sem palpite).

3. **Transição `live` → `finished` sem mudança de placar:** se o placar não mudar entre o último evento Realtime recebido durante `live` e o momento em que o trigger Postgres calcula a pontuação oficial, o valor exibido **deve ser idêntico**, pois ambos os lados usam a mesma fórmula (`calculateScore` em TS e `calculate_scores_for_game` em SQL, ambos na versão pós-fix-goleada). Não é necessário nenhum mecanismo de "transição suave" ou cache do último valor parcial — basta que, ao `status` mudar para `finished`, o componente passe a usar `liveScore`/`participant.points` (pontuação oficial vinda de `scores` via Realtime) em vez do cálculo client-side, e os dois valores devem coincidir matematicaticamente para o mesmo placar e o mesmo palpite.

4. **Transição `live` → `finished` COM mudança de placar no mesmo instante** (ex: o placar final é setado junto com a mudança de status, sem um evento `live` intermediário refletindo o placar definitivo): nesse caso é esperado e correto que a pontuação "salte" do valor calculado para o placar anterior para o valor oficial do placar final — isso não é uma inconsistência de lógica, é reflexo de uma mudança real de placar. O critério de aceite de "sem pulo inexplicado" se refere a pular de pontos **para o mesmo placar**, não a mudanças de pontuação quando o placar em si muda.

5. **Indicador de "provisório":** sempre que a pontuação exibida vier de cálculo client-side sobre um jogo `live` (não de `scores`), a UI deve trazer um indicador textual/visual claro de que aquele valor é provisório — nunca apresentar pontuação parcial com a mesma aparência visual exata da pontuação oficial (ver seção Design).

6. **Ranking combinado:** `pontuação exibida no ranking = SUM(scores.points WHERE jogos finished) + SUM(calculateScore(placar_atual, palpite) para cada jogo live com palpite do usuário)`. Jogos `pending` não contribuem (sem placar). A soma de pontuação parcial é recalculada a cada mudança em `games` (status ou placar) — não há necessidade de recalcular a cada mudança em `predictions`, pois palpites não mudam mais depois que o jogo deixa de ser `pending` (regra já garantida pela feature `predictions`/`predictions-edit`: edição só é permitida com `status === 'pending'` e antes do deadline).

7. **Aproveitamento no ranking:** o percentual de aproveitamento exibido (`entry.aproveitamento`) **não** é recalculado para incluir jogos `live` — continua refletindo apenas `total_points / (games_predicted * 9)` sobre jogos `finished`, pois "aproveitamento" é uma métrica de eficiência sobre jogos já decididos. Incluir jogos `live` no denominador (cuja pontuação máxima ainda pode mudar) tornaria a métrica instável e foi descartado como escopo desta feature.

8. **Múltiplos jogos `live` simultâneos:** a pontuação parcial de um usuário no ranking é a soma de todos os jogos `live` em que ele tem palpite, não apenas um. O hook `useLivePointsByUser` deve buscar **todos** os jogos `live` no momento (não apenas os do dia selecionado em `/jogos` — o ranking é uma visão global, independente de navegação por dia).

---

## Proteção de Rotas

Sem mudanças. `/jogos` e `/ranking` já são rotas protegidas (grupo `(dashboard)`), inalterado por esta feature.

---

## Integração Supabase Realtime

| Hook | Tabela | Evento | Canal | Ação ao receber evento |
|------|--------|--------|-------|------------------------|
| `useGameRealtime` (já existe, inalterado) | `games` | `UPDATE` | `game-${gameId}` | Atualiza `liveGame` no `GameCard`; propaga para `GameParticipantsList` via prop, disparando recálculo de pontuação parcial no render |
| `useLivePointsByUser` (novo) | `games` | `UPDATE` (sem filtro de id) | `live-points-games` (nome sugerido) | Refaz fetch de jogos `live` + predictions, recalcula soma de pontos parciais por usuário, com debounce de 1000ms |
| `useRankingRealtime` (já existe, inalterado) | `scores` | `*` | `ranking-scores` | Refaz fetch de `/api/ranking` (pontuação oficial) |

Nenhuma nova tabela precisa ser adicionada à publicação `supabase_realtime` — `games` já está publicada (usada por `useGameRealtime` desde a feature `live-scores-realtime`).

---

## Design

Seguir DESIGN.md rigorosamente: monospace (`JetBrains Mono`), paleta verde/amarelo/azul, dense first, dark only, sem ícones SVG decorativos (usar caracteres ASCII como o resto do projeto: `►`, `✓`, `✗`, `█`, `●`).

### Indicador de pontuação provisória em `GameParticipantsList`

- Header da coluna de pontos quando `gameStatus === 'live'`: texto `PTS*` (asterisco indicando nota de rodapé) em vez de `PTS`.
- Valores da coluna em `live`: usar `color-live` (`#ff3b30`) em vez de `color-accent` para os números positivos — diferenciando visualmente claramente da cor usada quando a pontuação é oficial (`color-accent`, `#FFDF00`, já usada para `finished`). Pontuação parcial igual a 0: `color-muted`, igual ao padrão de `finished`.
- Abaixo da tabela (ou ao lado do título `PALPITES DOS PARTICIPANTES`), quando `gameStatus === 'live'`, adicionar uma linha pequena: `* PROVISÓRIO — RECALCULADO AO VIVO`, fonte 9–10px, `color-live`, uppercase, letter-spacing `0.05em`, sem animação de blink (blink é reservado ao badge `AO VIVO` do placar, para não competir visualmente).

### Indicador no ranking

- Quando a soma de `livePoints` para pelo menos um usuário for `> 0`, exibir no cabeçalho de `RankingTable` (próximo ao badge `● AO VIVO` já existente) uma nota: `INCLUI PONTOS PROVISÓRIOS`, mesma fonte/peso do timestamp de atualização já presente, em `color-live`.
- Nas linhas individuais (`RankingRow`), não é necessário marcar visualmente quais usuários têm pontos provisórios incluídos no total — a nota global no cabeçalho já comunica isso suficientemente bem para um bolão pequeno (poucos participantes, todos cientes do contexto).

### Mobile

Sem alterações estruturais de layout — apenas texto adicional (a nota de "provisório") deve quebrar para nova linha em telas estreitas sem comprometer a tabela existente (`flexWrap: 'wrap'`, padrão já usado em outros headers do projeto, ex. `RankingTable` linha de cabeçalho).

---

## Critérios de Aceite

- [ ] Durante um jogo com `status = 'live'`, a coluna de pontos em `GameParticipantsList` exibe a pontuação parcial de cada participante com palpite, recalculada automaticamente (sem reload) quando `home_score`/`away_score` mudam via Realtime.
- [ ] A pontuação parcial usa exatamente `calculateScore()` (ou o wrapper `calculateLiveScore()`) de `lib/scoring.ts`, sem reimplementação paralela da lógica de pontuação em nenhum componente.
- [ ] A UI de `GameParticipantsList` distingue visualmente a pontuação provisória (jogo `live`, cor `color-live`, header `PTS*`, nota `* PROVISÓRIO — RECALCULADO AO VIVO`) da pontuação oficial (jogo `finished`, cor `color-accent`, header `PTS`).
- [ ] Participante sem palpite no jogo `live` exibe `-` na coluna de pontos parciais (mesmo padrão usado em `finished`).
- [ ] Ao `games.status` mudar de `live` para `finished` sem mudança adicional no placar, a pontuação exibida (agora oficial, vinda de `scores`) é numericamente idêntica à última pontuação parcial exibida para aquele mesmo placar e palpite — validar manualmente com pelo menos 2 cenários do CLAUDE.md (ex: placar exato e goleada).
- [ ] O ranking em `/ranking` exibe, para cada participante, `pontuação oficial (scores, jogos finished) + pontuação parcial (jogos live, calculada client-side)`, com posições (`rank_position`) recalculadas no cliente após a soma.
- [ ] O ranking não trava nem exibe erro visível se o cálculo de pontos provisórios falhar (degrada para exibir apenas pontuação oficial, com erro logado no console).
- [ ] Nenhuma nova tabela criada; nenhuma escrita em `scores` originada por esta feature; nenhum endpoint Ruby novo ou modificado.
- [ ] `aproveitamento` exibido no ranking continua calculado apenas sobre jogos `finished` (não considera jogos `live` no denominador/numerador).
- [ ] Cleanup correto de toda nova subscription Realtime (`useLivePointsByUser`) ao desmontar o componente — sem memory leak, seguindo o padrão já usado em `useGameRealtime`/`useRankingRealtime`.
- [ ] Design segue DESIGN.md: fonte monospace, paleta verde/amarelo/azul (`color-live` para indicar "provisório"), sem ícones decorativos, sem sombras, bordas simples.
- [ ] Funciona em mobile (coluna única, nota de "provisório" quebra de linha sem distorcer a tabela).
