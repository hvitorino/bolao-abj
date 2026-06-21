# Spec: Ranking por Rodada

**Slug:** ranking-por-rodada
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Na tela de ranking (`/ranking`), adicionar uma faixa de chips acima da tabela que permite filtrar a pontuação acumulada apenas nos jogos de uma determinada fase (rodada). O chip "GERAL" é selecionado por padrão e exibe o ranking completo existente sem alteração. Ao selecionar outro chip (ex: "GRUPO A", "OITAVAS"), o ranking é recalculado exibindo apenas os pontos de jogos daquela fase, respondendo a pergunta "Quem está mandando nas Oitavas?".

---

## Histórias de Usuário

- Como participante do bolão, quero filtrar o ranking por fase para saber quem foi melhor em cada etapa da Copa
- Como participante, quero que o ranking geral continue sendo o padrão ao abrir a tela
- Como participante, quero que as fases disponíveis no filtro reflitam apenas as que têm jogos reais no grupo

---

## Modelo de Dados

### Tabelas existentes utilizadas

Nenhuma tabela nova é necessária. A feature usa tabelas já existentes:

- `games` — campo `round text` contém o nome da fase (ex: `"Grupo A"`, `"Oitavas de Final"`, `"Quartas de Final"`, `"Semifinal"`, `"Final"`)
- `scores` — `user_id uuid`, `game_id uuid`, `group_id uuid`, `points int`
- `group_members` — `user_id uuid`, `group_id uuid`
- `profiles` — `id uuid`, `name text`

### Nova função Postgres

```sql
CREATE OR REPLACE FUNCTION get_ranking_by_round(p_group_id uuid, p_round text)
RETURNS TABLE (
  rank_position     bigint,
  user_id           uuid,
  participant_name  text,
  total_points      bigint,
  games_predicted   bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC, p.name ASC) AS rank_position,
    p.id                                                                  AS user_id,
    p.name                                                                AS participant_name,
    COALESCE(SUM(s.points), 0)                                           AS total_points,
    COALESCE(COUNT(DISTINCT s.game_id), 0)                               AS games_predicted
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON s.user_id = gm.user_id
   AND s.group_id = p_group_id
  LEFT JOIN games g ON g.id = s.game_id
  WHERE gm.group_id = p_group_id
    AND (g.round = p_round OR g.round IS NULL AND s.game_id IS NULL)
  GROUP BY p.id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;
```

**Atenção ao filtro de rodada:** o LEFT JOIN em `games` faz com que membros sem nenhum score nessa rodada tenham `g.round IS NULL`. O predicado correto é:

```sql
WHERE gm.group_id = p_group_id
  AND (s.game_id IS NULL OR g.round = p_round)
```

Isso garante que membros com 0 pontos na rodada apareçam (via LEFT JOIN) mas com `total_points = 0`, e que somente scores de jogos da rodada especificada sejam somados.

### Função para listar fases disponíveis

```sql
CREATE OR REPLACE FUNCTION get_available_rounds(p_group_id uuid)
RETURNS TABLE (round text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT g.round
  FROM games g
  JOIN predictions pred ON pred.game_id = g.id AND pred.group_id = p_group_id
  WHERE g.round IS NOT NULL
  ORDER BY g.round;
$$;
```

Esta função retorna apenas as fases para as quais existe pelo menos um palpite no grupo — ou seja, fases com jogos que o grupo acompanha ativamente. O front pode ordenar os chips em uma sequência lógica de fases (ver "Ordenação dos chips").

### Migrations necessárias

Arquivo: `supabase/migrations/20260621200000_ranking_by_round.sql`

Conteúdo:
```sql
-- Função: get_ranking_by_round — ranking filtrado por fase
DROP FUNCTION IF EXISTS get_ranking_by_round(uuid, text);

CREATE OR REPLACE FUNCTION get_ranking_by_round(p_group_id uuid, p_round text)
RETURNS TABLE (
  rank_position     bigint,
  user_id           uuid,
  participant_name  text,
  total_points      bigint,
  games_predicted   bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC, p.name ASC) AS rank_position,
    p.id                                                                  AS user_id,
    p.name                                                                AS participant_name,
    COALESCE(SUM(s.points), 0)                                           AS total_points,
    COALESCE(COUNT(DISTINCT s.game_id), 0)                               AS games_predicted
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON s.user_id = gm.user_id
   AND s.group_id = p_group_id
  LEFT JOIN games g ON g.id = s.game_id
  WHERE gm.group_id = p_group_id
    AND (s.game_id IS NULL OR g.round = p_round)
  GROUP BY p.id, p.name
  ORDER BY total_points DESC, p.name ASC;
$$;

-- Função: get_available_rounds — fases com palpites no grupo
DROP FUNCTION IF EXISTS get_available_rounds(uuid);

CREATE OR REPLACE FUNCTION get_available_rounds(p_group_id uuid)
RETURNS TABLE (round text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT g.round
  FROM games g
  JOIN predictions pred ON pred.game_id = g.id AND pred.group_id = p_group_id
  WHERE g.round IS NOT NULL
  ORDER BY g.round;
$$;
```

