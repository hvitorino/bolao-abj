# Spec: Palpites e Pontuação dos Participantes por Jogo

**Slug:** game-participants-view
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Dentro de cada card de jogo na tela `/jogos`, exibir uma seção que lista todos os participantes do bolão com seu palpite (ex: "2×1") e, se o jogo já encerrou, sua pontuação naquele jogo (ex: "+8 pts"). Qualquer participante logado pode ver os dados de todos os outros. Os dados devem ser carregados via uma única query no servidor (Server Component), sem N+1.

---

## Histórias de Usuário

- Como participante logado, quero ver o palpite de todos os outros jogadores em cada partida para comparar estratégias e acompanhar quem acertou o quê.
- Como participante logado, quero ver a pontuação que cada participante ganhou em um jogo encerrado para entender quem se beneficiou mais daquele resultado.
- Como participante logado, quero saber quando outro participante não fez palpite em um jogo para ter contexto do engajamento geral do bolão.

---

## Modelo de Dados

### Nenhuma tabela nova é necessária

Esta feature lê dados das tabelas existentes: `profiles`, `predictions`, `scores` e `games`. Nenhuma migration é necessária.

### Query principal (sem N+1)

A busca de todos os participantes com palpites e pontuações por jogo deve ser feita com um único SELECT em `profiles` com LEFT JOINs filtrados por `game_id`. Como o Supabase JS SDK não suporta JOINs condicionais em colunas de tabelas relacionadas com filtro em FK reversa de forma eficiente, a abordagem correta é buscar em paralelo:

1. Todos os perfis: `SELECT id, name FROM profiles ORDER BY name ASC`
2. Todos os palpites do dia (todos os game_ids do dia): `SELECT * FROM predictions WHERE game_id IN (...gameIds)`
3. Todos os scores do dia: `SELECT * FROM scores WHERE game_id IN (...gameIds)`

Essas três queries já ocorrem em `JogosPage` (exceto a de profiles e palpites de todos os usuários). O Server Component será estendido para buscar palpites e scores de **todos** os usuários (não apenas do usuário logado).

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo é necessário. Os dados são lidos diretamente do Supabase no Server Component Next.js.

---

## Frontend — Componentes React

### GameParticipantsList

**Arquivo:** `components/bolao/GameParticipantsList.tsx`

**Descrição:** Componente Server Component (sem `'use client'`) que recebe os dados já resolvidos via props e renderiza a lista compacta de participantes com palpites e pontuações para um jogo específico.

**Props:**
```typescript
interface ParticipantEntry {
  userId: string
  name: string
  prediction: { home_score: number; away_score: number } | null
  points: number | null // null quando jogo não encerrado ou score ainda não calculado
}

interface GameParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  currentUserId?: string // para destacar o usuário logado
}
```

**Estados:**

| Estado | Condição | Renderização |
|--------|----------|--------------|
| `empty` | `participants.length === 0` | Linha única: `SEM PARTICIPANTES` em `color-muted` |
| `populated` | padrão | Tabela compacta com linhas por participante |

**Layout (inspirado no padrão tabular do DESIGN.md):**

```
┌────────────────────────────────────────────────────┐
│  PALPITES DOS PARTICIPANTES                        │
├──────────────────────┬───────────┬─────────────────┤
│  PARTICIPANTE        │ PALPITE   │ PTS             │
├──────────────────────┼───────────┼─────────────────┤
│  ■ VOCÊ              │  2 × 1   │  +8             │
│    GOLEADOR_MASTER   │  3 × 0   │  +3             │
│    FUTEBOL_REI       │    -     │   -             │
└──────────────────────┴───────────┴─────────────────┘
```

**Regras visuais:**
- Seção com título `PALPITES DOS PARTICIPANTES` em `color-muted`, `font-size: 10px`, `uppercase`, `letter-spacing: 0.1em`
- Separada do restante do card por `border-top: 1px dashed var(--color-border)` e `padding: 0.75rem`
- Tabela sem bordas externas; linhas separadas por `border-bottom: 1px solid var(--color-border)` apenas
- Coluna PARTICIPANTE: `color-text`, `font-size: 11px`, `uppercase`. O usuário atual recebe prefixo `■` em `color-primary`
- Coluna PALPITE: `color-accent`, `font-weight: bold`, `font-size: 12px`. Se sem palpite: `-` em `color-muted`
- Coluna PTS: visível somente quando `gameStatus === 'finished'`. Valor em `color-accent` se `points > 0`, `color-muted` se `points === 0`. Se sem palpite: `-` em `color-muted`. Formato: `+N`
- Quando `gameStatus === 'pending'` ou `gameStatus === 'live'`: coluna PTS não é renderizada (apenas 2 colunas)
- `font-family: 'JetBrains Mono', 'Courier New', monospace` em todo o componente
- Sem sombras, sem ícones decorativos além de `■` (ASCII)

### Modificações em `app/(dashboard)/jogos/page.tsx`

**Arquivo:** `app/(dashboard)/jogos/page.tsx`

O Server Component atual já busca `predictions` e `scores` apenas do usuário logado. Deve ser estendido para:

1. Buscar todos os perfis do bolão:
```typescript
const { data: allProfiles } = await supabase
  .from('profiles')
  .select('id, name')
  .order('name', { ascending: true })
```

