# Spec: Página Pública por Data

**Slug:** public-date-view
**Data:** 2026-06-25
**Status:** spec

---

## Objetivo

Criar uma página pública (sem autenticação) em `/publico/[groupId]/[date]` que exibe todos os jogos de uma data específica de um grupo, com os palpites de todos os participantes para cada jogo e a pontuação acumulada de cada participante naquele dia, atualizando em tempo real. Adicionar também um botão "COPIAR LINK" na aba de Palpites (`/palpites`) para compartilhar a URL da data navegada.

---

## Histórias de Usuário

- Como espectador externo (sem conta), quero acessar um link público compartilhado e ver todos os palpites dos participantes do bolão para os jogos de uma data, para acompanhar a disputa sem precisar me cadastrar.
- Como participante autenticado, quero copiar o link da data atual na aba de Palpites com um clique, para compartilhar facilmente com quem não tem conta.
- Como espectador externo, quero ver a pontuação acumulada de cada participante no dia (soma dos jogos encerrados + parcial dos ao vivo), para saber quem está na frente naquele dia.
- Como espectador externo, quero que a página atualize automaticamente conforme os jogos são finalizados, sem precisar recarregar a página.

---

## Modelo de Dados

### Nenhuma tabela nova ou modificada

Esta feature é puramente de leitura. Usa as tabelas existentes:

- `games` — `id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, round, venue, match_date, match_day`
- `predictions` — `id, user_id, game_id, group_id, home_score, away_score`
- `scores` — `id, user_id, game_id, group_id, points, breakdown`
- `profiles` — `id, name`
- `group_members` — `group_id, user_id`

### Migrations necessárias

Nenhuma migration de schema. As políticas RLS de leitura para `anon` já existem nas tabelas `games` e `scores` (criadas em `supabase/migrations/20260624000010_public_read_games_scores.sql` pela feature `public-game-view`).

**Verificar:** se as tabelas `predictions` e `group_members` não têm política de leitura para `anon`, a busca no Server Component usa `createServiceClient()` (service_role), que bypassa RLS. Isso está correto — não criar política anon para `predictions` (dados sensíveis antes do início do jogo).

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. A página pública é um Server Component Next.js que busca os dados via `createServiceClient()` (service_role), igual à página pública de jogo existente.

---

## Frontend — Componentes React

### Estrutura de arquivos a criar

```
app/publico/[groupId]/[date]/page.tsx          — Server Component da página pública
app/publico/[groupId]/[date]/public-date-client.tsx  — Client Component para Realtime + interações
components/bolao/PublicDateDaySummary.tsx      — Cabeçalho da data com resumo de jogos do dia
components/bolao/PublicDateGameSection.tsx     — Seção de um jogo: mini placar + tabela de palpites
components/bolao/PublicDateRanking.tsx         — Ranking do dia: PARTICIPANTE | PTS DIA | PTS LIVE
```

**Arquivo modificado:**
```
app/(dashboard)/palpites/palpites-live-section.tsx  — adicionar botão "COPIAR LINK DO DIA"
```

---

### `app/publico/[groupId]/[date]/page.tsx`

**Tipo:** Server Component assíncrono
**Autenticação:** nenhuma — rota pública fora de `(dashboard)` e `(auth)`
**Revalidação:** `export const revalidate = 0`

**Props:**
```typescript
interface PublicDatePageProps {
  params: Promise<{ groupId: string; date: string }>
}
```

**Comportamento do Server Component:**

1. Resolver `groupId` e `date` dos params.
2. Validar `date` com a função `isValidDateString` de `@/lib/date`. Se inválida, renderizar erro inline (não `notFound()`).
3. Se `groupId` ausente ou vazio, renderizar erro inline `✗ PARÂMETRO DE GRUPO AUSENTE` (mesmo padrão da página pública de jogo).
4. Criar `serviceClient = createServiceClient()` para todas as queries.
5. Buscar jogos da data: `.from('games').select('id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,round,venue,match_date').eq('match_day', date).order('match_date', { ascending: true })`.
   - Se nenhum jogo encontrado: renderizar estado vazio `NENHUM JOGO NESTA DATA`.
6. Buscar membros do grupo: `.from('group_members').select('user_id, profiles(id, name)').eq('group_id', groupId)`.
   - Se retornar vazio: renderizar erro `✗ GRUPO NÃO ENCONTRADO OU SEM PARTICIPANTES`.
   - Normalizar o join `profiles` igual ao padrão existente em `app/jogos/[gameId]/publico/page.tsx` (tratar array vs objeto via `Array.isArray(raw) ? raw[0] : raw`).
