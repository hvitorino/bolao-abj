# Spec: Sequência de Acertos

**Slug:** streak-de-acertos
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Exibir no ranking a sequência atual de vitórias consecutivas de cada participante — o número de jogos encerrados seguidos em que o participante acertou ao menos o vencedor, sem interrupção por erro ou ausência de palpite. O streak zera imediatamente quando o participante erra o vencedor ou não faz palpite em um jogo já encerrado.

---

## Histórias de Usuário

- Como participante do bolão, quero ver no ranking minha sequência atual de acertos para saber se estou "em fase".
- Como participante, quero ver a sequência dos outros para ter contexto de quem está em momento positivo.
- Como participante, quero que a sequência de 0 não apareça de forma destacada para não poluir o ranking.

---

## Modelo de Dados

### Tabelas existentes utilizadas

Nenhuma tabela nova é necessária. A lógica lê diretamente de:

- `games(id, status, match_date)` — filtra por `status = 'finished'` e ordena por `match_date DESC`
- `predictions(user_id, game_id, group_id, home_score, away_score)` — palpite do participante
- `scores(user_id, game_id, group_id, breakdown jsonb)` — `breakdown->>'winner'` indica acerto do vencedor

### Migrations necessárias

Uma migration nova que cria a função SQL `get_streak_for_group(p_group_id uuid)`.

**Arquivo:** `supabase/migrations/20260621300000_create_streak_function.sql`

```sql
CREATE OR REPLACE FUNCTION get_streak_for_group(p_group_id uuid)
RETURNS TABLE (
  user_id    uuid,
  streak     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Para cada membro do grupo, percorre os jogos encerrados do mais recente
  -- para o mais antigo. A sequência é o número de jogos consecutivos iniciais
  -- em que (a) o membro fez palpite E (b) acertou o vencedor (breakdown->>'winner' > 0).
  -- A sequência para no primeiro jogo onde qualquer uma das condições falha.
  WITH
  members AS (
    SELECT gm.user_id
    FROM group_members gm
    WHERE gm.group_id = p_group_id
  ),
  finished_games AS (
    SELECT g.id AS game_id,
           ROW_NUMBER() OVER (ORDER BY g.match_date DESC, g.id DESC) AS rn
    FROM games g
    WHERE g.status = 'finished'
  ),
  -- Para cada membro × jogo encerrado, determina se houve acerto do vencedor
  -- (has_prediction = TRUE e winner_pts > 0) ou não (palpite ausente ou errado).
  member_game_results AS (
    SELECT
      m.user_id,
      fg.game_id,
      fg.rn,
      CASE
        WHEN p.id IS NOT NULL AND COALESCE((s.breakdown->>'winner')::int, 0) > 0
        THEN TRUE
        ELSE FALSE
      END AS hit
    FROM members m
    CROSS JOIN finished_games fg
    LEFT JOIN predictions p
      ON p.user_id = m.user_id
     AND p.game_id = fg.game_id
     AND p.group_id = p_group_id
    LEFT JOIN scores s
      ON s.user_id = m.user_id
     AND s.game_id = fg.game_id
     AND s.group_id = p_group_id
  ),
  -- Primeiro jogo (mais antigo em sequência a partir do mais recente)
  -- em que o participante NÃO acertou. O streak é o número de jogos
  -- com rn < esse ponto. Se nunca errou, streak = total de jogos encerrados.
  first_miss AS (
    SELECT
      user_id,
      MIN(rn) AS miss_rn
    FROM member_game_results
    WHERE hit = FALSE
    GROUP BY user_id
  ),
  total_finished AS (
    SELECT COUNT(*) AS cnt FROM finished_games
  )
  SELECT
    m.user_id,
    COALESCE(fm.miss_rn - 1, tf.cnt)::bigint AS streak
  FROM members m
  LEFT JOIN first_miss fm ON fm.user_id = m.user_id
  CROSS JOIN total_finished tf
$$;
```

