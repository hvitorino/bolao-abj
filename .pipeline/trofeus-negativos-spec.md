# Spec: Troféus Negativos e Anti-Platina

**Slug:** trofeus-negativos
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Adicionar 9 troféus negativos com tom humorístico e autoirônico ao painel de perfil (`TrophiesPanel`), calculados em `app/api/profile/trophies/route.ts` sem nenhuma migração de banco. Inclui um achievement "Anti-Platina" (`COLECIONADOR DO CAOS`) calculado em runtime na UI quando todos os 9 negativos estão desbloqueados. Os negativos formam um conjunto separado dos 15 troféus positivos existentes e não interferem na platina positiva.

---

## Histórias de Usuário

- Como participante, quero ver conquistas negativas humorísticas no meu perfil para rir das minhas azaras sem me sentir julgado
- Como participante, quero ver o progresso das sequências negativas (NAUFRAGANDO, À DERIVA, SEM VOLTA) para saber o quão perto estou de "conquistar" o caos
- Como participante, quero ver o achievement COLECIONADOR DO CAOS quando desbloquear todos os 9 negativos, como troféu irônico de anti-platina
- Como participante, quero que o header do painel mostre minha contagem de vergonhas separada dos troféus normais

---

## Modelo de Dados

### Nenhuma migração necessária

Todos os 9 troféus negativos são derivados das tabelas existentes:

```
predictions (id, user_id, game_id, group_id, home_score, away_score, submitted_at)
scores      (id, user_id, game_id, group_id, prediction_id, points, breakdown jsonb, calculated_at)
games       (id, home_team, away_team, home_team_code, away_team_code, match_date, match_day, home_score, away_score, status, round)
position_snapshots (id, user_id, group_id, rank_position, snapshot_at, created_at)
```

O campo `breakdown` de `scores` é um JSONB com chaves: `winner`, `exact`, `winner_score`, `diff`, `loser_score`, `goleada`. Todos como inteiros.

---

## Interface TypeScript

### `NegativeTrophy`

Arquivo: `app/api/profile/trophies/route.ts` (e re-exportado em `components/bolao/perfil/TrophiesPanel.tsx`)

```typescript
interface NegativeTrophy {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null   // ISO string da data de ocorrência, ou null
  progress: number | null      // só para progressivos (naufragando/a_deriva/sem_volta)
  progress_max: number | null  // só para progressivos
  contributing_games: ContributingGame[]  // reutiliza interface já existente
}
```

`NegativeTrophy` é estruturalmente idêntica a `TrophyResult` existente. Pode ser o mesmo tipo com reuso, mas deve ser mantida conceitualmente separada via array próprio na resposta da API.

### Nomes dos troféus negativos

```typescript
const NEGATIVE_TROPHY_NAMES: Record<string, string> = {
  placar_espelhado:  'PLACAR ESPELHADO',
  ultima_hora:       'ÚLTIMA HORA',
  trono_de_papel:    'TRONO DE PAPEL',
  quase:             'QUASE',
  solitario_do_erro: 'SOLITÁRIO DO ERRO',
  dia_ruim:          'DIA RUIM',
  naufragando:       'NAUFRAGANDO',
  a_deriva:          'À DERIVA',
  sem_volta:         'SEM VOLTA',
}
```

### Critérios de exibição (subtexto)

```typescript
const NEGATIVE_TROPHY_CRITERIA: Record<string, string> = {
  placar_espelhado:  'acertou os números, errou o lado',
  ultima_hora:       'não é procrastinação, é estratégia',
  trono_de_papel:    'subiu pra cair',
  quase:             'tão perto, tão longe',
  solitario_do_erro: 'o único que não viu',
  dia_ruim:          'o sol não saiu hoje',
  naufragando:       'sequência de 3 erros consecutivos',
  a_deriva:          'sequência de 5 erros consecutivos',
  sem_volta:         'sequência de 8 erros consecutivos',
}
```

---

