# Spec: Ranking por Scout

**Slug:** ranking-por-scout
**Data:** 2026-06-30
**Status:** spec

---

## Objetivo

Permitir que o usuário selecione uma categoria de pontuação (scout) na aba Ranking via chips e veja o ranking reordenado instantaneamente pela quantidade de vezes que cada participante atingiu aquele scout, com a contagem exibida como métrica principal no lugar dos pontos totais.

---

## Histórias de Usuário

- Como participante do bolão, quero filtrar o ranking por uma categoria específica de pontuação (ex: "Placar Cravado") para ver quem mais acerta placares exatos, independentemente dos pontos totais.
- Como participante do bolão, quero alternar rapidamente entre diferentes categorias de scout sem esperar um novo carregamento, para comparar desempenhos.
- Como participante do bolão, quero ver minha contagem em cada categoria de scout para entender meus pontos fortes e fracos.

---

## Definição dos Scouts

Os 6 scouts são derivados diretamente do campo `breakdown` (JSONB) da tabela `scores`, considerando apenas jogos com status `live` ou `finished`:

| Chave | Label | Descrição |
|-------|-------|-----------|
| `exact` | PLACAR CRAVADO | Placares exatos (`breakdown->>'exact' > 0`) |
| `winner` | ACERTOU VENCEDOR | Acertos de vencedor (`breakdown->>'winner' > 0`) |
| `winner_score` | GOLS DO VENCEDOR | Acertou o placar do vencedor (`breakdown->>'winner_score' > 0`) |
| `diff` | DIFERENÇA DE GOLS | Acertou a diferença de gols (`breakdown->>'diff' > 0`) |
| `loser_score` | GOLS DO PERDEDOR | Acertou o placar do perdedor (`breakdown->>'loser_score' > 0`) |
| `goleada` | GOLEADA | Acertou goleada (`breakdown->>'goleada' > 0`) |

---

## Modelo de Dados

### Estender função `get_ranking_scouts(p_group_id uuid)`

Adicionar 4 novas colunas de retorno à função existente:

```sql
CREATE OR REPLACE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id              uuid,
  exact_count          bigint,
  winner_count         bigint,
  miss_count           bigint,
  pred_active          bigint,
  pred_total           bigint,
  pred_last_two_rounds bigint,
  -- NOVAS colunas:
  winner_score_count   bigint,
  diff_count           bigint,
  loser_score_count    bigint,
  goleada_count        bigint
)
```

As novas colunas seguem o mesmo padrão de `exact_count`/`winner_count`:

```sql
-- winner_score_count
LEFT JOIN scores s_ws
  ON s_ws.user_id = gm.user_id
 AND s_ws.group_id = p_group_id
 AND (s_ws.breakdown->>'winner_score')::int > 0
 AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_ws.game_id AND g.status IN ('live','finished'))

-- diff_count
LEFT JOIN scores s_diff
  ON s_diff.user_id = gm.user_id
 AND s_diff.group_id = p_group_id
 AND (s_diff.breakdown->>'diff')::int > 0
 AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_diff.game_id AND g.status IN ('live','finished'))

-- loser_score_count
LEFT JOIN scores s_ls
  ON s_ls.user_id = gm.user_id
 AND s_ls.group_id = p_group_id
 AND (s_ls.breakdown->>'loser_score')::int > 0
 AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_ls.game_id AND g.status IN ('live','finished'))

-- goleada_count
LEFT JOIN scores s_gol
  ON s_gol.user_id = gm.user_id
 AND s_gol.group_id = p_group_id
 AND (s_gol.breakdown->>'goleada')::int > 0
 AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_gol.game_id AND g.status IN ('live','finished'))
```

### Migration

**Arquivo:** `supabase/migrations/20260630100000_add_scout_counts_to_ranking_scouts.sql`

Conteúdo: `CREATE OR REPLACE FUNCTION get_ranking_scouts(p_group_id uuid)` com as 4 novas colunas adicionadas. `CREATE OR REPLACE` garante idempotência — não quebra a função existente.

---