7. Para cada jogo, buscar palpites com visibilidade condicional por status (idêntico ao padrão de `public-game-view`):
   - Jogo `pending`: buscar apenas `user_id, game_id` (sem valores). Nenhum palpite de terceiros é exposto.
   - Jogo `live` ou `finished`: buscar `user_id, game_id, home_score, away_score`.
   - Filtrar sempre por `group_id = groupId` e `game_id IN (gameIds)`.
8. Buscar scores apenas para jogos `finished`: `.from('scores').select('user_id,game_id,points,breakdown').eq('group_id', groupId).in('game_id', finishedGameIds)`.
9. Para cada jogo, montar `ParticipantEntry[]` (tipo existente em `@/lib/types/participant`).
10. Calcular pontos do dia por participante: somar `scores.points` para jogos `finished`. Para jogos `live`, os pontos parciais são calculados no Client Component via `calculateLiveScore()`.
11. Renderizar header público + `PublicDateClient`.
12. Gerar `generateMetadata` com título `{N} JOGOS · {DD MMM YYYY} — Bolão da Copa`.

**Tratamento de erros inline (sem `notFound()`, sem redirect):**
- `date` inválida: `✗ DATA INVÁLIDA`
- `groupId` ausente: `✗ PARÂMETRO DE GRUPO AUSENTE`
- Sem jogos: estado vazio `NENHUM JOGO NESTA DATA`
- Grupo não encontrado: `✗ GRUPO NÃO ENCONTRADO`

Todos os erros mantêm o header público visível (`BOLÃO DA COPA · VISUALIZAÇÃO PÚBLICA`).

**Dados passados ao Client Component:**
```typescript
interface PublicDateClientProps {
  groupId: string
  date: string              // YYYY-MM-DD em UTC (match_day)
  initialGames: PublicDateGame[]  // definido abaixo
  initialParticipants: ProfileEntry[]  // { userId, name }
  initialGameParticipants: Record<string, ParticipantEntry[]>  // gameId → ParticipantEntry[]
}
```

---

### Tipos novos

```typescript
// lib/types/public-date.ts (ou inline no page.tsx)
interface PublicDateGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  round: string
  venue: string | null
  match_date: string
}

interface ProfileEntry {
  userId: string
  name: string
}
```

---

### `app/publico/[groupId]/[date]/public-date-client.tsx`

**Tipo:** Client Component (`'use client'`)
**Arquivo:** `app/publico/[groupId]/[date]/public-date-client.tsx`

**Props:**
```typescript
interface PublicDateClientProps {
  groupId: string
  date: string
  initialGames: PublicDateGame[]
  initialParticipants: ProfileEntry[]
  initialGameParticipants: Record<string, ParticipantEntry[]>
}
```

**Estado gerenciado:**
- `games: PublicDateGame[]` — atualizado via Realtime de `games`
- `gameParticipants: Record<string, ParticipantEntry[]>` — atualizado via Realtime de `scores`

**Realtime:**
- Canal `public-date-games-${groupId}-${date}`: subscreve a `postgres_changes` na tabela `games`, filtro `game_id=eq.${gameId}` para **cada** jogo da data (múltiplas subscriptions OU canal único sem filtro com filtragem no handler). **Decisão de implementação:** usar um único canal `public-date-games-${groupId}-${date}` com evento `*` em `games` sem filtro de linha, e filtrar no handler apenas os jogos que pertencem à data (verificando se `payload.new.id` está em `gameIds`). Isso evita criar N canais para N jogos.
- Canal `public-date-scores-${groupId}-${date}`: subscreve a `postgres_changes` na tabela `scores`, sem filtro de linha, filtrar no handler apenas por `group_id === groupId` e `game_id IN gameIds`. Ao receber evento, atualizar `gameParticipants[gameId]` para o participante correspondente.
- Ao desmontar: `supabase.removeChannel()` para ambos os canais.

**Responsabilidades:**
- Calcular ranking do dia em tempo real: para cada participante, somar pontos oficiais de jogos `finished` (de `gameParticipants`) + pontos provisórios de jogos `live` via `calculateLiveScore()`.
- Passar `liveHomeScore` e `liveAwayScore` do estado `games` atual para `PublicParticipantsList` de cada jogo ao vivo.
- Renderizar `PublicDateRanking` com ranking do dia (calculado client-side).
- Renderizar uma `PublicDateGameSection` por jogo.

---

### `components/bolao/PublicDateRanking.tsx`

**Tipo:** componente puro (sem estado interno, recebe dados calculados do pai)

**Props:**
```typescript
interface PublicDateRankingProps {
  participants: Array<{
    userId: string
    name: string
    officialPoints: number    // soma de jogos finished
    livePoints: number        // soma de jogos live (provisório)
    hasLivePoints: boolean
  }>
}
```

**Visual (referência: tabela de ranking de DESIGN.md):**

