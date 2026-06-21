# Spec: Scouts no Ranking

**Slug:** ranking-scouts
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Exibir badges de "scout" ao lado do nome de cada participante na tabela de ranking, calculados com base nos dados reais de `predictions` e `scores` do Supabase, escopados ao grupo ativo. Cada scout identifica um perfil ou comportamento do participante no bolão. Um participante pode acumular mais de um badge simultaneamente. Em casos de empate no critério de um scout, todos os empatados recebem o badge.

---

## Histórias de Usuário

- Como participante do bolão, quero ver badges ao lado de cada nome no ranking para identificar rapidamente os perfis dos outros participantes (quem acerta mais, quem some, quem erra tudo).
- Como participante do bolão, quero que meu próprio badge seja exibido ao lado do meu nome para saber qual perfil o sistema me atribui.
- Como participante do bolão, quero passar o mouse (ou pressionar longamente em mobile) sobre um badge para ver a explicação do que ele significa.

---

## Definição dos Scouts

| Scout | Emoji | Critério | Observação |
|-------|-------|----------|-----------|
| mãe diná | 🔮 | Participante(s) com o maior número de acertos de placar exato (`breakdown->>'exact' > 0` em `scores` de jogos `finished`/`live`) | Empate: todos que atingiram o máximo recebem o badge |
| manja muito | 🧠 | Participante(s) com o maior número de acertos de vencedor (`breakdown->>'winner' > 0` em `scores` de jogos `finished`/`live`) | Empate: todos que atingirem o máximo recebem o badge |
| cego em tiroteio | 🙈 | Participante(s) com o maior número de erros de vencedor em jogos `finished`/`live` com palpite registrado (presença em `predictions` mas ausência de `winner > 0` em `scores` — ou `scores.points = 0`) | Empate: todos que atingirem o máximo recebem o badge; mínimo de 1 jogo com palpite para ser elegível |
| sumido | 👻 | Participante(s) com o menor número de palpites em jogos `finished`/`live` (`predictions_count_active`), tendo feito ao menos 1 palpite nessa categoria | Badge exclusivo de quem tem ao menos 1 palpite. Empate: todos com o mesmo mínimo recebem o badge |
| onde está wally? | 🔭 | Participante(s) que nunca fizeram nenhum palpite no grupo (nenhuma linha em `predictions` com `group_id = p_group_id`) | Não há empate — quem não palpitou é wally. Recebe apenas este badge, não "sumido" |

**Regra de exclusão mútua entre "sumido" e "onde está wally?":** Participantes com `predictions_count_total = 0` para o grupo recebem somente "onde está wally?". Participantes com ao menos 1 palpite no grupo (independentemente do status do jogo) são elegíveis para "sumido" (considerando apenas jogos `live`/`finished`).

---

## Modelo de Dados

### Tabelas consultadas (sem modificação de schema)

Não é necessária nenhuma migration de schema. O cálculo usa as tabelas existentes:

```
scores     (user_id, game_id, group_id, points, breakdown jsonb)
predictions (user_id, game_id, group_id)
games       (id, status)
group_members (user_id, group_id)
profiles    (id, name)
```

### Nova função PostgreSQL: `get_ranking_scouts(p_group_id uuid)`

Uma função separada de `get_ranking()` para não aumentar a complexidade da função principal e manter o contrato existente do endpoint `/api/ranking` intacto.