## Backend — `calcNegativeTrophies()` em `route.ts`

### Localização e assinatura

Adicionar função `calcNegativeTrophies` logo após `calcTrophies` (ou no mesmo arquivo, antes do `GET`):

```typescript
async function calcNegativeTrophies(
  sc: SupabaseClient,
  groupId: string,
  userId: string,
  streakHistory: Array<Record<string, unknown>>  // reutilizado da chamada já feita em calcTrophies
): Promise<TrophyResult[]>
```

O `streakHistory` já é buscado dentro de `calcTrophies`. Para evitar duplicar a query, deve ser extraído para fora de `calcTrophies` e passado para ambas as funções. Ver seção "Refatoração necessária em `calcTrophies`" abaixo.

### Resposta da API — campo adicional

O handler `GET` atual retorna `{ trophies }`. Deve passar a retornar:

```json
{
  "trophies": [...],
  "negativeTrophies": [...]
}
```

---

## Implementação dos 9 Troféus Negativos

### `makeNegativeTrophy` (helper)

```typescript
function makeNegativeTrophy(
  id: string,
  unlockedAt: string | null,
  progress: number | null = null,
  progressMax: number | null = null,
  contributingGames: ContributingGame[] = []
): TrophyResult {
  return {
    id,
    name: NEGATIVE_TROPHY_NAMES[id],
    status: unlockedAt ? 'unlocked' : 'locked',
    unlocked_at: unlockedAt,
    progress,
    progress_max: progressMax,
    contributing_games: contributingGames,
  }
}
```

### Queries executadas em paralelo via `Promise.all`

As queries abaixo são todas independentes entre si. Executar via `Promise.all` junto com as demais queries da API.

---

#### 1. `placar_espelhado`

**Critério:** palpitou `home×away` mas o resultado real foi `away×home` (mesmos placares, lados trocados).

**Condições SQL:**
- `predictions.user_id = userId` e `predictions.group_id = groupId`
- `games.status = 'finished'`
- `predictions.home_score = games.away_score`
- `predictions.away_score = games.home_score`
- Os placares não podem ser empate (home_score != away_score no resultado) — caso contrário todo empate com palpite invertido seria "espelhado". Adicionar condição: `games.home_score != games.away_score`

**Query Supabase:**
```typescript
sc
  .from('predictions')
  .select('game_id, home_score, away_score, games!inner(home_team_code, away_team_code, home_score, away_score, match_date, status)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .eq('games.status', 'finished')
  .order('games.match_date', { ascending: true })
  .limit(50)
// Filtrar no JS: rows onde pred.home_score === game.away_score
//   && pred.away_score === game.home_score
//   && game.home_score !== game.away_score
```

**`unlocked_at`:** `games.match_date` da primeira ocorrência.
**`contributing_games`:** o jogo da primeira ocorrência.

---

#### 2. `ultima_hora`

**Critério:** palpite enviado com ≤10 minutos de antecedência ao início do jogo (`submitted_at >= match_date - interval '10 minutes'`), mas ainda dentro do prazo (`submitted_at < match_date`).

**Query Supabase:**
```typescript
sc
  .from('predictions')
  .select('game_id, submitted_at, games!inner(home_team_code, away_team_code, home_score, away_score, match_date, status)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('games.match_date', { ascending: true })
  .limit(200)
// Filtrar no JS: rows onde
//   new Date(row.submitted_at) >= new Date(matchDate).getTime() - 10*60*1000
//   && new Date(row.submitted_at) < new Date(matchDate)
```

**`unlocked_at`:** `games.match_date` da primeira ocorrência.
**`contributing_games`:** o jogo da primeira ocorrência.

---

#### 3. `trono_de_papel`

**Critério:** usuário estava em 1º lugar em algum snapshot (`rank_position = 1`) e no snapshot imediatamente seguinte estava em posição > 1.

**Estratégia:** buscar todos os snapshots do usuário em ordem cronológica e verificar pares consecutivos.

