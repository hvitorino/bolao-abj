# Spec: Confrontos Contribuintes por Troféu

**Slug:** trophy-contributing-games
**Data:** 2026-06-21
**Status:** spec

---

## Objetivo

Dentro do card de cada troféu na aba `/perfil`, exibir abaixo da descrição a lista de jogos finalizados que efetivamente contribuíram para o progresso daquele troféu, no formato: `[Bandeira casa] [Código casa] [Placar casa] x [Placar visitante] [Código visitante] [Bandeira visitante]`.

---

## Histórias de Usuário

- Como participante do bolão, quero ver quais jogos específicos contribuíram para cada troféu meu, para entender minha performance e saber o que falta para desbloquear os troféus que ainda não tenho.
- Como participante com troféu desbloqueado, quero ver os jogos que me fizeram ganhar aquele troféu, para relembrar meus acertos.
- Como participante com troféu ainda bloqueado e em progresso, quero ver os jogos que já contam para o critério, para acompanhar meu avanço.

---

## Modelo de Dados

### Nenhuma tabela nova ou migration necessária

Esta feature é puramente computada a partir das tabelas existentes:
- `scores` (user_id, game_id, group_id, points, breakdown jsonb)
- `games` (id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, match_date)
- `predictions` (user_id, game_id, group_id, home_score, away_score)
- `position_snapshots` (group_id, user_id, rank_position, snapshot_at)

A modificação é apenas no endpoint existente `GET /api/profile/trophies` e no componente `TrophiesPanel.tsx`.

---

## Backend — Endpoints Ruby/Sinatra

Não há endpoints Ruby envolvidos. A modificação é no Route Handler Next.js existente.

---

## Backend — Route Handler Next.js

### GET /api/profile/trophies (modificação do existente)

**Arquivo:** `app/api/profile/trophies/route.ts`

**Autenticação:** Bearer JWT requerido (inalterado)

**Query params:** `group_id` (inalterado)

**Mudança no contrato de resposta:**

A interface `TrophyResult` existente ganha um campo adicional obrigatório:

```typescript
interface TrophyResult {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  contributing_games: ContributingGame[]  // NOVO
}

interface ContributingGame {
  game_id: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}
```

**Resposta de sucesso (200) — exemplo com novo campo:**
```json
{
  "trophies": [
    {
      "id": "cravada",
      "name": "CRAVADA",
      "status": "unlocked",
      "unlocked_at": "2026-06-12T18:00:00Z",
      "progress": 3,
      "progress_max": 5,
      "contributing_games": [
        {
          "game_id": "uuid-...",
          "home_team_code": "BRA",
          "away_team_code": "ARG",
          "home_score": 2,
          "away_score": 1
        }
      ]
    }
  ]
}
```

**Erros possíveis:** inalterados (401, 400, 403, 500)

---

### Mapeamento troféu → jogos contribuintes

Para cada um dos 15 troféus, os "jogos contribuintes" são definidos como segue. O backend já busca os dados necessários na `calcTrophies`; a maioria das queries apenas precisa incluir os campos de times e placar do join com `games`.

#### Troféus com 1 jogo contribuinte (ponto de desbloqueio ou critério único)

| Troféu | Critério | Jogo contribuinte |
|--------|----------|-------------------|
| `estreia` | primeiro palpite enviado | O jogo do primeiro palpite (via join `predictions → games`). Requer nova query: `predictions` JOIN `games` WHERE `user_id` AND `group_id` ORDER `submitted_at ASC` LIMIT 1. Selecionar `game_id, home_team_code, away_team_code, home_score, away_score`. |
| `abriu_o_placar` | primeiro acerto de vencedor | Query existente já retorna `game_id`; adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select. |
| `rei_da_goleada` | primeiro bônus de goleada | Query existente já retorna `game_id`; adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select. |
| `perfeito_na_rodada` | acertou o vencedor em todos os jogos de um dia | Todos os jogos do `match_day` em que o critério foi atendido. |
| `fiel` | palpitou em todos os jogos de um dia | Todos os jogos do `match_day` em que o critério foi atendido. |
| `cartola` | já ocupou o 1º lugar | Troféu baseado em snapshot de posição; não há jogo específico contribuinte. `contributing_games: []`. |
| `podio` | fechou uma rodada no top 3 | Troféu baseado em snapshot de posição; não há jogo específico contribuinte. `contributing_games: []`. |
| `zebreiro` | acertou o vencedor num jogo em que a maioria errou | O jogo específico onde a condição "maioria errou" foi satisfeita pela primeira vez. Query existente já determina esse game_id; adicionar join com `games`. |