```sql
CREATE OR REPLACE FUNCTION get_ranking_scouts(p_group_id uuid)
RETURNS TABLE (
  user_id       uuid,
  exact_count   bigint,   -- número de acertos de placar exato (exact > 0)
  winner_count  bigint,   -- número de acertos de vencedor (winner > 0)
  miss_count    bigint,   -- número de erros de vencedor em jogos live/finished com palpite
  pred_active   bigint,   -- palpites em jogos live/finished (para scout "sumido")
  pred_total    bigint    -- palpites em qualquer jogo do grupo (para scout "wally")
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id AS user_id,
    -- acertos de placar exato: scores de jogos live/finished com breakdown->exact > 0
    COALESCE(COUNT(DISTINCT s_exact.game_id), 0)          AS exact_count,
    -- acertos de vencedor: scores de jogos live/finished com breakdown->winner > 0
    COALESCE(COUNT(DISTINCT s_winner.game_id), 0)         AS winner_count,
    -- erros de vencedor: palpites em jogos live/finished onde winner = 0 em scores
    -- (inclui jogos com palpite mas sem score gerado, tratados como winner=0)
    COALESCE(miss_agg.miss_count, 0)                      AS miss_count,
    -- palpites em jogos live/finished
    COALESCE(pred_active_agg.cnt, 0)                      AS pred_active,
    -- palpites em qualquer status (para detectar wally)
    COALESCE(pred_total_agg.cnt, 0)                       AS pred_total
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  -- exact_count
  LEFT JOIN scores s_exact
    ON s_exact.user_id = gm.user_id
   AND s_exact.group_id = p_group_id
   AND (s_exact.breakdown->>'exact')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_exact.game_id AND g.status IN ('live','finished'))
  -- winner_count
  LEFT JOIN scores s_winner
    ON s_winner.user_id = gm.user_id
   AND s_winner.group_id = p_group_id
   AND (s_winner.breakdown->>'winner')::int > 0
   AND EXISTS (SELECT 1 FROM games g WHERE g.id = s_winner.game_id AND g.status IN ('live','finished'))
  -- miss_count: jogos live/finished com palpite registrado mas sem winner > 0 em scores
  LEFT JOIN (
    SELECT
      pr.user_id,
      COUNT(*) AS miss_count
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
      AND NOT EXISTS (
        SELECT 1 FROM scores s
        WHERE s.user_id   = pr.user_id
          AND s.game_id   = pr.game_id
          AND s.group_id  = p_group_id
          AND (s.breakdown->>'winner')::int > 0
      )
    GROUP BY pr.user_id
  ) miss_agg ON miss_agg.user_id = gm.user_id
  -- pred_active: palpites em jogos live/finished
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    JOIN games g ON g.id = pr.game_id AND g.status IN ('live', 'finished')
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_active_agg ON pred_active_agg.user_id = gm.user_id
  -- pred_total: palpites em qualquer status
  LEFT JOIN (
    SELECT pr.user_id, COUNT(*) AS cnt
    FROM predictions pr
    WHERE pr.group_id = p_group_id
    GROUP BY pr.user_id
  ) pred_total_agg ON pred_total_agg.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
  GROUP BY p.id, miss_agg.miss_count, pred_active_agg.cnt, pred_total_agg.cnt;
$$;
```

**Nota sobre `miss_count`:** o `NOT EXISTS` garante que jogos `live` onde o trigger ainda não calculou `scores` (placar parcial) também contem como "erro" provisório — o participante palpitou mas ainda não ganhou winner. Esse comportamento é aceitável e consistente com a natureza parcial de jogos ao vivo.

### Migrations necessárias

**Arquivo:** `supabase/migrations/20260621100000_create_ranking_scouts_function.sql`

Conteúdo: criação da função `get_ranking_scouts(p_group_id uuid)` conforme SQL acima, usando `CREATE OR REPLACE` para ser idempotente.

---

## Lógica de atribuição de badges (no servidor)

O cálculo dos badges é feito no `app/api/ranking/route.ts`, após receber os dados de `get_ranking_scouts()`. O algoritmo é:

```
dados = get_ranking_scouts(group_id)  // array de linhas por usuário

max_exact  = MAX(exact_count)  dos participantes
max_winner = MAX(winner_count) dos participantes
max_miss   = MAX(miss_count)   dos participantes onde miss_count >= 1
min_active = MIN(pred_active)  dos participantes onde pred_total >= 1 (wally excluído)

Para cada participante:
  badges = []

  if pred_total == 0:
    badges.push('onde_esta_wally')

  else:
    if pred_total >= 1 AND min_active > 0 AND pred_active == min_active:
      badges.push('sumido')

    if max_exact > 0 AND exact_count == max_exact:
      badges.push('mae_dina')

    if max_winner > 0 AND winner_count == max_winner:
      badges.push('manja_muito')

    if max_miss > 0 AND miss_count == max_miss:
      badges.push('cego_em_tiroteio')
```

**Casos extremos:**
- Torneio sem nenhum jogo `finished`/`live`: nenhum participante recebe mae_dina, manja_muito ou cego_em_tiroteio; possível "sumido" apenas se pred_active = 0 mas pred_total >= 1 (todos teriam min_active = 0, então o scout não deve ser atribuído — min_active deve ser > 0 para ser elegível). Se min_active = 0, "sumido" não é atribuído a ninguém.
- Todos os participantes com o mesmo exact_count > 0: todos recebem "mãe diná" — correto pelo critério de empate.
- Todos com pred_total = 0: todos recebem "onde está wally?".