**Fallback quando não há snapshots suficientes (< 2):** se houver exatamente 1 snapshot com `rank_position = 1`, verificar posição atual via `get_ranking()`. Se posição atual > 1, considerar desbloqueado com `unlocked_at` do snapshot.

**Query Supabase:**
```typescript
sc
  .from('position_snapshots')
  .select('rank_position, snapshot_at')
  .eq('group_id', groupId)
  .eq('user_id', userId)
  .order('snapshot_at', { ascending: true })
```

**Lógica JS:**
```typescript
// Para cada par (snapshots[i], snapshots[i+1]):
//   se snapshots[i].rank_position === 1 && snapshots[i+1].rank_position > 1
//     → unlocked_at = snapshots[i+1].snapshot_at
//     → break
```

**`unlocked_at`:** `snapshot_at` do segundo snapshot do par (momento da queda).
**`contributing_games`:** `[]` (não há jogo associado a posição de ranking).

---

#### 4. `quase`

**Critério:** acertou o vencedor (`breakdown.winner > 0`), não acertou o placar exato (`breakdown.exact = 0`), e a soma das diferenças absolutas entre palpite e resultado = 1.

```
|pred_home - game_home| + |pred_away - game_away| = 1
```

**Query Supabase:**
```typescript
sc
  .from('scores')
  .select('game_id, breakdown, predictions!inner(home_score, away_score), games!inner(home_team_code, away_team_code, home_score, away_score, match_date)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .filter('breakdown->>winner', 'gt', '0')
  .filter('breakdown->>exact', 'eq', '0')
  .order('calculated_at', { ascending: true })
// Filtrar no JS: rows onde
//   Math.abs(pred.home_score - game.home_score) + Math.abs(pred.away_score - game.away_score) === 1
```

**`unlocked_at`:** `games.match_date` da primeira ocorrência.
**`contributing_games`:** o jogo da primeira ocorrência.

---

#### 5. `solitario_do_erro`

**Critério:** usuário errou o vencedor (`breakdown.winner = 0`) num jogo em que > 70% dos outros participantes do grupo acertou.

**Estratégia:** buscar todos os scores do usuário onde `winner = 0` e para cada jogo calcular a taxa de acertos do grupo.

**Query principal:**
```typescript
sc
  .from('scores')
  .select('game_id, breakdown, games!inner(home_team_code, away_team_code, home_score, away_score, match_date)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .filter('breakdown->>winner', 'eq', '0')
  .order('calculated_at', { ascending: true })
```

**Para cada jogo da lista (em sequência, interrompendo no primeiro match):**
```typescript
const [{ count: totalPreds }, { count: correctPreds }] = await Promise.all([
  sc.from('predictions').select('id', { count: 'exact', head: true })
    .eq('game_id', gameId).eq('group_id', groupId),
  sc.from('scores').select('id', { count: 'exact', head: true })
    .eq('game_id', gameId).eq('group_id', groupId)
    .filter('breakdown->>winner', 'gt', '0'),
])
// Se (correctPreds / totalPreds) > 0.70 → desbloqueado
```

**`unlocked_at`:** `games.match_date` do primeiro jogo que satisfaz a condição.
**`contributing_games`:** o jogo da primeira ocorrência.

**Nota:** este troféu faz queries sequenciais por jogo (análogo ao `zebreiro` já existente). Aceitável dado o contexto (bolão pequeno).

---

#### 6. `dia_ruim`

**Critério:** dia em que o usuário tinha ≥ 2 palpites em jogos finalizados e não acertou nenhum vencedor (`SUM(breakdown.winner) = 0` no dia).

**Estratégia:** agrupar os scores do usuário por `match_day` e verificar dias onde acertos = 0 e total de palpites ≥ 2.

**Query Supabase:**
```typescript
sc
  .from('scores')
  .select('game_id, breakdown, games!inner(match_day, home_team_code, away_team_code, home_score, away_score, match_date)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('games.match_date', { ascending: true })
```