**Notas sobre a lógica:**
- `rn = 1` = jogo encerrado mais recente; `rn = 2` = segundo mais recente, etc.
- Se o primeiro `miss` (rn do primeiro erro/ausência) é `rn = 3`, então o streak é `3 - 1 = 2` (acertou os 2 mais recentes).
- Se nunca errou (sem `first_miss`), o streak é `total de jogos encerrados`.
- Se errou logo no jogo mais recente (`miss_rn = 1`), o streak é `0`.

---

## Backend — Endpoint Next.js

### GET /api/ranking

**Sem novo endpoint.** O endpoint existente `app/api/ranking/route.ts` é estendido.

**Mudança:** no modo GERAL (quando `round` não está presente ou é `"GERAL"`), chamar a nova RPC `get_streak_for_group` em paralelo com as RPCs já existentes (`get_ranking` e `get_ranking_scouts`).

```typescript
// Modo geral: três RPCs em paralelo
const [rankingResult, scoutsResult, streakResult] = await Promise.all([
  serviceClient.rpc('get_ranking', { p_group_id: groupId }),
  serviceClient.rpc('get_ranking_scouts', { p_group_id: groupId }),
  serviceClient.rpc('get_streak_for_group', { p_group_id: groupId }),
])
```

O streak é incorporado ao objeto de resposta por `user_id`:

```typescript
const streakByUser: Record<string, number> = {}
for (const row of (streakResult.data ?? [])) {
  streakByUser[row.user_id] = Number(row.streak)
}

// No map final:
{
  ...camposExistentes,
  streak: streakByUser[entry.user_id] ?? 0,
}
```

**Modo por rodada:** `streak: 0` (sem chamar a RPC adicional — consistente com o tratamento de `scouts` e `predictions_count` no modo por rodada).

**Erro de RPC:** se `streakResult.error`, logar e retornar `streak: 0` para todos (não deve bloquear a resposta de ranking).

---

## Frontend — Componentes React

### Tipo `RankingEntry` (lib/types/ranking.ts)

Adicionar o campo:

```typescript
export interface RankingEntry {
  // ... campos existentes ...
  streak: number  // sequência atual de acertos consecutivos
}
```

### RankingRow (components/bolao/RankingRow.tsx)

Exibir o streak na célula `PARTICIPANTE`, após os scout badges e antes do sufixo `(VOCÊ)`, quando o valor for maior que 0.

Layout da célula PARTICIPANTE após a mudança:

```
► NOME_DO_PARTICIPANTE 🔥×5 (VOCÊ) 🎯 🌀
                       ^^^^^
              streak visível apenas quando > 0
```

Especificação do elemento:

```tsx
{entry.streak > 0 && (
  <span
    title={`${entry.streak} acerto${entry.streak !== 1 ? 's' : ''} consecutivo${entry.streak !== 1 ? 's' : ''}`}
    style={{
      fontSize: '11px',
      color: 'var(--color-win)',
      marginLeft: '0.4rem',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontWeight: 'bold',
      flexShrink: 0,
    }}
  >
    🔥×{entry.streak}
  </span>
)}
```

**Posicionamento:** O `<span>` do streak deve vir **antes** de `(VOCÊ)` e **antes** dos `ScoutBadges`, na sequência:

```
{isLeader ? '► ' : '   '}{entry.participant_name}
{streak > 0 → 🔥×N}
{isCurrentUser → (VOCÊ)}
{!hideScouts → <ScoutBadges>}
```

**Props:** Nenhuma prop nova necessária em `RankingRow`. O valor `entry.streak` já está disponível via `RankingEntry`.

**Modo por rodada:** `hideScouts` já existe. O streak usa `entry.streak === 0` naturalmente (streak vem como 0 no modo por rodada), portanto não precisa de nova prop de controle — a condição `entry.streak > 0` cuida disso.

### RankingTable (components/bolao/RankingTable.tsx)

**Sem mudança estrutural no `RankingTable`:** o streak não adiciona coluna nova — é exibido inline na célula PARTICIPANTE. Nenhuma nova coluna no `<thead>` é necessária.

