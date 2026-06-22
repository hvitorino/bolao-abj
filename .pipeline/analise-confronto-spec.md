# Especificação Técnica — Análise de Confronto

**Data:** 2026-06-22  
**Feature Slug:** `analise-confronto`  
**Objetivo:** Fornecer análise comparativa dos dois times que se enfrentam em um jogo específico, com estatísticas agregadas e histórico recente, para auxiliar o usuário a tomar melhores decisões nos palpites.

---

## 1. Visão Geral

Uma página dedicada acessível a partir do card de palpite exibe:
- **Stats agregadas lado a lado** dos dois times (vitórias, empates, derrotas, gols marcados/sofridos, saldo, clean sheets, jogos marcando gol)
- **Últimos 3 jogos de cada time** com placar, data, adversário e resultado

Todos os dados vêm da Copa 2026, consultados em tempo real via Supabase (sem snapshots pré-calculados).

---

## 2. Rota e Integração

### Rota
```
GET /jogos/[gameId]/analise
```

### Entrada
- **gameId** (uuid, param de rota): ID do jogo do qual consultar confronto

### Autenticação
- Usuário logado (protegida pela middleware de dashboard)
- Usuário deve ser membro do grupo ativo (mesmo controle da página `/jogos`)

---

## 3. Componentes

### 3.1 Página: `analise/page.tsx`
- Server component (SSR)
- Resolve `gameId` da rota
- Busca dados do jogo (home_team, away_team, match_date, status, etc.)
- Busca todos os jogos de ambos os times na Copa 2026
- Calcula stats agregadas
- Renderiza layout com header, card comparativo e seção de últimos 3 jogos

### 3.2 Card Comparativo: `MatchupStatsCard.tsx`
- Client component
- Props: `homeTeam`, `awayTeam`, `homeStats`, `awayStats`
- Exibe dois painéis lado a lado com:
  - Nome do time (maiúsculas)
  - V, E, D (Vitórias, Empates, Derrotas)
  - Gols Marcados
  - Gols Sofridos
  - Saldo de Gols
  - Clean Sheets (jogos sem sofrer gol)
  - Jogos em que Marcou Gol
- Cores: background `color-surface`, bordas `color-border`, stats em `color-text`

### 3.3 Seção de Últimos Jogos: `RecentGamesSection.tsx`
- Client component
- Props: `homeTeam`, `awayTeam`, `homeRecentGames`, `awayRecentGames`
- Duas colunas lado a lado
- Cada coluna exibe 3 cartões de jogo (linhas dentro de uma tabela ou cards)
- Cada cartão mostra: data, placar, adversário (3 letras), resultado (V/E/D)
- Cores de resultado: V em `color-win`, E em `color-muted`, D em `color-error`

### 3.4 Botão de Voltar
- Link para `/jogos?date=[matchDate]` ou ref anterior (history.back())
- Label: "← Voltar ao Palpite"

---

## 4. Queries Supabase

### 4.1 Buscar Jogo Específico
```sql
SELECT id, home_team, away_team, home_team_code, away_team_code, 
       match_date, match_day, status, round, home_score, away_score
FROM games
WHERE id = $1
```
- Retorna 1 linha

### 4.2 Buscar Todos os Jogos dos Dois Times
```sql
SELECT id, home_team, away_team, home_team_code, away_team_code,
       home_score, away_score, match_date, match_day, status
FROM games
WHERE (home_team_code = $1 OR away_team_code = $1)
   OR (home_team_code = $2 OR away_team_code = $2)
ORDER BY match_date ASC
```
- `$1` = home_team_code do jogo, `$2` = away_team_code do jogo
- Retorna todos os jogos de ambos os times (pode incluir confrontos entre eles)

---

## 5. Cálculo de Stats Agregadas

Para cada time, calcular sobre seus jogos na Copa 2026:

### Inputs
- `games`: array de todos os jogos do time
- `homeTeam`: code (ex: "BRA")
- `awayTeam`: code (ex: "ARG")

### Processo
Iterar sobre `games`:
1. Se `home_team_code === homeTeam`: time é mandante
   - Score do time: `home_score`
   - Score adversário: `away_score`
2. Se `away_team_code === homeTeam`: time é visitante
   - Score do time: `away_score`
   - Score adversário: `home_score`

### Métricas Calculadas
Para cada jogo do time:

| Métrica | Lógica |
|---------|--------|
| **Vitórias (V)** | score_time > score_adversário |
| **Empates (E)** | score_time === score_adversário |
| **Derrotas (D)** | score_time < score_adversário |
| **Gols Marcados** | SUM de score_time sobre todos os jogos |
| **Gols Sofridos** | SUM de score_adversário sobre todos os jogos |
| **Saldo de Gols** | Gols Marcados - Gols Sofridos |
| **Clean Sheets** | COUNT de jogos onde score_adversário === 0 |
| **Jogos Marcando Gol** | COUNT de jogos onde score_time > 0 |

### Implementação
```typescript
function calculateTeamStats(
  games: Game[],
  teamCode: string
): TeamStats {
  let wins = 0, draws = 0, losses = 0
  let goalsFor = 0, goalsAgainst = 0
  let cleanSheets = 0, gamesScored = 0

  for (const game of games) {
    const isHome = game.home_team_code === teamCode
    const isAway = game.away_team_code === teamCode
    
    if (!isHome && !isAway) continue

    const myScore = isHome ? game.home_score : game.away_score
    const oppScore = isHome ? game.away_score : game.home_score

    if (myScore > oppScore) wins++
    else if (myScore === oppScore) draws++
    else losses++

    goalsFor += myScore
    goalsAgainst += oppScore
    if (oppScore === 0) cleanSheets++
    if (myScore > 0) gamesScored++
  }

  return {
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets,
    gamesScored,
  }
}
```

---

## 6. Últimos 3 Jogos

Para cada time, ordenar seus jogos por `match_date DESC` e pegar os primeiros 3.

### Dados Exibidos por Jogo
- `match_date`: data formatada (DD MMM)
- `placar`: `${myScore}×${oppScore}`
- `adversário`: 3 letras (away_team_code se time for mandante, home_team_code se visitante)
- `resultado`: "V" | "E" | "D" baseado na comparação de scores

---

## 7. Estrutura de Dados

### Type: `TeamStats`
```typescript
type TeamStats = {
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  cleanSheets: number
  gamesScored: number
}
```

### Type: `RecentGame`
```typescript
type RecentGame = {
  date: string         // formatado: "14 JUN"
  placar: string       // "3×1"
  adversario: string   // "ARG"
  resultado: "V" | "E" | "D"
}
```

---

## 8. Tratamento de Erros

### Jogo não encontrado
- Status 404: renderizar "✗ JOGO NÃO ENCONTRADO"

### Usuário não autorizado
- Status 401: redirect para `/login`
- Status 403: renderizar "✗ VOCÊ NÃO PARTICIPA DESTE GRUPO"

### Dados incompletos
- Se status do jogo for "pending" e scores forem null: exibir "Jogo ainda não iniciado" em lugar dos scores
- Se houver jogos sem scores, exibir "-" no placar

---

## 9. Performance e Queries

- **Uma query por rota** para buscar o jogo específico
- **Uma query** para buscar todos os jogos de ambos os times (combinada com OR)
- Cálculos de stats acontecem em memória (JavaScript), não em SQL
- Sem paginação (Copa 2026 terá ~100-150 jogos totais)
- Cache via Next.js: `revalidate: 60` (atualiza a cada 1 minuto)

---

## 10. Styling

Seguir rigorosamente **DESIGN.md**:
- Fonte: `JetBrains Mono` (maiúsculas em headers)
- Cores: `color-surface`, `color-border`, `color-text`, `color-muted`
- Bordas: `1px solid var(--color-border)`
- Sem sombras: `box-shadow: none`
- Layout: tabela densa, sem whitespace excessivo

---

## 11. Integração com Card de Palpite

No componente `GameCard.tsx` (ou onde exibir o palpite):
- Adicionar botão/link "📊 Ver Análise"
- Link para `/jogos/[gameId]/analise`
- Visível para todos os jogos (pending, live, finished)

---

## 12. Critérios de Sucesso

✓ Página `/jogos/[gameId]/analise` renderiza com dados corretos  
✓ Stats agregadas calculadas corretamente para ambos os times  
✓ Últimos 3 jogos exibidos em ordem recente (desc by date)  
✓ Resultados com cores apropriadas (V verde, E muted, D vermelho)  
✓ Link "Voltar ao Palpite" navega corretamente  
✓ Autenticação e autorização validadas  
✓ Sem pré-cálculos (queries em tempo real)  
✓ Performance aceitável (<1s de carregamento)  
✓ Responsivo em mobile (coluna única, mobile-first)