## Backend — Endpoint

### GET /api/ranking

**Mudança:** O endpoint já chama `get_ranking_scouts` e já tem a tipagem `ScoutRow`. Basta adicionar os 4 novos campos à interface `ScoutRow` e incluí-los no campo `scout_counts` de cada entrada do ranking.

**Novo campo na resposta:** `scout_counts` — objeto opcional com as contagens por scout:

```json
{
  "rank_position": 1,
  "user_id": "uuid",
  "participant_name": "João",
  "total_points": 47,
  "games_predicted": 8,
  "aproveitamento": 65,
  "predictions_count": 12,
  "scouts": ["mae_dina"],
  "streak": 3,
  "scout_counts": {
    "exact": 2,
    "winner": 6,
    "winner_score": 1,
    "diff": 3,
    "loser_score": 1,
    "goleada": 0
  }
}
```

**`scout_counts` é `null` no modo por rodada** (já que `round` queries não chamam `get_ranking_scouts`).

**Implementação em `route.ts`:**
1. Após receber `scoutsData`, mapear os novos campos para um dicionário `scoutCountsByUser`.
2. No `map` final, adicionar `scout_counts: scoutCountsByUser[entry.user_id] ?? null`.

---

## Frontend — Componentes React

### Atualização: `lib/types/ranking.ts`

```typescript
export interface ScoutCounts {
  exact: number
  winner: number
  winner_score: number
  diff: number
  loser_score: number
  goleada: number
}

export interface RankingEntry {
  rank_position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  aproveitamento: number
  predictions_count: number
  scouts: string[]
  streak: number
  scout_counts: ScoutCounts | null  // novo
}
```

### Mapa de scouts para UI

```typescript
export const SCOUT_FILTERS: Record<string, { label: string; key: keyof ScoutCounts }> = {
  exact:         { label: 'PLACAR CRAVADO',      key: 'exact' },
  winner:        { label: 'ACERTOU VENCEDOR',     key: 'winner' },
  winner_score:  { label: 'GOLS DO VENCEDOR',     key: 'winner_score' },
  diff:          { label: 'DIFERENÇA DE GOLS',    key: 'diff' },
  loser_score:   { label: 'GOLS DO PERDEDOR',     key: 'loser_score' },
  goleada:       { label: 'GOLEADA',              key: 'goleada' },
}
```

### Atualização: `components/bolao/RankingTable.tsx`

**Novo estado:** `activeScout: string | null` (null = modo "Geral")

**Scout selector chips:**
- Renderizados entre o título e a tabela
- Layout horizontal com scroll (igual a `DateChipsNav`)
- Chip "GERAL" sempre presente, selecionado por padrão
- Demais chips: um para cada scout em `SCOUT_FILTERS`
- Chip ativo: `color-accent`, bold
- Chips inativos: `color-muted`
- Estilo: `JetBrains Mono`, uppercase, `fontSize: 11px`, sem border-radius

**Lógica de reordenação (client-side):**

```typescript
function applyScoutFilter(
  ranking: RankingEntry[],
  activeScout: string | null
): RankingEntry[] {
  if (!activeScout) return ranking // modo Geral — sem mudança

  const key = SCOUT_FILTERS[activeScout].key

  const filtered = [...ranking].sort((a, b) => {
    const countA = a.scout_counts?.[key] ?? 0
    const countB = b.scout_counts?.[key] ?? 0
    if (countB !== countA) return countB - countA
    // Desempate: total_points desc, depois nome A-Z
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return a.participant_name.localeCompare(b.participant_name, 'pt-BR')
  })

  // Recalcular posições (com empate)
  let previousRank = 0
  let previousCount: number | null = null
  return filtered.map((entry, index) => {
    const count = entry.scout_counts?.[key] ?? 0
    const rank = previousCount !== null && count === previousCount
      ? previousRank
      : index + 1
    previousRank = rank
    previousCount = count
    return { ...entry, rank_position: rank }
  })
}
```

