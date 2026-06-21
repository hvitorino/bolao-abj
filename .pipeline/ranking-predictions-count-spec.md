# Spec: Total de Palpites no Ranking

**Slug:** ranking-predictions-count
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Exibir o total de palpites registrados por cada jogador na tela de ranking, como indicador de engajamento complementar à pontuação. O dado é escopado ao grupo ativo (mesmo critério do ranking), exposto apenas como contagem (não revela os palpites individuais de terceiros), e deve caber no layout mobile sem quebrar a tabela existente.

---

## Histórias de Usuário

- Como participante do bolão, quero ver quantos palpites cada jogador fez no grupo, para saber quem está mais engajado além da pontuação
- Como participante, quero que o total de palpites seja legível no meu celular sem precisar rolar na horizontal
- Como participante, quero que a coluna de palpites não mude a ordenação atual por pontuação

---

## Modelo de Dados

### Nenhuma tabela nova

A tabela `predictions` já existe e já possui `user_id` e `group_id`. O total de palpites por usuário em um grupo é derivado por:

```sql
SELECT user_id, COUNT(*) AS predictions_count
FROM predictions
WHERE group_id = <p_group_id>
GROUP BY user_id
```

### Migrations necessárias

**Uma migration:** alterar a função Postgres `get_ranking(p_group_id uuid)` para incluir `predictions_count` no resultado, via LEFT JOIN com a subquery acima.

**Arquivo:** `supabase/migrations/20260621000000_ranking_add_predictions_count.sql`

```sql
-- Migration: adiciona predictions_count ao resultado de get_ranking()
-- Estratégia: recriar a função com REPLACE para ser idempotente

CREATE OR REPLACE FUNCTION get_ranking(p_group_id uuid)
RETURNS TABLE (
  rank_position  bigint,
  user_id        uuid,
  participant_name text,
  total_points   bigint,
  games_predicted bigint,
  predictions_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(SUM(s.points), 0) DESC, p.name ASC) AS rank_position,
    p.id                                                                 AS user_id,
    p.name                                                               AS participant_name,
    COALESCE(SUM(s.points), 0)                                          AS total_points,
    COALESCE(COUNT(DISTINCT s.game_id), 0)                              AS games_predicted,
    COALESCE(pred_counts.cnt, 0)                                        AS predictions_count
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN scores s
    ON s.user_id = gm.user_id
   AND s.group_id = p_group_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt
    FROM predictions
    WHERE group_id = p_group_id
    GROUP BY user_id
  ) pred_counts ON pred_counts.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, p.name, pred_counts.cnt
  ORDER BY total_points DESC, p.name ASC;
$$;
```

> **Nota:** A função atual pode ter implementação ligeiramente diferente no banco de produção (gerada em feature anterior). A migration usa `CREATE OR REPLACE` para ser idempotente e segura. O Programador deve verificar o corpo atual da função via `\df+ get_ranking` no Supabase SQL Editor antes de escrever a migration definitiva, para preservar qualquer lógica adicionada por features subsequentes (ex: `grupo-ativo-persistente`, `grupos`). O critério de empate `ORDER BY p.name ASC` deve ser preservado.

---

## Backend — Endpoint de Ranking

### GET /api/ranking

O endpoint existente em `app/api/ranking/route.ts` precisa de duas alterações:

**1. Incluir `predictions_count` no mapeamento de retorno:**

```typescript
// Trecho existente em route.ts — adicionar predictions_count
const ranking = (data ?? []).map((entry: {
  rank_position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  predictions_count: number  // <- NOVO
}) => ({
  rank_position: entry.rank_position,
  user_id: entry.user_id,
  participant_name: entry.participant_name,
  total_points: Number(entry.total_points),
  games_predicted: Number(entry.games_predicted),
  aproveitamento: calcAproveitamento(Number(entry.total_points), Number(entry.games_predicted)),
  predictions_count: Number(entry.predictions_count),  // <- NOVO
}))
```

**Autenticação:** Bearer JWT (inalterado)
**Parâmetros:** `group_id` (inalterado)
**Resposta de sucesso (200):**
```json
[
  {
    "rank_position": 1,
    "user_id": "uuid",
    "participant_name": "GOLEADOR_MASTER",
    "total_points": 47,
    "games_predicted": 12,
    "aproveitamento": 43,
    "predictions_count": 12
  }
]
```

**Erros possíveis:**
- 401: não autenticado (inalterado)
- 403: não membro do grupo (inalterado)
- 400: group_id inválido (inalterado)
- 500: erro na RPC (inalterado)

---

## Frontend — Componentes React

### RankingEntry (tipo TypeScript)

**Arquivo:** `lib/types/ranking.ts`

Adicionar o campo `predictions_count`:

```typescript
export interface RankingEntry {
  rank_position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  aproveitamento: number
  predictions_count: number  // <- NOVO
}
```

---

### RankingTable

**Arquivo:** `components/bolao/RankingTable.tsx`

Adicionar coluna `PALPITES` no `<thead>`.

**Comportamento de visibilidade:**
- Em mobile (< 768px): **coluna `PALPITES` visível** — este é o campo novo e principal desta feature
- Em mobile (< 768px): **coluna `APROVEIT.` permanece oculta** (comportamento atual via `hidden md:table-cell`)
- Em desktop (>= 768px): **ambas as colunas visíveis** — `PALPITES` e `APROVEIT.`