**Lógica JS:**
```typescript
// Agrupar por match_day
const byDay = Map<string, Array<{ breakdown, game }>>
for (const row of scores) {
  const day = row.games.match_day
  byDay.get(day).push(row)
}
// Para cada dia em ordem cronológica:
//   se byDay[day].length >= 2 && byDay[day].every(r => Number(r.breakdown.winner) === 0)
//     → unlocked_at = primeiro match_date do dia
//     → contributing_games = todos os jogos do dia
```

**`unlocked_at`:** `match_date` do primeiro jogo do dia ruim.
**`contributing_games`:** todos os jogos daquele dia.

---

### Progressivos — Sequências Negativas

Os três troféus abaixo reutilizam o `streakHistory` (array de scores em ordem cronológica, com `breakdown` e dados do `games` join) já buscado na query existente em `calcTrophies`. A lógica é o inverso de `findStreakUnlockDate`/`findStreakContributingGames`: incrementa quando `breakdown.winner === 0`, reseta quando `breakdown.winner > 0`.

#### Refatoração necessária em `calcTrophies`

O `streakHistory` atualmente é buscado **dentro** de `calcTrophies` com `await` após o `Promise.all` inicial:

```typescript
const { data: streakHistory } = await sc
  .from('scores')
  .select('game_id, breakdown, games(match_date, home_team_code, away_team_code, home_score, away_score)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('calculated_at', { ascending: true })
```

Para reutilizá-lo em `calcNegativeTrophies`, deve ser movido para fora de `calcTrophies` e passado como parâmetro para ambas as funções. A assinatura de `calcTrophies` deve ser atualizada para:

```typescript
async function calcTrophies(
  sc: SupabaseClient,
  groupId: string,
  userId: string,
  streakHistory: Array<Record<string, unknown>>
): Promise<TrophyResult[]>
```

E o `GET` handler passa a buscar o `streakHistory` uma única vez antes de chamar ambas as funções:

```typescript
const { data: streakHistory } = await sc
  .from('scores')
  .select('game_id, breakdown, games(match_date, home_team_code, away_team_code, home_score, away_score)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('calculated_at', { ascending: true })

const [trophies, negativeTrophies] = await Promise.all([
  calcTrophies(serviceClient, groupId, user.id, streakHistory ?? []),
  calcNegativeTrophies(serviceClient, groupId, user.id, streakHistory ?? []),
])
```

#### Funções de streak negativa

```typescript
// Melhor sequência negativa (equivalente ao `bestStreak` mas para erros)
function calcBestNegativeStreak(history: Array<Record<string, unknown>>): number {
  let best = 0
  let current = 0
  for (const row of history) {
    const bd = row.breakdown as Record<string, number> | null
    const winner = Number(bd?.winner ?? 0)
    if (winner === 0) {
      current++
      if (current > best) best = current
    } else {
      current = 0
    }
  }
  return best
}

function findNegativeStreakUnlockDate(history: Array<Record<string, unknown>>, threshold: number): string | null {
  let current = 0
  for (const row of history) {
    const bd = row.breakdown as Record<string, number> | null
    const winner = Number(bd?.winner ?? 0)
    if (winner === 0) {
      current++
      if (current >= threshold) {
        return extractMatchDate(row)
      }
    } else {
      current = 0
    }
  }
  return null
}

function findNegativeStreakContributingGames(history: Array<Record<string, unknown>>, threshold: number): ContributingGame[] {
  let current: ContributingGame[] = []
  for (const row of history) {
    const bd = row.breakdown as Record<string, number> | null
    const winner = Number(bd?.winner ?? 0)
    if (winner === 0) {
      const game = extractContributingGame(row)
      if (game) current.push(game)
      if (current.length >= threshold) {
        return current.slice(-threshold)
      }
    } else {
      current = []
    }
  }
  return []
}
```

#### 7. `naufragando` — threshold 3