---

## Backend — Endpoints Next.js (Route Handlers TypeScript)

### GET /api/ranking/rounds

**Arquivo:** `app/api/ranking/rounds/route.ts`

**Autenticação:** requerida (Bearer JWT)

**Query params:**
- `group_id` (string, UUID, obrigatório)

**Descrição:** Retorna a lista de fases disponíveis no grupo (apenas fases com ao menos um palpite). Chama a RPC `get_available_rounds(p_group_id)` via `serviceClient`.

**Resposta de sucesso (200):**
```json
{ "rounds": ["Grupo A", "Grupo B", "Oitavas de Final"] }
```

**Erros possíveis:**
- `401`: sem token ou token inválido
- `400`: `group_id` ausente ou inválido (não é UUID)
- `403`: usuário não é membro do grupo
- `500`: erro na RPC

---

### GET /api/ranking?group_id=&round=

**Arquivo:** `app/api/ranking/route.ts` (existente — a ser estendido)

**Mudança:** adicionar suporte ao query param opcional `round: string`.

- Se `round` não for fornecido (ou for `"GERAL"`): comportamento atual inalterado — chama `get_ranking(p_group_id)`.
- Se `round` for fornecido e não vazio: chama `get_ranking_by_round(p_group_id, round)`.

**Nota importante sobre scouts:** quando `round` está presente, a resposta **não inclui** o campo `scouts`. O array `scouts` é sempre `[]` no modo por rodada. Os badges de scout são derivados do desempenho geral, não por fase. Isso simplifica a implementação e evita recalcular scouts por rodada.

**Nota importante sobre `aproveitamento`:** o cálculo de aproveitamento permanece baseado em `games_predicted` (jogos com pontuação calculada) × 9 pontos máximos. No modo por rodada, `games_predicted` reflete apenas jogos daquela fase, então o aproveitamento é relativo à rodada. O campo continua calculado no backend via `calcAproveitamento()` já existente.

**Nota sobre `predictions_count`:** no modo por rodada, `predictions_count` não é retornado (a função `get_ranking_by_round` não o inclui). O campo deve ser `0` ou omitido no objeto de resposta quando `round` está presente.

**Resposta de sucesso (200) com `round`:**
```json
[
  {
    "rank_position": 1,
    "user_id": "uuid",
    "participant_name": "JOGADOR_A",
    "total_points": 15,
    "games_predicted": 3,
    "aproveitamento": 56,
    "predictions_count": 0,
    "scouts": []
  }
]
```

---

## Frontend — Componentes React

### RoundChips

**Arquivo:** `components/bolao/RoundChips.tsx`

**Props:**
```typescript
interface RoundChipsProps {
  rounds: string[]          // fases disponíveis, ex: ["Grupo A", "Oitavas de Final"]
  selectedRound: string     // "GERAL" ou nome de uma fase
  onSelect: (round: string) => void
}
```

**Comportamento:**
- Renderiza um chip "GERAL" sempre como primeiro item (não vem da API; é fixo no frontend)
- Para cada fase em `rounds`, renderiza um chip adicional
- O chip ativo (`selectedRound`) é estilizado com `color: var(--color-accent)` e `border-color: var(--color-accent)`
- Os demais chips usam `color: var(--color-muted)` e `border-color: var(--color-border)`
- Cada chip é um `<button>` com `onClick={() => onSelect(round)}`
- A faixa de chips tem `overflowX: 'auto'` para scroll horizontal em mobile, sem barra de scroll visível (`scrollbarWidth: 'none'` / `::-webkit-scrollbar { display: none }`)