**Cabeçalho da nova coluna:**

```tsx
<th
  style={{
    padding: '0.35rem 0.5rem',
    textAlign: 'center',
    minWidth: '4.5rem',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-muted)',
    fontWeight: 'normal',
  }}
>
  PALP.
</th>
```

> O cabeçalho usa a abreviação `PALP.` (4 caracteres + ponto) para caber na coluna em mobile. O `minWidth: '4.5rem'` é suficiente para exibir valores como `48` sem truncamento.

**Ordem das colunas em mobile (375px):**

```
# | PARTICIPANTE | PONTOS | PALP.
```

**Ordem das colunas em desktop (>= 768px):**

```
# | PARTICIPANTE | PONTOS | PALP. | APROVEIT.
```

---

### RankingRow

**Arquivo:** `components/bolao/RankingRow.tsx`

Adicionar célula `predictions_count` após a célula de pontos, antes da célula de aproveitamento.

**Props:** nenhuma alteração de interface necessária — `entry: RankingEntry` já passa a incluir `predictions_count` após a atualização do tipo.

**Nova célula:**

```tsx
{/* Palpites */}
<td
  style={{
    padding: '0.35rem 0.5rem',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '13px',
    color: 'var(--color-muted)',
    minWidth: '4.5rem',
  }}
>
  {entry.predictions_count}
</td>
```

- A cor é `color-muted` pois é uma informação secundária (complementar à pontuação)
- Não recebe `fontWeight: 'bold'` — pontos é que recebe bold
- Sem formatação condicional de cor (diferente do aproveitamento)

---

## Regras de Negócio

1. **Escopo por grupo:** `predictions_count` conta apenas palpites com `group_id = p_group_id` — participante que faz palpite no grupo A não tem esse palpite contado no ranking do grupo B.

2. **Zero é válido:** Participante sem nenhum palpite no grupo aparece com `predictions_count = 0`. Não ocultar a linha nem tratar como erro.

3. **Ordenação inalterada:** O `ORDER BY` da função `get_ranking()` continua sendo por `total_points DESC, participant_name ASC`. `predictions_count` não afeta a posição no ranking.

4. **Sem revelar palpites individuais:** `predictions_count` é apenas um inteiro (contagem). Nenhum placar, horário ou jogo específico é exposto. É dado equivalente ao `games_predicted` já exibido — apenas muda a fonte (tabela `predictions` em vez de `scores`).

5. **Diferença entre `games_predicted` e `predictions_count`:** `games_predicted` conta jogos que renderam pontuação (registros em `scores`), enquanto `predictions_count` conta todos os palpites submetidos, incluindo jogos ainda pendentes ou ao vivo. Em jogos finalizados, os dois valores podem coincidir; durante a Copa (jogos pendentes), `predictions_count >= games_predicted` sempre.

---

## Proteção de Rotas

Nenhuma alteração. A rota `/ranking` já é protegida com autenticação em `app/(dashboard)/ranking/page.tsx`. O endpoint `GET /api/ranking` já exige Bearer JWT e valida membership no grupo.

---

## Integração Supabase Realtime

Nenhuma alteração no canal Realtime. O hook `useRankingRealtime` já refaz o fetch completo de `/api/ranking` ao detectar mudança em `scores`. Como `predictions_count` vem da mesma RPC (`get_ranking`), o valor será atualizado automaticamente a cada refetch — não é necessário subscrever à tabela `predictions`.

> Quando o usuário faz um novo palpite, `predictions_count` não atualiza em tempo real imediato (pois a subscription observa `scores`, não `predictions`). Isso é aceitável: o ranking ao vivo foca em pontuação; a contagem de palpites é informação de engajamento secundária. O valor atualiza ao próximo evento de `scores` ou ao recarregar a página.

---

## Critérios de Aceite

- [ ] Cada linha do ranking exibe `predictions_count` numérico (ex: `12`) na coluna `PALP.`
- [ ] A coluna `PALP.` é visível em mobile (375px) — não usa `hidden md:table-cell`
- [ ] A coluna `APROVEIT.` continua oculta em mobile via `hidden md:table-cell` (sem regressão)
- [ ] Em desktop (>= 768px), ambas as colunas `PALP.` e `APROVEIT.` são visíveis
- [ ] Participante com 0 palpites exibe `0` (não `null`, `undefined` ou célula vazia)
- [ ] A ordenação do ranking por `total_points DESC` não é alterada
- [ ] `lib/types/ranking.ts` inclui o campo `predictions_count: number`
- [ ] `app/api/ranking/route.ts` retorna `predictions_count` no JSON
- [ ] A função Postgres `get_ranking()` retorna `predictions_count` via LEFT JOIN com `predictions`
- [ ] A migration é idempotente (`CREATE OR REPLACE FUNCTION`)
- [ ] Nenhum palpite individual (placar) de outros usuários é exposto — apenas contagem
- [ ] Design segue DESIGN.md: monospace JetBrains Mono, `color-muted` para a célula de contagem, uppercase no cabeçalho, sem border-radius, dense
- [ ] Funciona em mobile 375x667px sem scroll horizontal na tabela
- [ ] `npm run lint` e `npm run build` passam sem erros novos