```typescript
const bestNeg = calcBestNegativeStreak(streakHistory)
const naufragandoAt = findNegativeStreakUnlockDate(streakHistory, 3)
const naufragandoGames = findNegativeStreakContributingGames(streakHistory, 3)
makeNegativeTrophy('naufragando', naufragandoAt, Math.min(bestNeg, 3), 3, naufragandoGames)
```

#### 8. `a_deriva` — threshold 5

```typescript
const aDerivaAt = findNegativeStreakUnlockDate(streakHistory, 5)
const aDerivaGames = findNegativeStreakContributingGames(streakHistory, 5)
makeNegativeTrophy('a_deriva', aDerivaAt, Math.min(bestNeg, 5), 5, aDerivaGames)
```

#### 9. `sem_volta` — threshold 8

```typescript
const semVoltaAt = findNegativeStreakUnlockDate(streakHistory, 8)
const semVoltaGames = findNegativeStreakContributingGames(streakHistory, 8)
makeNegativeTrophy('sem_volta', semVoltaAt, Math.min(bestNeg, 8), 8, semVoltaGames)
```

---

### Ordem dos negativos na resposta

Os negativos **não** são ordenados por data de desbloqueio. Retornar sempre na ordem fixa:

```
placar_espelhado, ultima_hora, trono_de_papel, quase, solitario_do_erro, dia_ruim, naufragando, a_deriva, sem_volta
```

---

## Resposta da API

### `GET /api/profile/trophies?group_id=<uuid>`

**Antes (atual):**
```json
{
  "trophies": [/* 15 TrophyResult */]
}
```

**Depois:**
```json
{
  "trophies": [/* 15 TrophyResult — inalterados */],
  "negativeTrophies": [/* 9 NegativeTrophy em ordem fixa */]
}
```

Nenhum campo existente é removido ou alterado. A adição é aditiva.

---

## Frontend — `TrophiesPanel.tsx`

### Interface `TrophiesData` — atualizar

```typescript
export interface TrophiesData {
  trophies: Trophy[]
  negativeTrophies: Trophy[]  // mesmo tipo Trophy — estrutura idêntica
}
```

### Critérios negativos — adicionar ao componente

```typescript
const NEGATIVE_TROPHY_CRITERIA: Record<string, string> = {
  placar_espelhado:  'acertou os números, errou o lado',
  ultima_hora:       'não é procrastinação, é estratégia',
  trono_de_papel:    'subiu pra cair',
  quase:             'tão perto, tão longe',
  solitario_do_erro: 'o único que não viu',
  dia_ruim:          'o sol não saiu hoje',
  naufragando:       'sequência de 3 erros consecutivos',
  a_deriva:          'sequência de 5 erros consecutivos',
  sem_volta:         'sequência de 8 erros consecutivos',
}
```

### Header do painel — atualizar

**Antes:**
```
TROFÉUS                              12 / 15
```

**Depois:**
```
TROFÉUS                   12/15 · VERGONHA 3/9
```

Implementação:
```tsx
const unlocked = trophies.filter((t) => t.status === 'unlocked')
const unlockedNeg = negativeTrophies.filter((t) => t.status === 'unlocked')

// Header:
<span>TROFÉUS</span>
<span style={{ color: 'var(--color-muted)' }}>
  {unlocked.length}/{trophies.length} · VERGONHA {unlockedNeg.length}/9
</span>
```

### Seção positiva — sem alteração

Os 15 troféus positivos permanecem exatamente como estão.

### Divisor entre seções

Após o último troféu positivo, antes da seção negativa:
```tsx
<div style={{
  borderTop: '1px solid var(--color-border)',
  margin: '0',
}} />
```

### Header da seção negativa

```tsx
<div style={{
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-error)',
  padding: '0.5rem 1rem',
  borderBottom: '1px solid var(--color-border)',
}}>
  CONQUISTAS IMPROVÁVEIS
</div>
```

