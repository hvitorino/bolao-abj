# Spec: Navegação de Jogos

**Slug:** game-navigation
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Permitir que participantes autenticados visualizem todos os jogos da Copa do Mundo FIFA 2026 organizados por dia. O usuário acessa `/jogos`, vê os jogos do dia atual, e pode navegar para dias anteriores ou posteriores usando botões `◀` e `▶`. Cada jogo exibe times, horário, rodada, status (Pendente/Ao Vivo/Encerrado) e placar quando disponível.

---

## Histórias de Usuário

- Como participante, quero ver os jogos do dia ao acessar `/jogos` para saber quais partidas acontecem hoje
- Como participante, quero navegar para o dia seguinte ou anterior para consultar jogos de outros dias
- Como participante, quero ver o status de cada jogo (Pendente, Ao Vivo, Encerrado) para saber se o jogo já começou
- Como participante, quero ver o placar dos jogos em andamento ou encerrados para acompanhar os resultados
- Como participante, quero ver destaque visual em jogos ao vivo para identificá-los rapidamente
- Como participante, quero saber quantos palpites já registrei no dia para controlar minha participação

---

## Modelo de Dados

### Tabela: `games`

```sql
games (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team    text NOT NULL,         -- ex: "Brasil"
  away_team    text NOT NULL,         -- ex: "Argentina"
  home_team_code char(3) NOT NULL,    -- ex: "BRA"
  away_team_code char(3) NOT NULL,    -- ex: "ARG"
  match_date   timestamptz NOT NULL,  -- data e hora UTC do jogo
  home_score   int,                   -- NULL até o jogo começar/ser atualizado
  away_score   int,                   -- NULL até o jogo começar/ser atualizado
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'live', 'finished')),
  round        text NOT NULL,         -- ex: 'Grupo A', 'Oitavas', 'Final'
  venue        text,                  -- ex: "MetLife Stadium, Nova Jersey"
  created_at   timestamptz NOT NULL DEFAULT now()
)
```

### RLS Policies para `games`

```sql
-- Leitura pública para usuários autenticados
CREATE POLICY "Autenticados podem ler jogos"
  ON games FOR SELECT
  TO authenticated
  USING (true);

-- Apenas service_role pode inserir/atualizar/deletar
-- (sem policy de escrita para authenticated — apenas admins via service_role)
```

### Migrations necessárias

1. `db/migrations/20260613_create_games.sql` — cria tabela `games` com RLS
2. `db/seeds/seed_games.rb` — popula dataset de jogos da Copa 2026 (script Ruby para rodar manualmente)

---

## API — Endpoints Next.js (Route Handlers)

### GET /api/games?date=YYYY-MM-DD

**Autenticação:** requerida (verifica sessão Supabase)
**Query params:**
- `date` (opcional): data no formato `YYYY-MM-DD`. Se omitido, usa a data atual no fuso UTC-3 (horário de Brasília)

**Resposta de sucesso (200):**
```json
[
  {
    "id": "uuid",
    "home_team": "Brasil",
    "away_team": "Argentina",
    "home_team_code": "BRA",
    "away_team_code": "ARG",
    "match_date": "2026-06-14T18:00:00Z",
    "home_score": null,
    "away_score": null,
    "status": "pending",
    "round": "Grupo C",
    "venue": "MetLife Stadium"
  }
]
```

**Lógica de filtro:** Buscar jogos onde `match_date::date = $date` (comparando apenas a parte de data em UTC).

**Erros possíveis:**
- `401 { "error": "Não autenticado" }` — sem sessão válida
- `400 { "error": "Formato de data inválido" }` — date não é YYYY-MM-DD válido
- `500 { "error": "Erro interno" }` — falha no Supabase

**Arquivo:** `app/api/games/route.ts`

---

## Frontend — Componentes React

### GameCard

**Arquivo:** `components/games/GameCard.tsx`
**Tipo:** Client Component (não precisa de interatividade, mas usa dados dinâmicos)
**Props:**
```typescript
interface GameCardProps {
  game: Game
}
```

**Layout (inspirado no "Placar de Jogo" de DESIGN.md):**
```
┌────────────────────────────────────────────────────┐
│  GRP A · 11 JUN 2026 · 19:00                       │
├────────────────────────────────────────────────────┤
│       MEX          -  ×  -         CAN             │
│      MÉXICO                       CANADÁ           │
├────────────────────────────────────────────────────┤
│  PENDENTE  ·  20:00 BRT                            │
└────────────────────────────────────────────────────┘
```