**Estilo dos chips:**
```
[ GERAL ] [ GRUPO A ] [ GRUPO B ] [ OITAVAS DE FINAL ] ...
```
- Fonte: `JetBrains Mono`, `11px`, `uppercase`, `letterSpacing: '0.08em'`
- `padding: '0.3rem 0.75rem'`
- `border: 1px solid`
- `borderRadius: 0` (sem arredondamento — estilo Elifoot)
- `backgroundColor: 'transparent'`
- `cursor: 'pointer'`
- `whiteSpace: 'nowrap'` (sem quebra de linha)
- Transição: `border-color 0.15s, color 0.15s`
- Chip ativo: `color: var(--color-accent)`, `borderColor: var(--color-accent)`, `fontWeight: 'bold'`
- Chip inativo: `color: var(--color-muted)`, `borderColor: var(--color-border)`

**Ordenação dos chips:** o componente deve receber as fases na ordem retornada pela API e ordená-las internamente seguindo a sequência lógica da Copa:

```typescript
const ROUND_ORDER = [
  'Grupo A', 'Grupo B', 'Grupo C', 'Grupo D',
  'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H',
  'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinal',
  'Final',
]
```

Fases que não estão na lista acima (nomes inesperados) são colocadas ao final, em ordem alfabética.

**Estados:**
- `loading` (enquanto `rounds` ainda não chegou): renderizar apenas o chip "GERAL" ativo; não mostrar skeleton
- `empty` (nenhuma fase com palpites): renderizar apenas o chip "GERAL" ativo (comportamento de tela inteira)
- `populated`: renderizar chips normalmente

---

### RankingTable (modificação)

**Arquivo:** `components/bolao/RankingTable.tsx` (existente — a ser modificado)

**Nova prop:**
```typescript
interface RankingTableProps {
  currentUserId: string
  groupId: string
  // nova prop:
  selectedRound?: string  // undefined ou "GERAL" = modo geral; nome da fase = modo por rodada
}
```

**Mudanças de comportamento:**

1. O componente passa a gerenciar o estado de `selectedRound` e `availableRounds` internamente via um novo hook `useRoundRanking` (ver abaixo). A prop `selectedRound` inicializa o estado interno — se não for fornecida, usa `"GERAL"`.

2. **Cabeçalho da tabela:** quando `selectedRound !== "GERAL"`, exibir o nome da fase filtrada abaixo do título, em `color-muted`:
   ```
   RANKING — BOLÃO DA COPA
   FASE: OITAVAS DE FINAL
   ```

3. **Colunas no modo por rodada:** a coluna `PALP.` fica oculta (ela reflete total de palpites do grupo inteiro, não por fase). As colunas `#`, `PARTICIPANTE`, `PONTOS` e `APROVEIT.` permanecem.

4. **Scouts no modo por rodada:** os badges de scout ficam ocultos (não são calculados por fase).

5. **Live points no modo por rodada:** o `applyLivePoints()` aplica-se apenas no modo `"GERAL"`. No modo por rodada, a pontuação ao vivo de jogos da fase selecionada deve ser somada aos pontos oficiais da rodada. Para simplificar: no modo por rodada, `livePoints` é ignorado (pontuação exibida reflete apenas jogos finalizados). Justificativa: o caso de uso primário da feature é análise histórica de fases já concluídas.

6. **Posição acima da tabela:** inserir o componente `<RoundChips>` acima da tabela (fora do `<div>` de borda), sem alterar o layout da tabela em si.

---

### useRoundRanking (novo hook)

**Arquivo:** `lib/hooks/useRoundRanking.ts`

**Assinatura:**
```typescript
export function useRoundRanking(groupId: string): {
  selectedRound: string
  setSelectedRound: (round: string) => void
  availableRounds: string[]
  roundsLoading: boolean
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
}
```

**Comportamento interno:**

1. No mount, busca as fases disponíveis via `GET /api/ranking/rounds?group_id=` com o JWT da sessão.
2. Armazena `availableRounds` e `roundsLoading`.
3. `selectedRound` começa como `"GERAL"`.
4. Quando `selectedRound === "GERAL"`, delega ao comportamento do `useRankingRealtime` existente (pode reutilizar internamente ou replicar a lógica de fetch).
5. Quando `selectedRound !== "GERAL"`, faz fetch em `GET /api/ranking?group_id=&round=` e armazena os resultados.
6. Não subscreve ao Supabase Realtime no modo por rodada — o ranking por fase é estático (sem atualização automática). Isso é intencional e documentado: fases encerradas não mudam; a tela de ranking geral continua com Realtime.
7. Quando `selectedRound` muda, limpa os dados anteriores e faz novo fetch.

**Observação sobre Realtime:** O `useRankingRealtime` existente (usado no modo GERAL) continua responsável pela atualização em tempo real via canal `ranking-scores-${groupId}`. O `useRoundRanking` só usa Realtime no modo GERAL (delegando ao `useRankingRealtime`) e é estático no modo por rodada.