```
┌──────────────────────────────────────────────────┐
│  RANKING DO DIA                                  │
├─────┬────────────────────────┬────────────────────┤
│  #  │ PARTICIPANTE           │ PONTOS             │
├─────┼────────────────────────┼────────────────────┤
│  1  │ ► JOAO                 │   14               │
│  2  │   MARIA                │   11  ★ AO VIVO   │
│  3  │   PEDRO                │    8               │
└─────┴────────────────────────┴────────────────────┘
```

- Ordenar por `officialPoints + livePoints` decrescente; desempate por nome pt-BR.
- Líder com `►` em `color-accent`.
- Quando `hasLivePoints = true`: exibir `★ AO VIVO` em `color-live` (9px) ao lado dos pontos para indicar que inclui parcial.
- Pontos em `color-accent` (bold).
- Rodapé: `* PONTOS AO VIVO SÃO PROVISÓRIOS` em `color-muted` (10px), visível apenas quando `hasLivePoints = true` para algum participante.
- Sem animação FLIP (fora de escopo — simplificar para esta primeira versão pública).

---

### `components/bolao/PublicDateGameSection.tsx`

**Tipo:** componente puro (sem estado interno, recebe dados do pai)

**Props:**
```typescript
interface PublicDateGameSectionProps {
  game: PublicDateGame
  participants: ParticipantEntry[]  // já com visibilidade condicional aplicada pelo SSR
  liveHomeScore: number | null
  liveAwayScore: number | null
}
```

**Visual:**

```
┌──────────────────────────────────────────────────┐
│  GRP A · 15:00 BRT                               │
├──────────────────────────────────────────────────┤
│       BRA   3  ×  1   ARG        ■ AO VIVO       │
├──────────────────────────────────────────────────┤
│  PARTICIPANTE     PALPITE    PTS*                 │
│  JOAO             2×1        +5                  │
│  MARIA            3×1        +8 ★                │
│  PEDRO            OCULTO     —                   │
└──────────────────────────────────────────────────┘
```

- Header: rodada (formatada para remover `Copa do Mundo NNNN - `) + horário BRT.
- Placar central: `home_team_code × away_team_code` com `home_score × away_score` em `color-accent` bold. Se `pending`: `— × —`.
- Badge de status igual ao `PublicScoreCard` existente: `■ AO VIVO` em `color-live` piscante; `□ ENCERRADO` em `color-muted`; sem badge se `pending`.
- Tabela de palpites: **reutilizar `PublicParticipantsList`** existente em `components/bolao/PublicParticipantsList.tsx`. Isso garante consistência visual com a página pública de jogo e evita duplicação de lógica de visibilidade (OCULTO/PENDENTE em pending, palpite real em live/finished, pontuação provisória ao vivo).
- Sem accordion de breakdown (consistente com `PublicParticipantsList` existente).

---

### Modificação em `palpites-live-section.tsx`

**Arquivo:** `app/(dashboard)/palpites/palpites-live-section.tsx`

Adicionar botão `⎘ COPIAR LINK DO DIA` ao lado do `DateChipsNav`, dentro do container sticky.

**Comportamento:**
- Ao clicar, copia `${window.location.origin}/publico/${groupId}/${selectedDate}` para o clipboard.
- Feedback visual por 2 segundos: texto muda para `✓ COPIADO!` em `color-win`.
- Usa `navigator.clipboard.writeText()` com try/catch silencioso (mesmo padrão do `GameCard`).

**Visual:**
```
[DateChipsNav faixa de chips horizontais]
[⎘ COPIAR LINK DO DIA]   — botão full-width abaixo dos chips, cor color-muted, uppercase
```

O botão deve ter largura total (`width: 100%`), padding `0.4rem 0.75rem`, borda `1px solid var(--color-border)`, background transparente, cor `color-muted`, font-size 10px, uppercase, letterSpacing 0.08em. Após cópia: cor muda para `color-win`, texto `✓ COPIADO!`.

---

## Regras de Negócio

### Visibilidade de palpites

Idêntica à regra já implementada em `public-game-view`:

```
SE jogo.status === 'pending':
  → buscar apenas user_id (sem home_score/away_score)
  → ParticipantEntry.prediction = null
  → ParticipantEntry.hasPrediction = true/false baseado na existência
  → PublicParticipantsList exibe "OCULTO" (hasPrediction=true) ou "PENDENTE" (false)
SE jogo.status === 'live' OU 'finished':
  → buscar home_score e away_score
  → ParticipantEntry.prediction = { home_score, away_score }
```

### Cálculo de pontos do dia

```
Para cada participante P:
  pontos_oficiais_dia = SUM(scores.points WHERE game IN games_finished_da_data AND group_id = groupId AND user_id = P.userId)
  
  Para cada jogo live da data:
    SE P tem palpite para o jogo:
      pontos_live += calculateLiveScore(game.home_score, game.away_score, P.prediction).points
  
  total_dia = pontos_oficiais_dia + pontos_live
  hasLivePoints = pontos_live > 0
```