**Estados do status:**
- `pending`: badge cinza "PENDENTE", mostra horário em `color-muted`
- `live`: badge `██ AO VIVO ██` em `color-live` com classe `blink`, borda do card em `color-live`
- `finished`: badge "ENCERRADO" em `color-muted`, mostra placar em `color-accent`

**Design:**
- Container: `background: color-surface`, `border: 1px solid color-border`
- Times ao vivo: border do card muda para `color-live`
- Placar central: `color-accent`, fonte grande (2xl)
- Quando `status === 'pending'` e sem placar: exibe ` - × - ` em `color-muted`
- Quando há placar: exibe `home_score × away_score` em `color-accent`
- Código do time (3 letras): uppercase, bold
- Nome do time: uppercase, `color-muted`, `font-size: 12px`

### GameList

**Arquivo:** `components/games/GameList.tsx`
**Tipo:** Server Component (recebe dados via props)
**Props:**
```typescript
interface GameListProps {
  games: Game[]
  date: string // YYYY-MM-DD para contexto de exibição
}
```

**Estados:**
- `empty`: Mensagem "NENHUM JOGO NESTE DIA" centralizada em `color-muted`
- `populated`: lista de GameCards, espaçamento uniforme

**Layout:**
- Coluna única no mobile
- 2 colunas em `md:` (2 jogos lado a lado)
- Separador visual entre grupos de jogos do mesmo round

### DayNavigator

**Arquivo:** `components/games/DayNavigator.tsx`
**Tipo:** Client Component (navegação interativa com router.push)
**Props:**
```typescript
interface DayNavigatorProps {
  currentDate: string   // YYYY-MM-DD
  gameCount: number     // total de jogos no dia atual
  guessCount: number    // palpites do usuário no dia atual
}
```

**Layout:**
```
┌────────────────────────────────────────────────────┐
│  ◀   SÁBADO, 13 JUN 2026   ▶                       │
│      6 JOGOS · 2 PALPITES                          │
└────────────────────────────────────────────────────┘
```

**Comportamento:**
- Botão `◀`: navega para `?date=<dia-anterior>` via `router.push`
- Botão `▶`: navega para `?date=<dia-seguinte>` via `router.push`
- Data atual: uppercase, centralizada, `color-text`
- "X JOGOS": `color-muted`
- "Y PALPITES": `color-primary` se Y > 0, `color-muted` se Y === 0
- Dia atual (today): destaque com `color-accent`
- Os botões usam o componente `Button` existente com variant `secondary`

---

## Página `/jogos`

**Arquivo:** `app/(dashboard)/jogos/page.tsx`
**Tipo:** Server Component assíncrono
**Search params:** `?date=YYYY-MM-DD` (opcional)

**Lógica:**
1. Ler `searchParams.date`; se inválido ou ausente, usar data atual (UTC-3)
2. Buscar jogos via `createClient()` do Supabase server diretamente (sem fetch HTTP interno)
3. Buscar contagem de palpites do usuário para o dia via `supabase.from('predictions').select('id', { count: 'exact' })` filtrado por `user_id` e `game_id in [ids dos jogos do dia]`
4. Renderizar `DayNavigator` + `GameList`
5. Tratar erros: se Supabase falhar, mostrar mensagem de erro estilizada

**Estrutura visual:**
```
JOGOS — COPA DO MUNDO 2026
─────────────────────────────
[DayNavigator]
─────────────────────────────
[GameList]
```

---

## Tipos TypeScript

**Arquivo:** `lib/types/game.ts`

```typescript
export type GameStatus = 'pending' | 'live' | 'finished'

export interface Game {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  match_date: string        // ISO 8601 string
  home_score: number | null
  away_score: number | null
  status: GameStatus
  round: string
  venue: string | null
  created_at: string
}
```

---

## Seed Data — Dataset de Jogos da Copa 2026

Script Ruby (`db/seeds/seed_games.rb`) para inserir via Supabase REST API usando a service_role key. Enquanto este repositório não trouxer uma fonte oficial verificável e auditável para a Copa 2026, o seed deve usar um dataset placeholder/fictício explicitamente identificado como tal:

**Exemplo de dataset placeholder (não oficial):**