**Legenda no rodapé:** adicionar entrada `🔥×N SEQ. ATUAL` na legenda do rodapé (apenas no modo GERAL, junto com a legenda de scouts existente):

```tsx
{!isRoundMode && entry de legenda de streak}
```

Exemplo de legenda a acrescentar na seção de rodapé:

```tsx
<span style={{ ...MONO, fontSize: '11px', color: 'var(--color-win)' }}>
  🔥 SEQUÊNCIA DE ACERTOS
</span>
```

---

## Regras de Negócio

### Definição de "acerto" para o streak

Um jogo conta como acerto para o streak se e somente se:
1. O jogo tem `status = 'finished'`
2. O participante fez palpite para esse jogo (`predictions` tem linha com `user_id + game_id + group_id`)
3. O campo `breakdown->>'winner'` em `scores` é maior que `0`

**Atenção:** Se `scores` não tem linha para o palpite (ex: score ainda não calculado para jogo recém-encerrado), o palpite conta como **ausência** (não acerto), pois `winner = 0` por default.

### Definição de "quebra" do streak

O streak zera em qualquer jogo encerrado onde:
- O participante **não fez palpite** (ausência), OU
- O participante fez palpite mas `breakdown->>'winner' = 0` (errou o vencedor)

### Ordenação dos jogos para cálculo

O streak percorre os jogos encerrados do **mais recente para o mais antigo** (`ORDER BY match_date DESC`). A sequência é a contagem de acertos consecutivos começando do jogo mais recente — como uma "fase atual" do participante.

### Streak = 0

Participantes com streak 0 **não exibem nenhum indicador visual** (a condição `entry.streak > 0` garante isso). Streak 0 pode significar: o participante errou o último jogo, não fez palpite no último jogo, ou não há jogos encerrados ainda.

### Modo por rodada

No modo por rodada, `streak` vem como `0` da API (não calculado). O indicador visual não aparece — comportamento correto pois o streak é uma métrica "ao vivo" do momento atual, não filtrada por fase.

### Realtime

Nenhuma assinatura Realtime adicional. O `useRankingRealtime` já refaz fetch do endpoint `GET /api/ranking` ao detectar mudanças em `scores`, o que inclui o streak recalculado. O streak atualiza junto com o ranking normalmente.

---

## Proteção de Rotas

Nenhuma rota nova. A rota `/ranking` já é protegida. O endpoint `GET /api/ranking` já exige autenticação Bearer JWT e verifica membership no grupo.

---

## Integração Supabase Realtime

Nenhuma mudança. O Realtime já está configurado no `useRankingRealtime` para ouvir mudanças em `scores`. Ao encerrar um jogo e calcular pontuações, o trigger Postgres insere/atualiza `scores`, o Realtime dispara, o hook refaz fetch do endpoint, e o streak é recalculado junto.

---

## Critérios de Aceite

- [ ] Participante com 3 acertos consecutivos nos jogos mais recentes vê `🔥×3` na célula de seu nome no ranking
- [ ] Participante com streak 0 (errou o último jogo ou não palpitou) não vê nenhum indicador `🔥`
- [ ] Participante que nunca palpitou tem streak 0 e não vê indicador
- [ ] A ordem das linhas do ranking não é alterada pelo streak (ordenação continua por `total_points DESC`)
- [ ] No modo por rodada, nenhum indicador de streak é exibido (streak = 0 pelo backend)
- [ ] Tooltip (`title`) do elemento `🔥×N` exibe texto legível: "N acerto(s) consecutivo(s)"
- [ ] A legenda no rodapé do ranking (modo GERAL) inclui `🔥 SEQUÊNCIA DE ACERTOS`
- [ ] `npm run lint` e `npm run build` passam sem erros novos
- [ ] Design segue DESIGN.md: JetBrains Mono, `color-win` para o streak, inline na célula PARTICIPANTE, sem nova coluna, sem ícones SVG externos
- [ ] Funciona em mobile 375px sem scroll horizontal (inline na célula, sem coluna extra)