---

## Backend — Endpoint atualizado

### GET /api/ranking

**Mudança:** a rota existente `app/api/ranking/route.ts` é estendida para realizar uma segunda chamada RPC `get_ranking_scouts(p_group_id)` e calcular os badges server-side antes de retornar o JSON.

**Autenticação:** Bearer JWT (sem mudança)

**Query params:** `group_id` (UUID, obrigatório — sem mudança)

**Resposta de sucesso — novo formato (200):**
```json
[
  {
    "rank_position": 1,
    "user_id": "uuid",
    "participant_name": "João",
    "total_points": 47,
    "games_predicted": 8,
    "aproveitamento": 65,
    "predictions_count": 12,
    "scouts": ["mae_dina", "manja_muito"]
  },
  {
    "rank_position": 2,
    "user_id": "uuid",
    "participant_name": "Maria",
    "total_points": 0,
    "games_predicted": 0,
    "aproveitamento": 0,
    "predictions_count": 0,
    "scouts": ["onde_esta_wally"]
  }
]
```

**Campo `scouts`:** array de strings, pode ser vazio `[]`. Valores possíveis: `"mae_dina"`, `"manja_muito"`, `"cego_em_tiroteio"`, `"sumido"`, `"onde_esta_wally"`.

**Erros possíveis:** sem mudança (401, 400, 403, 500).

**Implementação em `route.ts`:**
1. Executar `get_ranking()` como hoje.
2. Executar `get_ranking_scouts()` em paralelo (via `Promise.all`).
3. Calcular os badges conforme pseudocódigo acima.
4. Combinar os resultados: para cada entrada de `get_ranking()`, adicionar o campo `scouts: string[]` correspondente ao `user_id`.

---

## Frontend — Componentes React

### Atualização: `lib/types/ranking.ts`

Adicionar `scouts: string[]` à interface `RankingEntry`:

```typescript
export interface RankingEntry {
  rank_position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  aproveitamento: number
  predictions_count: number
  scouts: string[]  // novo
}
```

### Novo componente: `components/bolao/ScoutBadges.tsx`

**Arquivo:** `components/bolao/ScoutBadges.tsx`

**Props:**
```typescript
interface ScoutBadgesProps {
  scouts: string[]
}
```

**Mapa de scouts:**
```typescript
const SCOUT_META: Record<string, { emoji: string; label: string }> = {
  mae_dina:           { emoji: '🔮', label: 'Mãe Diná — mais placares exatos' },
  manja_muito:        { emoji: '🧠', label: 'Manja Muito — mais vencedores acertados' },
  cego_em_tiroteio:   { emoji: '🙈', label: 'Cego em Tiroteio — mais vencedores errados' },
  sumido:             { emoji: '👻', label: 'Sumido — fez o menor número de palpites' },
  onde_esta_wally:    { emoji: '🔭', label: 'Onde está Wally? — nunca palpitou neste grupo' },
}
```

**Comportamento:**
- Renderiza uma `<span>` por scout, cada uma com `title={label}` (tooltip nativo do browser — sem biblioteca).
- Se `scouts` for vazio ou `undefined`, não renderiza nada (retorna `null`).
- Badges aparecem em linha (`display: inline-flex`, `gap: '0.25rem'`), imediatamente após o nome do participante na célula.
- Fonte tamanho `14px` (herda a linha do `<tr>`).

**Exemplo de output:**
```tsx
<span title="Mãe Diná — mais placares exatos">🔮</span>
<span title="Manja Muito — mais vencedores acertados">🧠</span>
```

### Atualização: `components/bolao/RankingRow.tsx`

Na célula "PARTICIPANTE" (segundo `<td>`), após o nome e o sufixo "(VOCÊ)", inserir `<ScoutBadges scouts={entry.scouts ?? []} />`.

Layout resultante da célula:
```
► JOÃO (VOCÊ) 🔮 🧠
```