**Ajustes na tabela quando `activeScout` não é nulo:**
- Cabeçalho da coluna PONTOS muda para o label do scout (ex: "PLACAR CRAVADO")
- Célula de pontos em `RankingRow` mostra `scout_counts[key]` em vez de `total_points`
- Líder é definido por `rank_position === 1` (já tratado pela reordenação)
- Rodapé de legenda permanece igual

### Atualização: `components/bolao/RankingRow.tsx`

**Nova prop:** `scoutKey?: keyof ScoutCounts`

Quando `scoutKey` é fornecida:
- A célula PONTOS exibe `entry.scout_counts?.[scoutKey] ?? 0`
- O valor é formatado igual a `total_points` (bold, centralizado)
- Se `scoutKey` não for fornecida, comportamento atual (exibe `total_points`)

**Props atualizadas:**
```typescript
interface RankingRowProps {
  entry: RankingEntry
  isCurrentUser: boolean
  isLeader: boolean
  hideScouts?: boolean
  hidePalpites?: boolean
  scoutKey?: keyof ScoutCounts  // novo
}
```

### Sem mudança em `ScoutBadges.tsx`

O componente de badges (mãe diná, manja muito, etc.) continua funcionando independentemente do scout selecionado.

---

## Regras de Negócio

1. **Modo "Geral" é o padrão:** ranking ordenado por `total_points` como hoje. Nenhuma mudança de comportamento.

2. **Scout selection é client-side:** trocar de scout não dispara nova chamada à API. Os dados (`scout_counts`) já estão disponíveis na resposta do endpoint.

3. **Ordenação por scout:** decrescente pela contagem do scout. Desempate: `total_points` decrescente, depois nome A-Z.

4. **Participantes sem scout_counts:** tratados como contagem 0 (vão para o final da tabela). Isso cobre o caso de `scout_counts: null` (ex: modo por rodada ou usuários sem scores).

5. **Empate na contagem:** mesma posição (`rank_position`) para todos com a mesma contagem (semântica `RANK()` do Postgres).

6. **Compatibilidade com ranking-por-rodada:** quando uma rodada está selecionada (`round` query param), `scout_counts` é `null` e os chips de scout não são exibidos (ou ficam desabilitados).

7. **Compatibilidade com live points:** `applyLivePoints` é aplicado antes de `applyScoutFilter` — a reordenação por scout usa `total_points` para desempate, que já inclui pontos ao vivo.

---

## Proteção de Rotas

Sem mudança. A rota `/ranking` já é protegida e o endpoint `/api/ranking` já exige Bearer JWT.

---

## Integração Supabase Realtime

Sem mudança. O hook `useRankingRealtime` já refaz o fetch ao detectar mudanças em `scores`, o que inclui os `scout_counts` recalculados.

---

## Critérios de Aceite

- [ ] Função `get_ranking_scouts` estendida com 4 novas colunas (`winner_score_count`, `diff_count`, `loser_score_count`, `goleada_count`) via migration idempotente
- [ ] `GET /api/ranking` retorna campo `scout_counts` com as 6 contagens para cada participante (modo Geral); `null` no modo por rodada
- [ ] `lib/types/ranking.ts` inclui interface `ScoutCounts` e campo `scout_counts` em `RankingEntry`
- [ ] Chips de scout renderizados acima da tabela: "GERAL" (padrão) + 6 scouts
- [ ] Ao selecionar um scout, ranking reordenado pela contagem daquele scout (decrescente), com nova numeração de posição
- [ ] Cabeçalho da coluna PONTOS muda para o label do scout selecionado; células exibem a contagem
- [ ] Troca entre scouts é instantânea (client-side, sem loading)
- [ ] Chip ativo destacado em `color-accent` bold; inativos em `color-muted`
- [ ] Chips de scout não aparecem (ou ficam desabilitados) no modo por rodada
- [ ] Voltar para "GERAL" restaura o ranking por pontos totais exatamente como antes
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, uppercase, sem border-radius, sem sombras
- [ ] Funciona em mobile (coluna única, chips com scroll horizontal)
- [ ] `npm run lint` e `npm run build` passam sem erros novos