---

### RankingTable — integração com RoundChips

A estrutura JSX resultante de `RankingTable` no modo por rodada ativa:

```
┌──────────────────────────────────────────────────────┐
│  [GERAL] [GRUPO A] [OITAVAS] [QUARTAS]               │  ← RoundChips (fora do border)
├──────────────────────────────────────────────────────┤
│  RANKING — BOLÃO DA COPA                             │
│  FASE: OITAVAS DE FINAL                              │  ← subtitle quando round ≠ GERAL
├─────┬───────────────────────┬────────┬───────────────┤
│  #  │ PARTICIPANTE          │ PONTOS │ APROVEIT.      │
├─────┼───────────────────────┼────────┼───────────────┤
│  1  │ ► GOLEADOR_MASTER     │   12   │  44%          │
│  2  │   FUTEBOL_REI         │    9   │  33%          │
└─────┴───────────────────────┴────────┴───────────────┘
```

---

## Regras de Negócio

1. **Chip "GERAL" é sempre o padrão.** Ao abrir `/ranking`, o estado inicial é `selectedRound = "GERAL"` e o ranking exibido é idêntico ao comportamento atual.

2. **Fases disponíveis derivadas de palpites do grupo.** Uma fase só aparece como chip se existir ao menos um palpite (`predictions`) daquele grupo para um jogo daquela fase. Isso evita exibir fases fantasma para grupos que não acompanham certos jogos.

3. **Membros com 0 pontos na fase aparecem.** Assim como no ranking geral, participantes do grupo sem pontos na fase selecionada aparecem com 0 pts. Garantido via LEFT JOIN na função `get_ranking_by_round`.

4. **Aproveitamento por rodada é relativo à rodada.** No modo por rodada, `games_predicted` conta apenas jogos da fase com pontuação calculada. O aproveitamento máximo teórico de 100% equivale a 9 pts por jogo da fase.

5. **Scouts só aparecem no modo GERAL.** Os badges de scout são derivados do histórico completo do participante, não de uma fase específica. No modo por rodada, a seção de scouts e a coluna `PALP.` ficam ocultas.

6. **Live scoring no modo por rodada é ignorado.** A pontuação parcial de jogos ao vivo não é somada no modo por rodada. Isso simplifica a lógica e é aceitável porque o caso de uso da feature é análise de fases (geralmente encerradas).

7. **Ordenação dos chips** segue a sequência lógica da Copa (Grupos A–L → Oitavas → Quartas → Semi → Final). Fases com nomes não reconhecidos ficam ao final.

---

## Proteção de Rotas

A feature não introduz novas rotas. O endpoint `GET /api/ranking/rounds` segue o mesmo padrão de autenticação do `GET /api/ranking` existente: Bearer JWT obrigatório + verificação de membership no grupo via `serviceClient`.

---

## Integração Supabase Realtime

No modo `"GERAL"`, o `useRankingRealtime` continua operando normalmente com o canal `ranking-scores-${groupId}`.

No modo por rodada, **não há Realtime**. O ranking por fase é buscado uma vez ao selecionar o chip e não atualiza automaticamente.

---

## Critérios de Aceite

- [ ] Ao abrir `/ranking`, chips de fase aparecem acima da tabela com "GERAL" selecionado por padrão
- [ ] O ranking no modo "GERAL" é idêntico ao comportamento atual (sem regressão)
- [ ] Ao selecionar uma fase (ex: "GRUPO A"), o ranking exibe apenas pontos de jogos dessa fase
- [ ] Fases disponíveis refletem apenas fases com palpites reais do grupo (sem fases fantasma)
- [ ] Membros com 0 pontos na fase selecionada aparecem na tabela com 0 pts
- [ ] Chips seguem a ordenação lógica da Copa (Grupos → Oitavas → Quartas → Semi → Final)
- [ ] Cabeçalho da tabela exibe o nome da fase quando selecionada (ex: "FASE: OITAVAS DE FINAL")
- [ ] Coluna `PALP.` e scouts ficam ocultos no modo por rodada
- [ ] Faixa de chips tem scroll horizontal em mobile sem barra de scroll visível
- [ ] Chips não têm border-radius (estilo Elifoot)
- [ ] Chip ativo em `color-accent` bold; inativos em `color-muted`
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (coluna única, chips com scroll horizontal)
- [ ] `npm run lint` e `npm run build` passam sem erros novos
- [ ] Nenhuma regressão no ranking geral (Realtime, live points, scouts, aproveitamento)