Os badges ficam após o nome na mesma linha. A célula já tem `overflow: hidden` + `textOverflow: ellipsis` + `whiteSpace: nowrap` — os badges ficam dentro desse contexto e podem ser cortados em telas muito estreitas, o que é aceitável (tooltip garante acesso ao significado). Para mitigar o corte, o `<ScoutBadges>` deve ser renderizado como `display: inline-flex` com `flexShrink: 0` para ter prioridade sobre o nome no espaço disponível.

**Ordem dos badges na linha:** seguir a ordem do array `scouts` retornada pelo backend (sem reordenação no frontend).

### Sem mudança em `RankingTable.tsx`

Nenhuma nova coluna é adicionada. Os badges ficam embutidos na célula PARTICIPANTE existente, sem impacto no layout da tabela.

---

## Regras de Negócio

1. **Scouts são escopados por grupo:** toda query usa `group_id = p_group_id`; scouts de um grupo nunca influenciam outro.

2. **Apenas jogos `finished` ou `live` contam para acertos/erros:** palpites de jogos `pending` não entram nos critérios de mãe diná, manja muito, cego em tiroteio, nem no pred_active de "sumido".

3. **"onde está wally?" versus "sumido":** são mutuamente exclusivos. Wally tem prioridade: se `pred_total == 0`, o participante só recebe wally, nunca sumido.

4. **"sumido" exige pred_total >= 1 E min_active > 0:** o participante deve ter feito ao menos 1 palpite em qualquer jogo do grupo (senão seria wally), e o mínimo de palpites ativos deve ser > 0 para o scout fazer sentido (se todos estão com 0 ativos, ninguém é "sumido" nessa categoria ainda).

5. **Empate:** quando mais de um participante atingir o valor máximo (para mãe diná, manja muito, cego em tiroteio) ou o valor mínimo (para sumido), todos recebem o badge. O critério de empate é numérico — todos que atingem o threshold extremo são incluídos.

6. **"cego em tiroteio" exige ao menos 1 palpite em jogo live/finished:** `miss_count >= 1`. Se o máximo de misses for 0, o badge não é atribuído a ninguém.

7. **Eficiência:** apenas 2 chamadas ao banco por request (`get_ranking` e `get_ranking_scouts`), ambas em paralelo via `Promise.all`. Nenhum N+1.

8. **Realtime:** o hook `useRankingRealtime` já refaz o fetch de `/api/ranking` ao receber eventos em `scores`. Como os scouts agora são calculados dentro do mesmo endpoint, eles se atualizam automaticamente junto com o ranking sem nenhuma mudança adicional de Realtime.

---

## Proteção de Rotas

Sem mudança. A rota `/ranking` já é protegida e o endpoint `/api/ranking` já exige Bearer JWT e membership no grupo.

---

## Integração Supabase Realtime

Sem canal adicional. O hook `useRankingRealtime` existente já subscreve `scores` e refaz fetch completo de `/api/ranking` — o que inclui os scouts recalculados — ao detectar mudanças.

---

## Critérios de Aceite

- [ ] Função `get_ranking_scouts(p_group_id uuid)` criada via migration idempotente (`CREATE OR REPLACE`)
- [ ] `GET /api/ranking` retorna campo `scouts: string[]` para cada participante (pode ser array vazio)
- [ ] Participantes sem nenhum palpite recebem `scouts: ["onde_esta_wally"]` e não recebem "sumido"
- [ ] Participantes com ao menos 1 palpite total, mas com o menor número de palpites em jogos live/finished, recebem "sumido"
- [ ] Em empate no critério de qualquer scout, todos os empatados recebem o badge
- [ ] Se nenhum jogo está live/finished, nenhum badge de acerto/erro é atribuído (mãe diná, manja muito, cego) — sem erro ou badge indevido
- [ ] Componente `ScoutBadges` renderiza emojis com `title` attribute (tooltip nativo) e retorna `null` para arrays vazios
- [ ] Badges aparecem na célula PARTICIPANTE de `RankingRow` ao lado do nome, sem quebrar o layout mobile (375px)
- [ ] `lib/types/ranking.ts` inclui `scouts: string[]` em `RankingEntry`
- [ ] As duas chamadas RPC são feitas em paralelo (`Promise.all`) — sem N+1
- [ ] Design segue DESIGN.md: fonte monospace herdada da linha, sem ícones SVG decorativos externos, emojis como representação visual
- [ ] `npm run lint` e `npm run build` passam sem erros novos