| Data | Mandante | Visitante | Grupo | Sede |
|------|----------|-----------|-------|------|
| 2026-06-11 | México | Japão | A | Azteca |
| 2026-06-12 | Canadá | Nigéria | B | BC Place |
| 2026-06-13 | EUA | Coreia do Sul | C | SoFi Stadium |
| 2026-06-15 | Brasil | Sérvia | F | Rose Bowl |
| ... | ... | ... | ... | ... |

O seed deve cobrir pelo menos 15 jogos distribuídos em pelo menos 5 dias diferentes, incluindo México, EUA, Canadá (sedes), além de Brasil, Argentina, França, Inglaterra, Espanha, Alemanha e Portugal. Os confrontos precisam ser internamente coerentes entre si e o arquivo deve afirmar de forma inequívoca quando os dados forem fictícios/placeholder.

**Detalhes do script:**
- Lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de variáveis de ambiente
- Usa `net/http` + JSON para fazer POST para `/rest/v1/games`
- Imprime confirmação de cada insert
- Idempotente: verificar se jogo já existe antes de inserir (ou usar `upsert`)
- Não pode alegar "dados oficiais", "jogos reais" ou equivalente sem citar fonte verificável no próprio repositório

---

## Regras de Negócio

1. **Data padrão**: Ao acessar `/jogos` sem `?date=`, mostrar jogos do dia atual no horário de Brasília (UTC-3). Usar `new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })` e converter para YYYY-MM-DD.

2. **Placar**: Exibir placar somente quando `home_score !== null && away_score !== null`. Caso contrário, exibir ` - × - ` para pending ou `0 × 0` para live sem placar ainda.

3. **Jogo ao vivo**: Card com `status === 'live'` tem destaque visual: borda `color-live`, badge piscante. NÃO usar Supabase Realtime nesta feature (apenas fetch estático; Realtime virá na feature `live-scores`).

4. **Contagem de palpites**: Buscar da tabela `predictions` filtrando por `user_id` do usuário logado e `game_id IN (ids dos jogos do dia)`. Mostrar "X PALPITES REGISTRADOS" no DayNavigator.

5. **Navegação de dias**: Sem limite nas setas — o usuário pode navegar para qualquer dia (antes ou depois da Copa). Se não houver jogos, mostrar estado vazio.

6. **Formato de data no header**: Exibir no formato `SÁBADO, 13 JUN 2026` em português, uppercase.

---

## Proteção de Rotas

- `/jogos` já está protegida pelo `app/(dashboard)/layout.tsx` que verifica `supabase.auth.getUser()`
- O endpoint `/api/games` deve verificar a sessão independentemente (não confiar apenas no middleware)
- Se não autenticado no `/api/games`: retornar `401`

---

## Integração Supabase Realtime

**Não aplicável nesta feature.** A feature `game-navigation` usa apenas fetch estático. Supabase Realtime será implementado na feature `live-scores`.

---

## Critérios de Aceite

- [ ] Ao acessar `/jogos`, usuário vê os jogos do dia atual (ou mensagem de "nenhum jogo" se não houver)
- [ ] Botões `◀` e `▶` navegam corretamente para dia anterior e seguinte via URL `?date=`
- [ ] Cada GameCard exibe: times (código 3 letras + nome completo), horário, rodada, status
- [ ] Jogo `pending`: badge "PENDENTE" em `color-muted`, sem placar numérico
- [ ] Jogo `live`: badge `██ AO VIVO ██` piscando em `color-live`, borda do card em `color-live`
- [ ] Jogo `finished`: badge "ENCERRADO" em `color-muted`, placar em `color-accent`
- [ ] DayNavigator mostra data formatada em português + contagem de jogos + contagem de palpites
- [ ] `GET /api/games?date=YYYY-MM-DD` retorna array JSON dos jogos do dia
- [ ] `/api/games` retorna 401 para requests não autenticados
- [ ] Migration SQL da tabela `games` criada em `db/migrations/20260613_create_games.sql`
- [ ] Seed script criado em `db/seeds/seed_games.rb` com ao menos 15 jogos em 5+ dias
- [ ] Tipagem TypeScript completa (`Game`, `GameStatus`) em `lib/types/game.ts`
- [ ] Design segue DESIGN.md: paleta de cores, tipografia monospace JetBrains Mono, estilo Elifoot
- [ ] Interface em português brasileiro
- [ ] Funciona em mobile (coluna única, layout responsivo)
- [ ] Sem credenciais hardcoded
