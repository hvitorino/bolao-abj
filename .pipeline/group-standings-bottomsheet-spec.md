# Spec: Classificação do Grupo no Bottom Sheet

**Slug:** group-standings-bottomsheet
**Data:** 2026-06-29
**Status:** spec

---

## Objetivo

Adicionar ao Bottom Sheet de detalhes do jogo (`GameAnaliseDrawer`) uma seção de classificação do grupo, exibindo o estado da tabela do grupo **antes** do confronto em questão — isto é, considerando apenas jogos do mesmo grupo com `status = 'finished'` e `match_date < match_date_do_jogo_exibido`. Para jogos de mata-mata, a seção não é exibida.

---

## Histórias de Usuário

- Como participante do bolão, quero ver a classificação do grupo antes do confronto no bottom sheet de análise para entender o contexto do jogo e embasar melhor meu palpite.
- Como participante, quero que os dois times do confronto sejam destacados visualmente na tabela para identificá-los de imediato.
- Como participante, quero que a tabela mostre o estado da classificação como estava **naquele momento** (antes do jogo), não o estado atual completo.

---

## Modelo de Dados

Não há alteração de schema. A feature usa a tabela `games` já existente:

```sql
games (
  id uuid,
  home_team text,
  away_team text,
  home_team_code char(3),
  away_team_code char(3),
  match_date timestamptz,
  home_score int,    -- null se status != 'finished'
  away_score int,
  status text,       -- 'pending' | 'live' | 'finished'
  round text         -- 'Grupo A' ... 'Grupo L' | 'Oitavas' | 'Quartas' | 'Semi' | 'Final'
)
```

**Identificação da fase de grupos:** `round` começa com `"Grupo"` (ex: `"Grupo A"`, `"Grupo B"`, ..., `"Grupo L"`).

**Nenhuma migration necessária.**

---

## Decisão Arquitetural: Estratégia de Dados

Três opções consideradas:

| Opção | Descrição | Decisão |
|-------|-----------|---------|
| A — Estender `/api/analise-data` | Adicionar query + cálculo à rota existente, retornar `groupStandings` no mesmo JSON | **Escolhida** |
| B — Novo Route Handler `/api/group-standings` | Endpoint dedicado chamado separadamente pelo drawer | Descartada |
| C — Query client-side no Supabase | Componente faz fetch direto ao Supabase | Descartada |

**Justificativa para Opção A:** a rota `/api/analise-data` já tem autenticação, membership check e o objeto `game` (incluindo `round` e `match_date`) resolvido. Adicionar uma query a `games` filtrada por `round` é trivial e evita round-trip extra. O pattern é idêntico ao que já existe com `calculateTeamStats`. Opção B duplica auth logic. Opção C viola o padrão arquitetural do projeto (dados sensíveis passam pelo route handler com membership check).

---

## Backend — Extensão do Route Handler Existente

### GET /api/analise-data (extensão)

**Arquivo:** `app/api/analise-data/route.ts`

**Autenticação:** requerida (já implementada)

**Parâmetros existentes:** `gameId`, `groupId`

**Alterações:**

Após a query do jogo principal (step 3), adicionar:

**Step 4b — Verificar se é jogo de grupo e buscar jogos do grupo:**

```typescript
// Verifica se é fase de grupos
const isGroupStage = game.round?.startsWith('Grupo') ?? false

let allGroupGames: GameRow[] = []
if (isGroupStage) {
  const { data: groupGameRows } = await supabase
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round'
    )
    .eq('round', game.round)
    .order('match_date', { ascending: true })

  allGroupGames = groupGameRows ?? []
}
```

**Step 7b — Calcular classificação:**

```typescript
import { calculateGroupStandings } from '@/lib/analytics/group-standings'

const groupStandings = isGroupStage
  ? calculateGroupStandings(allGroupGames, game.match_date)
  : null
```

**Resposta de sucesso — adicionado ao JSON existente:**

```json
{
  "game": { "...": "..." },
  "participants": [],
  "homeStats": {},
  "awayStats": {},
  "homeRecentGames": [],
  "awayRecentGames": [],
  "groupStandings": [
    {
      "position": 1,
      "teamCode": "BRA",
      "teamName": "Brasil",
      "points": 6,
      "played": 2,
      "wins": 2,
      "draws": 0,
      "losses": 0,
      "goalsFor": 5,
      "goalsAgainst": 1,
      "goalDifference": 4
    }
  ]
}
```

`groupStandings` é `null` para jogos de mata-mata.

**Erros possíveis:** nenhum novo — a query de jogos do grupo usa `.eq('round', game.round)` que retorna array vazio em caso de falha, sem lançar erro.

---

## Novo Módulo de Lógica