2. Buscar palpites de **todos** os usuários nos jogos do dia (sem filtro `eq('user_id', user.id)`):
```typescript
const { data: allPredictions } = await supabase
  .from('predictions')
  .select('id, game_id, user_id, home_score, away_score, submitted_at')
  .in('game_id', gameIds)
```

3. Buscar scores de **todos** os usuários nos jogos do dia:
```typescript
const { data: allScores } = await supabase
  .from('scores')
  .select('id, game_id, user_id, points, breakdown')
  .in('game_id', gameIds)
```

4. Montar estrutura `participantsByGameId: Record<string, ParticipantEntry[]>` indexando perfis com seus palpites e pontuações por jogo, para ser passada ao `GameList` e `GameCard`.

**Tipo auxiliar a criar em `lib/types/participant.ts`:**
```typescript
export interface ParticipantEntry {
  userId: string
  name: string
  prediction: { home_score: number; away_score: number } | null
  points: number | null
}
```

### Modificações em `components/games/GameList.tsx`

Adicionar prop `participantsByGameId?: Record<string, ParticipantEntry[]>` e repassá-la ao `GameCard`.

### Modificações em `components/games/GameCard.tsx`

Adicionar prop `participants?: ParticipantEntry[]` e renderizar `<GameParticipantsList>` no final da área de palpite do card (abaixo da seção existente de palpite/pontuação do usuário logado), separado por `border-top: 1px dashed var(--color-border)`.

A seção de participantes deve aparecer **sempre** (independente do status do jogo), desde que `participants` seja um array não vazio.

---

## Regras de Negócio

1. **Visibilidade dos palpites:** palpites de outros participantes ficam visíveis a qualquer usuário logado, independente do status do jogo. Não há regra de ocultar palpites antes do início do jogo nesta spec (a competição já está em andamento).

2. **Pontuação exibida:** a coluna PTS aparece apenas quando `game.status === 'finished'`. Para jogos `pending` ou `live`, a coluna é omitida — não exibe `0` ou traço na coluna de pontos.

3. **Participante sem palpite:** exibe `-` nas colunas PALPITE e PTS. Não omite a linha do participante.

4. **Ordenação dos participantes:** ordenar por `name ASC` (mesmo critério da query de profiles). O usuário logado pode aparecer em qualquer posição da lista — apenas recebe destaque visual com prefixo `■`.

5. **Sem N+1:** todas as queries devem ser disparadas em paralelo (usando `Promise.all` ou execução paralela do Supabase) antes de montar o `participantsByGameId`. O `GameCard` recebe os dados prontos via props; não faz nenhuma fetch própria para participantes.

6. **RLS:** as queries de `predictions` e `scores` de todos os usuários requerem que as políticas RLS do Supabase permitam leitura por qualquer usuário autenticado. Verificar e, se necessário, adicionar policies:
   - `predictions`: `SELECT` para `auth.role() = 'authenticated'` (sem filtro por `user_id`)
   - `scores`: `SELECT` para `auth.role() = 'authenticated'` (sem filtro por `user_id`)
   - `profiles`: `SELECT` para `auth.role() = 'authenticated'`

   Se essas policies já existirem, nenhuma migration é necessária.

---

## Proteção de Rotas

Nenhuma rota nova. A funcionalidade vive dentro de `/jogos`, já protegida pelo middleware existente. Os dados de todos os participantes são lidos no Server Component com `createClient()` (servidor), que respeita a sessão do usuário logado.

---

## Integração Supabase Realtime

Esta feature não adiciona nova integração Realtime. Os palpites e pontuações dos participantes são dados estáticos no SSR do Server Component — eles refletem o estado no momento do carregamento da página.

**Justificativa:** palpites são imutáveis após o deadline; scores são calculados após o jogo encerrar. Realtime para `participantsByGameId` não agrega valor perceptível e aumentaria a complexidade do `GameCard` (já tem dois canais: `useGameRealtime` e `useScoreRealtime`).

---

## Critérios de Aceite

- [ ] Em cada card de jogo na tela `/jogos`, uma seção "PALPITES DOS PARTICIPANTES" lista todos os perfis do bolão
- [ ] Cada linha exibe: nome do participante, palpite formatado como `H × A` (ou `-` se sem palpite)
- [ ] Para jogos com `status === 'finished'`, cada linha exibe a pontuação no formato `+N` (ou `-` se sem palpite)
- [ ] Para jogos com `status === 'pending'` ou `status === 'live'`, a coluna de pontuação não é renderizada
- [ ] O usuário logado é identificado com prefixo `■` em `color-primary` na sua linha
- [ ] Participantes sem palpite aparecem na lista (linha com `-` nos campos)
- [ ] Nenhuma query N+1: a página busca todos os dados em no máximo 4 queries paralelas (games, profiles, all predictions, all scores)
- [ ] RLS do Supabase permite leitura de predictions, scores e profiles por qualquer usuário autenticado
- [ ] Layout segue DESIGN.md: fonte monospace JetBrains Mono, paleta de tokens `color-*`, sem ícones SVG decorativos, bordas simples, sem sombras
- [ ] Funciona em mobile (coluna única, tabela compacta sem overflow)
- [ ] Componente `GameParticipantsList` criado em `components/bolao/GameParticipantsList.tsx`
- [ ] Tipo `ParticipantEntry` criado em `lib/types/participant.ts`
- [ ] `GameCard`, `GameList` e `JogosPage` modificados para propagar os dados de participantes