### Card do Anti-Platina (`COLECIONADOR DO CAOS`)

Calculado em runtime: `negativeTrophies.every(t => t.status === 'unlocked')`.

Exibido **no topo da seção negativa** (antes dos 9 troféus negativos), somente quando desbloqueado:

```tsx
{isAntiPlatina && (
  <div style={{
    padding: '0.5rem 1rem',
    borderBottom: '1px solid var(--color-border)',
    border: '1px solid var(--color-error)',
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--color-error)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
        ✗ COLECIONADOR DO CAOS
      </span>
    </div>
    <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-error)' }}>
      desbloqueou todos os 9 troféus negativos — parabéns, campeão do caos
    </div>
  </div>
)}
```

### Cards dos 9 troféus negativos

Renderizados em grid vertical, abaixo do card do Anti-Platina (ou abaixo do header se Anti-Platina bloqueado).

**Troféu negativo desbloqueado:**
- Prefixo: `✗` (ASCII, irônico — o ✗ passa a ser de honra)
- Cor do nome: `var(--color-error)`
- Data de desbloqueio: `var(--color-error)` (se disponível)
- Critério: `var(--color-muted)`
- `contributing_games`: renderizados com `ContributingGameLine` passando `unlocked={false}` (borda `color-border`, cor `color-muted`) — os negativos nunca usam cor verde

**Troféu negativo bloqueado:**
- Prefixo: `○`
- Cor do nome: `var(--color-muted)`
- Critério: `var(--color-muted)`
- Sem data

**Troféus progressivos (naufragando, a_deriva, sem_volta) — barra de progresso:**
- Exibir barra de progresso igual aos positivos de sequência quando `progress !== null && progress_max !== null`
- Usar a função `renderBar` já existente
- Cor da barra: `var(--color-muted)` (não verde, não erro — muted tanto para locked quanto unlocked nesses casos)

```tsx
{trophy.progress !== null && trophy.progress_max && (
  <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
    {trophy.progress}/{trophy.progress_max}{' '}
    <span style={{ letterSpacing: '0.05em' }}>{renderBar(trophy.progress / trophy.progress_max)}</span>
  </span>
)}
```

### Estrutura completa da seção negativa no JSX

```
[Divisor]
[Header "CONQUISTAS IMPROVÁVEIS"]
[Card Anti-Platina — só se isAntiPlatina]
[Card placar_espelhado]
[Card ultima_hora]
[Card trono_de_papel]
[Card quase]
[Card solitario_do_erro]
[Card dia_ruim]
[Card naufragando]     ← com barra de progresso
[Card a_deriva]        ← com barra de progresso
[Card sem_volta]       ← com barra de progresso
```

### Tratamento de `negativeTrophies` ausente (backward compat)

Caso `state.data.negativeTrophies` seja `undefined` (resposta antiga em cache), renderizar apenas a seção positiva sem erro:

```typescript
const negativeTrophies = state.data.negativeTrophies ?? []
```

---

## Outros arquivos que consomem `TrophiesData`

Verificar se outros arquivos importam `TrophiesData` ou fazem fetch de `/api/profile/trophies` e atualizar para incluir o campo `negativeTrophies` onde necessário.

Buscar por: `TrophiesData`, `profile/trophies`, `trophies: Trophy[]` no codebase.

---

## Regras de Negócio

### `placar_espelhado`
- Empates não geram placar espelhado (ex: palpite 1×1 com resultado 1×1 — trivialmente `pred.home = game.away` mas é o mesmo jogo). Condição `games.home_score !== games.away_score` obrigatória.

### `ultima_hora`
- Janela: `submitted_at >= match_date - 10 minutos` E `submitted_at < match_date`.
- Palpite enviado exatamente no deadline (5 min antes) ENTRA na janela de 10 min — o critério é independente do deadline de negócio.
- A comparação deve ser feita em milissegundos no JS após receber os dados.

