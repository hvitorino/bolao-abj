# Spec: Ranking em Tempo Real

**Slug:** ranking
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Exibir o ranking geral do bolão com a classificação de todos os participantes ordenados por total de pontos acumulados, com destaque visual para o líder e para o usuário atual, atualizado automaticamente em tempo real via Supabase Realtime quando a tabela `scores` é modificada.

---

## Histórias de Usuário

- Como participante, quero ver o ranking atualizado do bolão para saber minha posição em relação aos outros.
- Como participante, quero que minha posição fique destacada visualmente para identificá-la de imediato.
- Como participante, quero ver o aproveitamento (%) de cada participante para entender quão bem cada um está pontuando.
- Como participante, quero que o ranking atualize sem precisar recarregar a página quando um jogo é encerrado e a pontuação é calculada.

---

## Modelo de Dados

### View SQL: `ranking_view`

Criar a seguinte view no Supabase para agregar pontos por usuário:

```sql
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  s.user_id,
  p.name AS participant_name,
  p.avatar_url,
  SUM(s.points)::int AS total_points,
  COUNT(s.id)::int AS games_predicted,
  RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
FROM scores s
JOIN profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.name, p.avatar_url
ORDER BY total_points DESC;
```

**RLS da view:** Views no PostgreSQL herdam as políticas RLS das tabelas subjacentes. Como a tabela `scores` tem RLS com `SELECT` apenas para o próprio usuário (`auth.uid() = user_id`), a view só retornaria dados do usuário autenticado. Para expor o ranking completo a todos os participantes autenticados, a view deve ser criada com `SECURITY DEFINER` ou, alternativamente, a query deve ser feita via endpoint Ruby com `service_role`.

**Decisão:** O endpoint Ruby `/api/ranking` usará `service_role` para contornar o RLS e retornar todos os participantes. A view pode ser usada internamente na query SQL do endpoint ou executada diretamente via RPC.

**Migration:** `db/migrations/20260613_create_ranking_view.sql`

```sql
-- View para agregação de pontos do ranking
CREATE OR REPLACE VIEW ranking_view AS
SELECT
  s.user_id,
  p.name AS participant_name,
  p.avatar_url,
  SUM(s.points)::int AS total_points,
  COUNT(s.id)::int AS games_predicted,
  RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
FROM scores s
JOIN profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.name, p.avatar_url
ORDER BY total_points DESC;

-- Habilitar Realtime para scores (se ainda não estiver)
-- Executar manualmente no SQL Editor caso não tenha sido feito na feature scoring:
-- ALTER TABLE scores REPLICA IDENTITY FULL;
-- ALTER PUBLICATION supabase_realtime ADD TABLE scores;
```

---

## Backend — Endpoints Ruby/Sinatra

### GET /api/ranking

**Autenticação:** requerida (JWT Bearer token via Supabase Auth)
**Método:** GET
**Arquivo:** `api/ranking.rb`

**Lógica:**
1. Verificar autenticação via `GET /auth/v1/user` com Bearer token
2. Retornar 401 se não autenticado
3. Fazer query no Supabase com `service_role` para contornar RLS:
   ```sql
   SELECT
     s.user_id,
     p.name AS participant_name,
     SUM(s.points)::int AS total_points,
     COUNT(s.id)::int AS games_predicted,
     RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
   FROM scores s
   JOIN profiles p ON p.id = s.user_id
   GROUP BY s.user_id, p.name
   ORDER BY total_points DESC
   ```
4. Calcular `aproveitamento` no Ruby: `(total_points.to_f / max_possible * 100).round(0)` onde `max_possible = games_predicted * 9` (máximo teórico por jogo: 3+5+1+2+1-2 = 9 pts, simplificado para 9). Se `games_predicted == 0`, aproveitamento = 0.
5. Retornar array JSON ordenado por posição

**Nota sobre aproveitamento:** O aproveitamento é calculado como `total_points / (games_predicted * 9) * 100`. O valor 9 representa o máximo possível por jogo (vencedor=3, exato=5, goleada=1; ignora somente_vencedor, diff e perdedor pois são excludentes). Em caso de 0 palpites, retorna 0%.

**Implementação alternativa (mais simples):** Usar a Supabase REST API com `service_role` para executar a query via RPC ou via endpoint de tabela com `select` customizado. Como a view `ranking_view` usa funções de janela (`RANK`), ela não pode ser consultada diretamente via API REST do Supabase sem RPC. A abordagem correta é usar `GET /rest/v1/rpc/get_ranking` via função SQL, ou construir a query diretamente no Ruby via Supabase REST com parâmetros.

**Decisão final:** Criar uma função RPC Postgres `get_ranking()` e chamar via Supabase REST API com `service_role`. Assim não há SQL raw no Ruby.