### lib/analytics/group-standings.ts

**Arquivo:** `lib/analytics/group-standings.ts`

**Propósito:** calcular a tabela de classificação de um grupo a partir dos jogos.

**Tipo exportado:**

```typescript
export type StandingEntry = {
  position: number
  teamCode: string
  teamName: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}
```

**Função exportada:**

```typescript
export function calculateGroupStandings(
  allGroupGames: GameRow[], // todos os jogos do grupo (qualquer status, qualquer data)
  beforeDate: string        // match_date do jogo exibido (ISO string)
): StandingEntry[]
```

**Lógica detalhada:**

```
1. Extrair todos os times únicos do grupo a partir de allGroupGames:
   - Para cada jogo: adicionar home_team_code + home_team e away_team_code + away_team ao mapa de times

2. Inicializar acumulador para cada time:
   { teamCode, teamName, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }

3. Filtrar jogos que contam para a classificação:
   - status === 'finished'
   - home_score !== null && away_score !== null
   - new Date(match_date).getTime() < new Date(beforeDate).getTime()

4. Para cada jogo filtrado:
   homeScore vs awayScore:
   - Se homeScore > awayScore: home recebe win (+3 pts), away recebe loss
   - Se homeScore === awayScore: ambos recebem draw (+1 pt)
   - Se homeScore < awayScore: away recebe win (+3 pts), home recebe loss
   - Incrementar: played += 1, goalsFor += myScore, goalsAgainst += oppScore

5. Ordenar times:
   Critério 1: points DESC
   Critério 2: goalDifference DESC
   Critério 3: goalsFor DESC
   Critério 4: teamName ASC (localeCompare pt-BR)

6. Atribuir position (1-based) e retornar array de StandingEntry
```

**Nota:** Se `allGroupGames` é vazio (impossível em produção mas defensivo), retorna `[]`.

---

## Frontend — Novo Componente

### GroupStandingsCard

**Arquivo:** `components/bolao/GroupStandingsCard.tsx`

**Props:**

```typescript
interface GroupStandingsCardProps {
  round: string           // ex: "Grupo A"
  standings: StandingEntry[]
  homeTeamCode: string    // time da casa do jogo exibido — para destaque
  awayTeamCode: string    // time visitante do jogo exibido — para destaque
}
```

**Estados:**
- `standings.length === 0` — estado vazio: exibir linha "— sem dados anteriores —" em `color-muted`
- `standings.length > 0` — tabela completa

**Layout visual (referência ASCII):**

```
┌──────────────────────────────────────────────────────┐
│  ► CLASSIFICAÇÃO — GRUPO A                            │
├────┬─────────────┬───┬───┬───┬───┬───┬────┬────┬────┤
│  # │ TIME        │ P │ J │ V │ E │ D │ GP │ GC │ SG │
├────┼─────────────┼───┼───┼───┼───┼───┼────┼────┼────┤
│  1 │ 🇧🇷 BRA      │ 6 │ 2 │ 2 │ 0 │ 0 │  5 │  1 │ +4 │  ← linha destacada (home ou away)
│  2 │ 🇦🇷 ARG      │ 3 │ 2 │ 1 │ 0 │ 1 │  2 │  2 │  0 │  ← linha destacada (home ou away)
│  3 │ 🇲🇽 MEX      │ 1 │ 2 │ 0 │ 1 │ 1 │  1 │  3 │ -2 │
│  4 │ 🇵🇱 POL      │ 0 │ 2 │ 0 │ 0 │ 2 │  1 │  4 │ -3 │
└────┴─────────────┴───┴───┴───┴───┴───┴────┴────┴────┘
```

**Implementação:**

- **Container:** `border: '1px solid var(--color-border)'`, `backgroundColor: 'var(--color-surface)'`, `overflow: 'hidden'`, sem `border-radius`, `fontFamily: "'JetBrains Mono', 'Courier New', monospace"`

- **Header da seção:**
  ```
  backgroundColor: 'var(--color-primary)'
  color: 'var(--color-bg)'
  fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em'
  padding: '0.5rem 0.75rem'
  borderBottom: '1px solid var(--color-border)'
  conteúdo: `► CLASSIFICAÇÃO — ${round}`
  ```

- **Cabeçalho da tabela (linha de labels):**
  ```
  backgroundColor: 'rgba(26, 74, 46, 0.3)'    // color-border com opacidade
  borderBottom: '1px solid var(--color-border)'
  fontSize: '9px', color: 'var(--color-muted)', textTransform: 'uppercase'
  padding: '0.3rem 0.5rem'
  colunas via CSS grid (ver abaixo)
  ```