#### Troféus com N jogos contribuintes (todos que já contaram)

| Troféu | Critério | Jogos contribuintes |
|--------|----------|---------------------|
| `cravada` | primeiro placar exato | Query existente `cravadaRes` já retorna todos os `game_id` com `breakdown->>exact > 0`. Adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select. Todos os jogos da lista são contribuintes. |
| `profeta` | 5 placares exatos no total | Os mesmos jogos de `cravada` (são os placares exatos). Reutilizar `cravadaItems` — exibir todos os jogos com placar exato (mesmo se já passou de 5). |
| `vidente` | 25 acertos de vencedor | Query existente `videnteRes` já retorna game_ids com `breakdown->>winner > 0` (limitado a 25). Adicionar `games(...)` ao select e remover o `limit(25)` para buscar todos os acertos. |
| `artilheiro` | 100 pontos acumulados | Query existente `artilheiroRes` já retorna todos os scores. Os jogos contribuintes são todos os que têm `points > 0` (scores que contribuíram com pontos). Adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select existente. |
| `embalado` | sequência de 3 acertos consecutivos | Os 3 jogos consecutivos da sequência que atingiu o limiar de 3. Derivado de `streakHistory` — identificar a janela de 3 scores onde a sequência completou. |
| `em_chamas` | sequência de 5 acertos consecutivos | Os 5 jogos consecutivos da sequência que atingiu 5. Derivado de `streakHistory`. |
| `imparavel` | sequência de 8 acertos consecutivos | Os 8 jogos consecutivos da sequência que atingiu 8. Derivado de `streakHistory`. |

---

### Detalhamento das mudanças em `calcTrophies`

#### 1. Adicionar `games(home_team_code, away_team_code, home_score, away_score)` nas queries existentes

As queries que precisam de atualização no `select`:

- `abrioRes`: adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select existente `game_id, games(match_date)`
- `cravadaRes`: idem — usado tanto para `cravada` quanto para `profeta`
- `goleadaRes`: idem
- `profetaRes`: idem (limitado a 5)
- `videnteRes`: modificar — remover `limit(25)`, adicionar campos do join com games
- `artilheiroRes`: adicionar `games(home_team_code, away_team_code, home_score, away_score)` ao select existente

A variável `streakHistory` já seleciona `games(match_date)` — adicionar `home_team_code, away_team_code, home_score, away_score` ao select de `games`.

#### 2. Nova query para `estreia`

A query existente de `estreia` usa `predictions.select('submitted_at')` sem join em games. É necessária uma nova query com join:

```typescript
sc
  .from('predictions')
  .select('game_id, games(home_team_code, away_team_code, home_score, away_score)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('submitted_at', { ascending: true })
  .limit(1)
  .maybeSingle()
```

O campo `submitted_at` não precisa mais ser retornado porque `estreiaAt` pode ser obtido de outra forma — na prática, manter ambos no select é mais seguro. Ajustar a extração de `estreiaAt` para `estreiaRes.data?.submitted_at`.

#### 3. Nova função auxiliar `extractContributingGame`

```typescript
function extractContributingGame(row: unknown): ContributingGame | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const gameId = r.game_id as string | undefined
  if (!gameId) return null
  const games = r.games
  if (!games) return null
  const g = Array.isArray(games) ? (games[0] as Record<string, unknown>) : (games as Record<string, unknown>)
  if (!g) return null
  const homeScore = g.home_score as number | null
  const awayScore = g.away_score as number | null
  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) return null
  return {
    game_id: gameId,
    home_team_code: g.home_team_code as string,
    away_team_code: g.away_team_code as string,
    home_score: homeScore,
    away_score: awayScore,
  }
}
```

**Regra importante:** se `home_score` ou `away_score` for `null` (jogo sem placar finalizado), omitir o jogo da lista de contribuintes — só incluir jogos com placar completo.

#### 4. Função `findStreakContributingGames(threshold)`

Derivada da lógica existente de `findStreakUnlockDate`:

```typescript
function findStreakContributingGames(threshold: number): ContributingGame[] {
  if (!streakHistory || bestStreak < threshold) return []
  let current: ContributingGame[] = []
  for (const row of streakHistory as Array<Record<string, unknown>>) {
    const bd = row.breakdown as Record<string, number> | null
    const winner = Number(bd?.winner ?? 0)
    if (winner > 0) {
      const game = extractContributingGame(row)
      if (game) current.push(game)
      if (current.length >= threshold) {
        return current.slice(-threshold)  // janela exata dos N jogos da sequência
      }
    } else {
      current = []
    }
  }
  return []
}
```

#### 5. Lógica para `perfeito_na_rodada` e `fiel`

Quando `perfeitaAt` ou `fielAt` são calculados no loop existente, capturar os `game_id` do `match_day` correspondente e fazer join com `games` para obter os campos necessários. Alternativa mais simples: após identificar o `match_day`, executar uma query adicional:

```typescript
// Após encontrar o dia perfeito
const { data: perfeitaGames } = await sc
  .from('games')
  .select('id, home_team_code, away_team_code, home_score, away_score')
  .eq('match_day', perfeitaDay)
  .eq('status', 'finished')
```

Usar `id` como `game_id` no `ContributingGame`.

#### 6. Lógica para `zebreiro`

A query existente `userWins` itera para encontrar o primeiro jogo onde a maioria errou. Quando esse jogo é encontrado, construir um `ContributingGame` a partir do `win` — mas é necessário join com `games` para ter `home_team_code`, `away_team_code`, `home_score`, `away_score`. Alterar o select de `userWins`:

```typescript
sc
  .from('scores')
  .select('game_id, games(home_team_code, away_team_code, home_score, away_score, match_date)')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .filter('breakdown->>winner', 'gt', '0')
  .order('calculated_at', { ascending: true })
```

#### 7. Atualizar `makeTrophy` para receber `contributing_games`

```typescript
function makeTrophy(
  id: string,
  unlockedAt: string | null,
  progress: number | null = null,
  progressMax: number | null = null,
  contributingGames: ContributingGame[] = []
): TrophyResult {
  return {
    id,
    name: TROPHY_NAMES[id],
    status: unlockedAt ? 'unlocked' : 'locked',
    unlocked_at: unlockedAt,
    progress,
    progress_max: progressMax,
    contributing_games: contributingGames,
  }
}
```

#### 8. Montagem final do array de troféus

```typescript
// Extrações de contributing_games por troféu:

// estreia: jogo do primeiro palpite
const estreiaGame = extractContributingGame(estreiaRes.data)
const estreiaGames = estreiaGame ? [estreiaGame] : []

// abriu_o_placar: o primeiro jogo com acerto de vencedor
const abrioGame = extractContributingGame(abrioRes.data)
const abrioGames = abrioGame ? [abrioGame] : []

// cravada: todos os jogos com placar exato (cravadaItems)
const cravadaGames = (cravadaItems as unknown[])
  .map(extractContributingGame)
  .filter((g): g is ContributingGame => g !== null)

// rei_da_goleada: o primeiro jogo com goleada
const goleadaGame = extractContributingGame(goleadaRes.data)
const goleadaGames = goleadaGame ? [goleadaGame] : []

// embalado, em_chamas, imparavel: janelas de sequência
const embaladoGames = findStreakContributingGames(3)
const emChamasGames = findStreakContributingGames(5)
const imparavelGames = findStreakContributingGames(8)

// profeta: os mesmos jogos de cravada (reutiliza cravadaGames)
const profetaGames = cravadaGames  // todos os placares exatos

// vidente: todos os jogos com acerto de vencedor
const videnteGames = (videnteItems as unknown[])
  .map(extractContributingGame)
  .filter((g): g is ContributingGame => g !== null)

// artilheiro: jogos com points > 0 (excluir scores de 0 pontos)
const artilheiroGames = artItems
  .filter((r) => Number(r.points ?? 0) > 0)
  .map(extractContributingGame)
  .filter((g): g is ContributingGame => g !== null)

// perfeito_na_rodada: jogos do dia perfeito
// zebreiro: o jogo onde a maioria errou
// cartola, podio: []
```

---

## Frontend — Componentes React

### TrophiesPanel (modificação)