**Migration adicional:**
```sql
CREATE OR REPLACE FUNCTION get_ranking()
RETURNS TABLE (
  user_id uuid,
  participant_name text,
  total_points int,
  games_predicted int,
  position int
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    s.user_id,
    p.name AS participant_name,
    SUM(s.points)::int AS total_points,
    COUNT(s.id)::int AS games_predicted,
    RANK() OVER (ORDER BY SUM(s.points) DESC)::int AS position
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  GROUP BY s.user_id, p.name
  ORDER BY total_points DESC;
$$;
```

**Resposta de sucesso (200):**
```json
[
  {
    "position": 1,
    "user_id": "uuid",
    "participant_name": "GOLEADOR_MASTER",
    "total_points": 47,
    "games_predicted": 8,
    "aproveitamento": 65
  },
  ...
]
```

**Erros possíveis:**
- 401: não autenticado (token ausente ou inválido)
- 500: erro ao consultar Supabase

**CORS:** `Access-Control-Allow-Origin: *`, métodos `GET, OPTIONS`

---

## Frontend — Componentes React

### Hook: `useRankingRealtime`

**Arquivo:** `lib/hooks/useRankingRealtime.ts`
**Diretiva:** `'use client'`

**Interface:**
```typescript
type RankingEntry = {
  position: number
  user_id: string
  participant_name: string
  total_points: number
  games_predicted: number
  aproveitamento: number
}

function useRankingRealtime(): {
  ranking: RankingEntry[]
  loading: boolean
  error: string | null
}
```

**Comportamento:**
1. Estado inicial: `ranking = []`, `loading = true`, `error = null`
2. No `useEffect` inicial: chama `fetchRanking()` — `GET /api/ranking` com JWT de `supabase.auth.getSession()`
3. Cria subscription Supabase Realtime para a tabela `scores`, evento `*` (INSERT, UPDATE, DELETE), canal `ranking-scores`
4. Ao receber qualquer evento de `scores`: chama `fetchRanking()` novamente para buscar ranking atualizado
5. Cleanup do `useEffect`: `supabase.removeChannel(channel)`
6. Retorna `{ ranking, loading, error }`

**Dependências do `useEffect`:** `[]` — criado uma única vez ao montar o componente

### Componente: `RankingRow`

**Arquivo:** `components/bolao/RankingRow.tsx`
**Diretiva:** nenhuma (Server Component se não usar estado, mas será usado dentro de Client Component — aceitar as duas abordagens)

**Props:**
```typescript
type RankingRowProps = {
  entry: RankingEntry
  isCurrentUser: boolean
  isLeader: boolean
}
```

**Visual:**
- Linha de tabela `<tr>` com colunas: posição | nome | pontos | aproveitamento
- `isLeader`: linha em `color-accent`, texto bold, nome com prefixo `► `
- `isCurrentUser && !isLeader`: linha em `color-primary`
- Demais linhas: `color-text` padrão
- Coluna posição: número direita-alinhado, largura fixa
- Coluna nome: texto uppercase, largura máxima com overflow ellipsis
- Coluna pontos: número centralizado em bold
- Coluna aproveitamento: `XX%` centralizado em `color-muted` (ou `color-win` se > 60%)

### Componente: `RankingTable`

**Arquivo:** `components/bolao/RankingTable.tsx`
**Diretiva:** `'use client'` (usa hook `useRankingRealtime`)

**Props:**
```typescript
type RankingTableProps = {
  currentUserId: string
}
```

**Comportamento:**
1. Chama `useRankingRealtime()` para obter `{ ranking, loading, error }`
2. Estado loading: exibe `"CARREGANDO RANKING..."` em `color-muted`
3. Estado error: exibe mensagem de erro em `color-error`
4. Estado vazio (ranking = []): exibe `"NENHUM PARTICIPANTE NO RANKING AINDA"` em `color-muted`
5. Estado populado: renderiza tabela estilo DESIGN.md

**Layout da tabela (estilo Elifoot):**
```
┌─────┬───────────────────────┬────────┬───────────────┐
│  #  │ PARTICIPANTE          │ PONTOS │ APROVEIT.      │
├─────┼───────────────────────┼────────┼───────────────┤
│  1  │ ► GOLEADOR_MASTER     │   47   │  65%          │
│  2  │   FUTEBOL_REI         │   39   │  61%          │
│  3  │   TORCEDOR_FIEL       │   35   │  55%          │
└─────┴───────────────────────┴────────┴───────────────┘
```

**Estilos:**
- Tabela com `width: 100%`, `border-collapse: collapse`
- Header: `background: var(--color-surface)`, `border-bottom: 2px solid var(--color-border)`, texto uppercase, `color-muted`
- Linhas: `border-bottom: 1px solid var(--color-border)`, padding `0.5rem`
- Primeira linha do `<tbody>` sem `border-top` especial — borda vem do `<thead>`
- Indicador de atualização: pequeno texto `"● AO VIVO"` no cabeçalho da tabela em `color-live` com classe `blink` (aparece após o primeiro carregamento)
- Título do cabeçalho: `"RANKING — BOLÃO DA COPA"`