- **Grid de colunas:** `grid-template-columns` com proporções que caibam em ~290px (largura mínima do drawer):
  ```
  '#': 20px
  'TIME': 1fr (espaço livre para flag + code)
  'P': 22px
  'J': 22px
  'V': 20px
  'E': 20px
  'D': 20px
  'GP': 24px
  'GC': 24px
  'SG': 26px
  ```
  Usando: `gridTemplateColumns: '20px 1fr 22px 22px 20px 20px 20px 24px 24px 26px'`

- **Cada linha de time:**
  - `padding: '0.35rem 0.5rem'`
  - `borderBottom: '1px solid var(--color-border)'` (exceto última)
  - `fontSize: '11px'`
  - Zebra: índice par → `backgroundColor: 'transparent'`, ímpar → `backgroundColor: 'rgba(26, 74, 46, 0.08)'`
  - Se `entry.teamCode === homeTeamCode || entry.teamCode === awayTeamCode`:
    - Linha destacada: `backgroundColor: 'rgba(0, 156, 59, 0.15)'` (color-primary com opacidade baixa)
    - `fontWeight: 'bold'`
    - Posição: `color: 'var(--color-accent)'` bold

- **Coluna TIME:** `display: 'flex', alignItems: 'center', gap: '0.25rem'`
  - `getTeamFlag(entry.teamCode)` em `fontSize: '14px'`
  - `entry.teamCode` em uppercase, `fontSize: '11px'`

- **Coluna SG (saldo):**
  - Valor positivo: `'+' + goalDifference` em `color: 'var(--color-win)'`
  - Valor negativo: `String(goalDifference)` em `color: 'var(--color-error)'`
  - Zero: `'0'` em `color: 'var(--color-muted)'`

- **Coluna P (pontos):**
  - `fontWeight: 'bold'`, `color: 'var(--color-text)'`

- **Alinhamentos:** coluna `#` e `TIME` alinhadas à esquerda; todas as colunas numéricas (`P`, `J`, `V`, `E`, `D`, `GP`, `GC`, `SG`) alinhadas ao centro via `textAlign: 'center'`

- **Estado vazio (standings.length === 0):**
  ```
  padding: '0.75rem'
  fontSize: '11px'
  color: 'var(--color-muted)'
  textAlign: 'center'
  conteúdo: "— sem jogos encerrados anteriores —"
  ```

---

## Frontend — Extensão do Drawer

### GameAnaliseDrawer.tsx

**Arquivo:** `components/bolao/GameAnaliseDrawer.tsx`

**Alterações:**

1. **Estender `AnaliseData`:**
   ```typescript
   import type { StandingEntry } from '@/lib/analytics/group-standings'

   interface AnaliseData {
     game: { ...existente... }
     participants: ParticipantEntry[]
     homeStats: TeamStats
     awayStats: TeamStats
     homeRecentGames: RecentGame[]
     awayRecentGames: RecentGame[]
     groupStandings: StandingEntry[] | null  // ← novo campo
   }
   ```

2. **Renderização condicional após `RecentGamesSection`:**
   ```tsx
   {data.groupStandings !== null && data.game.round && (
     <div style={{ marginBottom: '1.5rem' }}>
       <GroupStandingsCard
         round={data.game.round}
         standings={data.groupStandings}
         homeTeamCode={data.game.home_team_code}
         awayTeamCode={data.game.away_team_code}
       />
     </div>
   )}
   ```

3. **Import necessário:**
   ```typescript
   import GroupStandingsCard from '@/components/bolao/GroupStandingsCard'
   import type { StandingEntry } from '@/lib/analytics/group-standings'
   ```

**Ordem dos blocos no drawer (com a nova seção):**
1. `GameCard`
2. `MatchupStatsCard` — "ESTATÍSTICAS NA COPA 2026"
3. `RecentGamesSection` — "ÚLTIMOS 3 JOGOS NA COPA 2026"
4. `GroupStandingsCard` — "CLASSIFICAÇÃO — GRUPO X" *(somente para jogos de grupo)*

---

## Regras de Negócio

### R1 — Identificação da fase de grupos
`game.round?.startsWith('Grupo')` determina se a seção é exibida. Se `round` é `null`, `undefined`, ou não começa com `"Grupo"`, a seção não aparece no drawer e `groupStandings` retorna `null` no JSON.

### R2 — Filtro temporal da classificação
Somente jogos com `status === 'finished'` E `match_date < match_date_do_jogo_exibido` contam para a classificação. O próprio jogo exibido e jogos com `match_date >= match_date_do_jogo_exibido` são **excluídos**. Comparação usa timestamps em ms via `new Date().getTime()`.

### R3 — Times do grupo
Os times membros do grupo são derivados de **todos** os jogos onde `round === game.round` (sem filtro de data ou status). Isso garante que, mesmo quando nenhum jogo foi encerrado ainda, todos os 4 times aparecem na tabela com 0 pontos.