**Arquivo:** `components/bolao/perfil/TrophiesPanel.tsx`

**Interface `Trophy` — campo adicional:**

```typescript
export interface Trophy {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  contributing_games: ContributingGame[]  // NOVO
}

export interface ContributingGame {
  game_id: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}
```

**Renderização da lista de jogos contribuintes**

Abaixo de cada `TROPHY_CRITERIA[trophy.id]`, renderizar a seção de confrontos contribuintes:

```
Regras visuais:
- Exibir somente se contributing_games.length > 0
- Layout: lista vertical de linhas, separadas por espaçamento mínimo
- Cada linha: [FLAG_CASA] [COD_CASA] [SCORE_CASA] × [SCORE_VISIT] [COD_VISIT] [FLAG_VISIT]
- Fonte: 11px, color-muted para troféus locked; color-win para troféus unlocked
- Sem bullet points, sem separadores entre linhas de jogos
- Máximo de linhas visíveis (não há limite — exibir todos os contribuintes)
- Se contributing_games.length === 0 E o troféu não tem critério baseado em jogo (cartola, podio):
    não exibir nada (estado vazio silencioso)
- Se contributing_games.length === 0 E o troféu tem critério baseado em jogo (ex: cravada locked sem nenhum placar exato ainda):
    não exibir nenhuma listagem (silêncio — não exibir "nenhum jogo ainda")
```

**Exemplo de wireframe ASCII para um troféu desbloqueado:**

```
┌──────────────────────────────────────────────────────┐
│ ✓ CRAVADA                            11 JUN 2026     │
│   primeiro placar exato                              │
│   🇧🇷 BRA  2 × 0  ARG 🇦🇷            ← cor: win       │
│   🇩🇪 GER  1 × 1  ESP 🇪🇸                            │
│   🇫🇷 FRA  3 × 0  MAR 🇲🇦                            │
├──────────────────────────────────────────────────────┤
│ ✗ PROFETA                             2/5 ██░░░      │
│   5 placares exatos no total                         │
│   🇧🇷 BRA  2 × 0  ARG 🇦🇷            ← cor: muted     │
│   🇩🇪 GER  1 × 1  ESP 🇪🇸                            │
└──────────────────────────────────────────────────────┘
```

**Detalhamento da renderização:**

```tsx
// Dentro do card de cada troféu, após o bloco de TROPHY_CRITERIA:
{trophy.contributing_games.length > 0 && (
  <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
    {trophy.contributing_games.map((game) => (
      <div
        key={game.game_id}
        style={{
          fontSize: '11px',
          color: trophy.status === 'unlocked' ? 'var(--color-win)' : 'var(--color-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        <span>{getTeamFlag(game.home_team_code)}</span>
        <span>{game.home_team_code}</span>
        <span>{game.home_score}</span>
        <span>×</span>
        <span>{game.away_score}</span>
        <span>{game.away_team_code}</span>
        <span>{getTeamFlag(game.away_team_code)}</span>
      </div>
    ))}
  </div>
)}
```

**Import necessário:**

```typescript
import { getTeamFlag } from '@/lib/utils/teamFlag'
```

---

## Regras de Negócio

### Quais jogos contam como contribuintes por troféu

| Troféu | Jogos contribuintes |
|--------|---------------------|
| `estreia` | O jogo onde o primeiro palpite foi submetido (join predictions→games) |
| `abriu_o_placar` | O primeiro jogo com `breakdown.winner > 0` |
| `cravada` | Todos os jogos com `breakdown.exact > 0` |
| `rei_da_goleada` | O primeiro jogo com `breakdown.goleada > 0` |
| `embalado` | Os 3 jogos consecutivos exatos da sequência que atingiu 3 |
| `em_chamas` | Os 5 jogos consecutivos exatos da sequência que atingiu 5 |
| `imparavel` | Os 8 jogos consecutivos exatos da sequência que atingiu 8 |
| `profeta` | Todos os jogos com `breakdown.exact > 0` (mesmos de `cravada`) |
| `vidente` | Todos os jogos com `breakdown.winner > 0` |
| `artilheiro` | Todos os jogos com `points > 0` |
| `perfeito_na_rodada` | Todos os jogos do `match_day` em que todos os acertos foram corretos |
| `fiel` | Todos os jogos do `match_day` em que todos os palpites foram feitos |
| `cartola` | Nenhum (baseado em snapshot de posição) → `contributing_games: []` |
| `zebreiro` | O jogo onde o acerto ocorreu e a maioria dos participantes errou |
| `podio` | Nenhum (baseado em snapshot de posição) → `contributing_games: []` |