### Página: `/ranking`

**Arquivo:** `app/(dashboard)/ranking/page.tsx`
**Tipo:** Server Component (busca `userId` do Supabase server-side, passa para `RankingTable`)

**Comportamento:**
1. `createClient()` server-side
2. `supabase.auth.getUser()` — redirect para `/login` se não autenticado
3. Renderiza `<RankingTable currentUserId={user.id} />`
4. Exibe título e subtítulo da página acima da tabela

**Layout:**
```
RANKING GERAL
─────────────────────────────────────────
Classificação ao vivo · atualiza em tempo real
[RankingTable]
```

### Atualização do Layout do Dashboard

**Arquivo:** `app/(dashboard)/layout.tsx`
**Modificação:** Adicionar links de navegação no header entre o título "BOLÃO DA COPA" e o email do usuário.

**Links:**
- `JOGOS` → `/jogos`
- `RANKING` → `/ranking`
- `PALPITES` → `/meus-palpites`

**Estilo dos links:**
- Fonte monospace, 12px, uppercase, `color-muted`
- Link ativo (baseado no pathname): `color-primary`, `border-bottom: 1px solid var(--color-primary)`
- Hover: `color-text`
- Separados por espaço (gap: 1.5rem)

**Nota:** O layout do dashboard é um Server Component. Para ativar o link com base no pathname, criar um componente `NavLinks.tsx` com `'use client'` que usa `usePathname()` do `next/navigation`.

**Arquivo adicional:** `app/(dashboard)/nav-links.tsx`

---

## Regras de Negócio

1. **Ordenação:** Participantes ordenados por `total_points DESC`. Em caso de empate, a ordem pode ser alfabética por nome (definido pelo banco via `ORDER BY total_points DESC, participant_name ASC`).

2. **Aproveitamento:** `Math.round(total_points / (games_predicted * 9) * 100)`. Se `games_predicted === 0`, retorna `0`. O denominador `9` é o máximo teórico de pontos por jogo (3 vencedor + 5 exato + 1 goleada = 9; os bônus `winner_score`, `diff` e `loser_score` são mutuamente excludentes com `exact`, portanto o máximo é conservador). Calculado no Ruby backend antes de retornar o JSON.

3. **Líder:** Participante na posição 1 (`position === 1`). Se dois ou mais tiverem o mesmo total, ambos podem ter `position === 1` (empate no RANK).

4. **Usuário atual:** Identificado por `user_id === currentUserId` passado como prop.

5. **Número de jogos:** `games_predicted` = quantidade de palpites que geraram score (jogos encerrados com pontuação calculada). Não inclui palpites de jogos pendentes ou ao vivo.

---

## Proteção de Rotas

- `/ranking` — requer autenticação (Supabase Auth)
- O layout `app/(dashboard)/layout.tsx` já protege todas as rotas do grupo — o redirect para `/login` já está implementado
- O endpoint `GET /api/ranking` valida o JWT Bearer token

---

## Integração Supabase Realtime

- **Tabela:** `scores`
- **Evento:** `*` (INSERT, UPDATE, DELETE) — qualquer mudança na tabela
- **Canal:** `ranking-scores`
- **Filtro:** nenhum (qualquer mudança em `scores` pode alterar o ranking de qualquer participante)
- **Ação ao receber evento:** Refetch completo de `GET /api/ranking` para obter o ranking atualizado
- **Configuração manual necessária** (se não feita na feature scoring):
  ```sql
  ALTER TABLE scores REPLICA IDENTITY FULL;
  ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  ```

---

## Critérios de Aceite

- [ ] Página `/ranking` acessível a todos os participantes autenticados; redireciona para `/login` se não autenticado
- [ ] Lista todos os participantes com palpites encerrados, ordenados por total de pontos (decrescente)
- [ ] Exibe posição, nome do participante, total de pontos e aproveitamento (%)
- [ ] Usuário atual destacado visualmente em `color-primary`
- [ ] Líder destacado com `►` e cor `color-accent`
- [ ] Atualiza automaticamente em tempo real quando `scores` muda via Supabase Realtime
- [ ] Link de navegação para `/ranking` no header do dashboard
- [ ] View SQL `ranking_view` criada no Supabase (migration)
- [ ] Função RPC `get_ranking()` criada para uso pelo endpoint Ruby
- [ ] Endpoint `GET /api/ranking` retorna array JSON com aproveitamento calculado
- [ ] Estado vazio elegante quando nenhum participante tem pontos ainda
- [ ] Design segue DESIGN.md: tabela densa, monospace, bordas simples, sem sombras
- [ ] Funciona em mobile (coluna única, sem overflow horizontal)
- [ ] Indicador visual `"● AO VIVO"` no header da tabela indicando atualização em tempo real