### `trono_de_papel`
- Se o usuário tem apenas 1 snapshot e ele é `rank_position = 1`, usar posição atual via `get_ranking()` como "próximo estado".
- Se não há nenhum snapshot, `trono_de_papel` fica locked.

### `quase`
- A condição `|diff| = 1` se aplica somente quando `winner > 0` e `exact = 0`.
- Não pode ser triggered por empate com um dos placares errado por 1 gol — o critério de `winner > 0` garante que o vencedor foi acertado.

### `solitario_do_erro`
- Threshold: `correctPreds / totalPreds > 0.70` (estrito, não >=).
- Excluir o próprio usuário do cálculo de `totalPreds`? Não — as queries de `zebreiro` existente não excluem, manter consistente.

### `dia_ruim`
- Só contar scores de jogos com status `finished` (via join com `games` ou filtro em `scores`).
- Mínimo de 2 palpites no dia (não apenas 1 azar isolado).

### Sequências negativas (`naufragando`, `a_deriva`, `sem_volta`)
- "Erro" = `breakdown.winner === 0`. Jogo sem palpite NÃO conta (não há score).
- Sequência quebra quando `breakdown.winner > 0`.
- `progress` para os 3 progressivos = `Math.min(bestNegativeStreak, threshold)`.
- Exemplos: `bestNeg = 4` → naufragando progress = 3/3 (desbloqueado), a_deriva progress = 4/5, sem_volta progress = 4/8.

---

## Proteção de Rotas

Nenhuma rota nova. O endpoint existente `GET /api/profile/trophies` já tem autenticação Bearer JWT e verificação de membership. Nenhuma alteração nas políticas de proteção.

---

## Integração Supabase Realtime

Nenhuma. Os troféus (positivos e negativos) são calculados sob demanda ao carregar o perfil. Sem canal Realtime novo.

---

## Critérios de Aceite

- [ ] Os 9 troféus negativos são calculados e retornados em `negativeTrophies` pela API
- [ ] `placar_espelhado` detecta corretamente placares trocados, excluindo empates
- [ ] `ultima_hora` detecta palpites enviados nos últimos 10 minutos antes do início
- [ ] `trono_de_papel` detecta queda do 1º lugar em snapshots consecutivos
- [ ] `quase` detecta acerto de vencedor com placar errado por 1 gol somado
- [ ] `solitario_do_erro` detecta erro quando > 70% do grupo acertou
- [ ] `dia_ruim` detecta dia com ≥ 2 palpites e 0 acertos de vencedor
- [ ] `naufragando` destrava com sequência negativa de 3 e exibe progress/progress_max
- [ ] `a_deriva` destrava com sequência negativa de 5 e exibe progress/progress_max
- [ ] `sem_volta` destrava com sequência negativa de 8 e exibe progress/progress_max
- [ ] Header do painel exibe `TROFÉUS 12/15 · VERGONHA 3/9` com contagem real
- [ ] Seção "CONQUISTAS IMPROVÁVEIS" aparece abaixo dos 15 troféus positivos
- [ ] Troféus negativos desbloqueados: prefixo `✗`, cor `var(--color-error)`
- [ ] Troféus negativos bloqueados: prefixo `○`, cor `var(--color-muted)`
- [ ] Troféus progressivos negativos exibem barra de progresso com `renderBar`
- [ ] Anti-Platina (`COLECIONADOR DO CAOS`) aparece no topo da seção negativa somente quando todos os 9 negativos estão desbloqueados
- [ ] Card do Anti-Platina tem borda em `var(--color-error)` e fundo levemente tingido
- [ ] `negativeTrophies` ausente (undefined) não quebra o componente — fallback para `[]`
- [ ] `streakHistory` é buscado uma única vez e passado para ambas as funções (sem query duplicada)
- [ ] Design segue DESIGN.md: JetBrains Mono, tokens CSS, sem sombras, dark only, sem border-radius decorativo
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
- [ ] Funciona em mobile (coluna única, texto truncado quando necessário)