O cálculo de `pontos_live` é feito inteiramente no Client Component, sem persistência em banco. Idêntico ao padrão já implementado em `usePalpitesAoVivo.ts`.

### Filtro por `match_day` (não `match_date`)

A data na URL é YYYY-MM-DD em UTC (`match_day`), não timestamp. Usar `.eq('match_day', date)` para buscar jogos, **não** calcular range de timestamps. Isso é consistente com `usePalpitesAoVivo`, `useLiveTodayRanking` e `useDailyRecap` que já usam `match_day`.

### Parâmetro `date` na URL

- Formato: `YYYY-MM-DD` em UTC (calendário ESPN/`match_day`).
- Validar com `isValidDateString` de `@/lib/date`.
- Data inválida = erro inline (não 404).

---

## Proteção de Rotas

Nenhuma — a rota `app/publico/[groupId]/[date]/` é pública por estrutura (fora de `(dashboard)` e `(auth)`). Não requer middleware.

O layout usado é o root layout (`app/layout.tsx`), que não verifica autenticação.

---

## Integração Supabase Realtime

### Canal de jogos

- **Canal:** `public-date-games-${groupId}-${date}`
- **Tabela:** `games`
- **Evento:** `UPDATE` (placar e status)
- **Filtro:** sem filtro de linha no canal (filtrar no handler por `gameId IN gameIds`)
- **O que fazer ao receber:** atualizar o estado `games` — substituir o jogo pelo novo payload, mantendo os outros intactos.

### Canal de scores

- **Canal:** `public-date-scores-${groupId}-${date}`
- **Tabela:** `scores`
- **Evento:** `INSERT` ou `UPDATE`
- **Filtro:** sem filtro de linha (filtrar no handler por `user_id`, `game_id` e `group_id`)
- **O que fazer ao receber:** atualizar `gameParticipants[gameId]` para o participante correspondente — substituir `points` e `breakdown` no `ParticipantEntry` do usuário.

**Nota:** as políticas anon para leitura Realtime de `games` e `scores` já existem (`20260624000010_public_read_games_scores.sql`). O `PublicDateClient` usa `createClient()` (anon key) para as subscriptions Realtime, assim como `PublicParticipantsList` já faz.

---

## Header Público

Mesmo header da página pública de jogo — linha única no topo da página:

```
BOLÃO DA COPA                              VISUALIZAÇÃO PÚBLICA
```

- Bg: `color-surface`
- Border bottom: `1px solid var(--color-border)`
- "BOLÃO DA COPA": `color-accent`, 13px bold uppercase, letterSpacing 0.1em
- "VISUALIZAÇÃO PÚBLICA": `color-muted`, 10px uppercase, letterSpacing 0.05em

---

## Critérios de Aceite

- [ ] Rota `/publico/[groupId]/[date]` acessível sem login em qualquer browser (incluindo aba anônima)
- [ ] Acessar sem `groupId` inválido ou vazio exibe erro `✗ PARÂMETRO DE GRUPO AUSENTE` inline — nunca mostra dados
- [ ] Acessar com `date` mal-formatada (não YYYY-MM-DD) exibe erro `✗ DATA INVÁLIDA` inline
- [ ] Acessar com data sem jogos exibe estado vazio `NENHUM JOGO NESTA DATA`
- [ ] Exibe um `PublicDateGameSection` por jogo da data, em ordem cronológica (match_date ASC)
- [ ] Em jogos `pending`, palpites de terceiros exibem OCULTO/PENDENTE (nunca revela valores)
- [ ] Em jogos `live` e `finished`, palpites exibem valores reais
- [ ] Ranking do dia exibe pontuação acumulada (soma dos jogos finalizados + provisório ao vivo)
- [ ] Jogos ao vivo indicam `★ AO VIVO` no ranking; rodapé indica pontuação provisória
- [ ] Placar de jogo ao vivo atualiza automaticamente via Supabase Realtime (sem reload)
- [ ] Pontuação de jogos encerrados atualiza automaticamente via Supabase Realtime (canal `scores`)
- [ ] Botão "⎘ COPIAR LINK DO DIA" na aba `/palpites` copia URL `/publico/${groupId}/${selectedDate}`
- [ ] Feedback visual do botão de copiar: muda para `✓ COPIADO!` por 2 segundos
- [ ] URL copiada abre a página correta em nova aba sem login
- [ ] Visual segue DESIGN.md: JetBrains Mono exclusivo, paleta verde/amarelo/azul, dense, sem ícones SVG decorativos, sem border-radius, sem sombras
- [ ] Funciona em mobile (coluna única, 375px)
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