### Restrições de exibição

1. Somente jogos com `home_score !== null && away_score !== null` aparecem na lista. Se o placar for nulo, o jogo é omitido silenciosamente.
2. Para troféus locked com progresso zero (sem nenhum jogo contribuinte ainda): a seção de jogos simplesmente não aparece — sem mensagem de estado vazio explícita.
3. Para troféus locked com algum progresso: exibir os jogos que já contam (mesmo o troféu ainda não tendo sido desbloqueado).
4. Para troféus unlocked: exibir todos os jogos que contribuíram.
5. Para `cartola` e `podio` (sem jogo associável): `contributing_games` sempre é `[]` → seção nunca renderiza.

### Sequências (embalado/em_chamas/imparavel)

Para troféus de sequência **não desbloqueados**, a lógica de `findStreakContributingGames` retorna `[]` porque `bestStreak < threshold`. A seção de jogos contribuintes não renderiza nesses troféus.

Para troféus de sequência **desbloqueados**, a lógica retorna os N jogos da janela exata que completou a sequência pela primeira vez (os últimos N acertos consecutivos antes de atingir o threshold). Esta janela não necessariamente é a melhor sequência histórica — é a primeira que atingiu o limiar.

---

## Proteção de Rotas

Sem mudança. O endpoint já requer autenticação Bearer JWT e a rota `/perfil` já é protegida.

---

## Integração Supabase Realtime

Não se aplica. Esta feature é puramente fetch sob demanda no mount do componente (mesmo padrão atual do `PerfilDashboard`).

---

## Critérios de Aceite

- [ ] O endpoint `GET /api/profile/trophies` retorna `contributing_games: ContributingGame[]` para todos os 15 troféus
- [ ] `contributing_games` contém apenas jogos com `home_score` e `away_score` não-nulos
- [ ] Para `estreia`: lista com 1 jogo (o jogo do primeiro palpite), ou `[]` se ainda sem palpite
- [ ] Para `abriu_o_placar`: lista com 1 jogo (o primeiro acerto de vencedor), ou `[]`
- [ ] Para `cravada`: lista com todos os jogos com placar exato (inclusive se troféu ainda locked com progresso parcial)
- [ ] Para `rei_da_goleada`: lista com 1 jogo (o primeiro acerto de goleada), ou `[]`
- [ ] Para `embalado`, `em_chamas`, `imparavel`: lista com exatamente N jogos da sequência que desbloqueou o troféu, ou `[]` se não desbloqueado
- [ ] Para `profeta`: lista com todos os jogos com placar exato (mesmos de `cravada`)
- [ ] Para `vidente`: lista com todos os jogos com acerto de vencedor
- [ ] Para `artilheiro`: lista com todos os jogos com `points > 0`
- [ ] Para `perfeito_na_rodada`: lista com todos os jogos do dia perfeito, ou `[]`
- [ ] Para `fiel`: lista com todos os jogos do dia de fidelidade, ou `[]`
- [ ] Para `cartola` e `podio`: sempre `[]`
- [ ] Para `zebreiro`: lista com 1 jogo (o acerto onde a maioria errou), ou `[]`
- [ ] `TrophiesPanel.tsx` exibe a lista de jogos contribuintes abaixo da descrição de cada troféu
- [ ] Cada jogo é exibido no formato: `[Flag] [COD] [Score] × [Score] [COD] [Flag]`
- [ ] Bandeiras obtidas via `getTeamFlag()` de `lib/utils/teamFlag.ts`
- [ ] Troféus unlocked: jogos em `color-win`; troféus locked: jogos em `color-muted`
- [ ] Se `contributing_games.length === 0`, a seção de jogos não renderiza (sem mensagem de estado vazio)
- [ ] Layout do card existente não quebra com a adição da listagem
- [ ] Design segue DESIGN.md: JetBrains Mono, 11px, sem bordas arredondadas, sem ícones decorativos além das bandeiras emoji
- [ ] Funciona em mobile (coluna única, fonte 11px legível)
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