### R4 — Cálculo de pontos
```
Vitória: +3 pontos
Empate:  +1 ponto
Derrota:  0 pontos
```

### R5 — Critérios de desempate
Em ordem de prioridade:
1. Pontos (DESC)
2. Saldo de gols = goalsFor - goalsAgainst (DESC)
3. Gols pró / gols marcados — `goalsFor` (DESC)
4. Nome do time — `teamName.localeCompare('pt-BR')` (ASC)

**Nota:** Os critérios oficiais da FIFA 2026 para desempate interno no grupo incluem resultado direto entre os times empatados. Esta spec adota critérios simplificados (sem resultado direto) porque a tabela serve de **contexto informativo**, não de resultado oficial. A flag `color-muted` deve ser usada no título para indicar que é aproximada se necessário, mas o PM decidiu não exibir disclaimer (manter simples).

### R6 — Destaque visual dos times do confronto
As linhas correspondentes a `homeTeamCode` e `awayTeamCode` são destacadas com `backgroundColor: 'rgba(0, 156, 59, 0.15)'` e `fontWeight: 'bold'`. A posição é exibida em `color-accent`. Esse comportamento não muda mesmo que um dos times lidere ou ocupe a última posição.

### R7 — Copa 2026: 4 times por grupo
Cada grupo tem exatamente 4 times. Se por qualquer inconsistência do banco mais ou menos times aparecerem, o componente exibe todos (sem limitar a 4). Não há tratamento especial para esse caso — o layout suporta N linhas.

---

## Integração no Fluxo de Dados Existente

O fluxo permanece inalterado:

```
PalpitesLiveCard (clique em GameItem)
  → GameAnaliseDrawer (selectedGameId)
    → fetch('/api/analise-data?gameId=...&groupId=...')
      → route.ts: query game + query allGroupGames (novo, condicional) + ...
        → calculateGroupStandings() (novo, lib/analytics/group-standings.ts)
      → retorna JSON com groupStandings
    → renderiza GroupStandingsCard (novo, condicional)
```

A mesma rota também serve a página `/jogos/[gameId]/analise`. Essa página **não** exibe `GroupStandingsCard` (ela não importa nem renderiza o componente). A extensão do JSON não quebra a página existente — TypeScript ignorará o campo extra se a interface local não o tipar.

---

## Proteção de Rotas

Nenhuma rota nova. A extensão usa o mesmo endpoint `/api/analise-data` já protegido por autenticação JWT + membership check.

---

## Integração Supabase Realtime

Não aplicável. A classificação é calculada a partir do estado já persistido em `games` no momento do fetch. Não há subscription em tempo real para standings.

---

## Critérios de Aceite

- [ ] Para jogos cujo `round` começa com "Grupo" (ex: "Grupo A"), o drawer exibe a seção `GroupStandingsCard` abaixo de `RecentGamesSection`
- [ ] Para jogos de mata-mata (`round` = "Oitavas", "Quartas", "Semi", "Final"), a seção não aparece
- [ ] Se `round` é `null` ou `undefined`, a seção não aparece
- [ ] A tabela exibe exatamente os 4 times do grupo (derivados de todos os jogos do mesmo `round`)
- [ ] Somente jogos com `status === 'finished'` E `match_date < match_date_do_jogo_exibido` contam para a classificação
- [ ] O próprio jogo exibido não conta para a classificação (mesmo que esteja `finished`)
- [ ] Jogos posteriores ao exibido não contam para a classificação
- [ ] Colunas presentes: `#`, `TIME` (flag + code), `P`, `J`, `V`, `E`, `D`, `GP`, `GC`, `SG`
- [ ] `SG` exibe `+N` em `color-win` para positivo, `-N` em `color-error` para negativo, `0` em `color-muted`
- [ ] Times da partida exibida (`home_team_code`, `away_team_code`) têm linha destacada com `backgroundColor` diferenciado e `fontWeight: 'bold'`
- [ ] A posição dos times destacados usa `color-accent`
- [ ] Ordenação: pontos DESC → saldo DESC → gols pró DESC → nome ASC
- [ ] Estado vazio (nenhum jogo encerrado antes do confronto): todos os 4 times aparecem com 0 em todas as colunas (não "sem dados")
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, sem `border-radius`, sem `box-shadow`, bordas `1px solid var(--color-border)`, header `color-primary`
- [ ] Funciona em mobile com bottom sheet de ~290px de largura útil sem overflow horizontal
- [ ] `npm run lint` e `npm run build` passam sem erros novos
- [ ] A página `/jogos/[gameId]/analise` não é afetada (sem `GroupStandingsCard` nela)
