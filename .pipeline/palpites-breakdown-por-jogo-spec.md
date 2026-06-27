# Spec: Breakdown Vertical por Jogo nos Palpites

**Slug:** palpites-breakdown-por-jogo
**Data:** 2026-06-27
**Status:** spec

---

## Objetivo

Substituir o agrupamento de pontos por regra no accordion de `PalpitesRankingRow` por blocos
verticais jogo a jogo — cada bloco exibe uma linha-cabeçalho (códigos dos times + placar real +
palpite do participante + total do jogo) com sub-linhas indentadas para cada regra que pontuou,
empilhados verticalmente para eliminar qualquer scroll horizontal em mobile (~360px).

---

## Histórias de Usuário

- Como participante do bolão, quero ver de qual jogo cada ponto veio ao expandir um participante
  no ranking de palpites, para entender a origem de cada pontuação sem scroll lateral.
- Como usuário em mobile (375px), quero que o breakdown caiba na tela verticalmente, para
  não precisar rolar para os lados.
- Como usuário, quero que o palpite de outros participantes em jogos pendentes fique oculto, para
  manter a privacidade até o jogo começar.
- Como usuário, quero ver pontos ao vivo sinalizados com `*` e em vermelho, para distinguir
  pontuação provisória de pontuação oficial.

---

## Modelo de Dados

Nenhuma alteração de schema, RLS, migrations ou API. Esta feature é puramente de apresentação.

Os dados já chegam via `participant.games: GameScoreEntry[]` do hook `usePalpitesAoVivo.ts`
com todos os campos necessários.

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma alteração de backend.

---

## Frontend — Componentes React

### PalpitesRankingRow (refatoração)

**Arquivo:** `components/bolao/PalpitesRankingRow.tsx`

Esta é a única modificação desta feature. O componente de linha principal (`PalpitesRankingRow`)
permanece inalterado. A mudança está inteiramente no bloco do accordion (a região expandível).

#### O que remover

- Função `buildRuleGroups(games: GameScoreEntry[]): RuleGroup[]`
- Componente local `RuleGroupLine({ group }: { group: RuleGroup })`
- Componente local `LiveGameLine({ game }: { game: GameScoreEntry })`
- Interfaces locais `RuleGame` e `RuleGroup`
- As constantes `ruleGroups` e `liveGames` que eram derivadas delas
- Toda a lógica de `ruleGroups.map` e `liveGames.map` dentro do accordion

#### O que adicionar

**Componente local `GameBreakdownBlock`**

```typescript
interface GameBreakdownBlockProps {
  game: GameScoreEntry
  isCurrentUser: boolean
}
```

Responsabilidades:
1. Renderizar a linha-cabeçalho do jogo
2. Renderizar as sub-linhas de regra (apenas regras com pontos > 0)
3. Aplicar guard de privacidade para palpite de terceiro em jogo pendente
4. Aplicar estilo `color-live` + sufixo `*` quando `status === 'live'`

#### Lógica de iteração no accordion

```typescript
// No JSX do accordion, substituir o render atual por:
{participant.games.map((game) => (
  <GameBreakdownBlock
    key={game.gameId}
    game={game}
    isCurrentUser={isCurrentUser}
  />
))}

{participant.games.length === 0 && (
  <EmptyState />
)}
```

O estado vazio "NENHUM PONTO CONQUISTADO HOJE" só aparece quando
`participant.games.length === 0`, ou seja, o participante não tem nenhum jogo registrado
para o dia — não quando simplesmente não pontuou.

---

### GameBreakdownBlock — Especificação Detalhada

#### Linha-cabeçalho (header line)

Layout: `[TIMES + PLACAR REAL]  [PALPITE]  [TOTAL]`

Todos os três segmentos na mesma linha, sem wrap, usando `display: flex` com
`justifyContent: 'space-between'` e `flexWrap: 'nowrap'`.

**Segmento esquerdo — times e placar real:**

```
BRA 2×1 ARG
```

- Quando `status === 'pending'`: mostrar `BRA vs ARG` (sem placar, pois é null)
- Quando `status === 'live'` ou `'finished'`: mostrar `BRA Hg×Ag ARG`
- Código dos times: `home_team_code` e `away_team_code` (já em maiúsculas no banco)
- Placar: `home_score × away_score` — nunca exibir `null`, usar `vs` no lugar

**Segmento central — palpite do participante:**

Guard de privacidade (defesa em profundidade sobre o RLS):

```typescript
const shouldHidePrediction = game.status === 'pending' && !isCurrentUser
const predictionLabel = shouldHidePrediction
  ? '—'
  : game.userPrediction
    ? `${game.userPrediction.home_score}×${game.userPrediction.away_score}`
    : '—'
```

Exibir `predictionLabel` centralizado, em `color-muted` quando pendente,
em `color-text` quando encerrado ou ao vivo.

**Segmento direito — total do jogo:**

| Status | Total exibido | Cor |
|--------|---------------|-----|
| `pending` | `—` | `color-muted` |
| `live` | `+N*` (onde N = `livePoints ?? 0`) ou `—` se `livePoints === null` | `color-live` |
| `finished` | `+N` (onde N = `officialPoints`) ou `0` se `officialPoints === null` | `color-accent` se N > 0, `color-muted` se N = 0 |

#### Sub-linhas de regra

Renderizar apenas quando existir breakdown com pontos > 0, usando a ordem canônica
de `BREAKDOWN_LABELS`:

```typescript
const keys = Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>

// Para finished:
const activeRules = keys.filter(
  (k) => game.officialBreakdown && (game.officialBreakdown[k] ?? 0) > 0
)

// Para live:
const activeRules = keys.filter(
  (k) => game.liveBreakdown && (game.liveBreakdown[k] ?? 0) > 0
)
```

Cada sub-linha:
```
  ✓ Acertou o vencedor      +3
```

Layout: indentação de `1rem` à esquerda, símbolo `✓` em `color-win`, label em `color-muted`,
pontos à direita — `+N` em `color-accent` para finished, `+N*` em `color-live` para live.

Quando `status === 'pending'` ou `status === 'finished'` com `officialBreakdown === null`
ou todos os pontos do breakdown são zero: não renderizar sub-linhas (só o cabeçalho).

---

### Ajuste de Padding do Accordion

Padding atual:
```
padding: '0.35rem 3.5rem 0.35rem 0.75rem'
```

Novo padding (sem recuo à direita — o layout vertical não precisa de espaço reservado):
```
padding: '0.25rem 0.5rem'
```

Isso garante que o conteúdo use a largura total disponível e não estoure em 360px.

---

### Estados do Accordion

| Condição | O que renderizar |
|----------|-----------------|
| `participant.games.length === 0` | `<EmptyState />` com "NENHUM PONTO CONQUISTADO HOJE" |
| `participant.games.length > 0` | Um `<GameBreakdownBlock>` por jogo, na ordem de `match_date` |

---

## Regras de Negócio

### Privacidade de palpites em jogos pendentes

- Se `game.status === 'pending'` E `!isCurrentUser`: exibir `—` no campo de palpite.
- O RLS já retorna `userPrediction === null` para terceiros em jogos pendentes (commit `df3817b`).
  O guard no componente é defesa em profundidade.
- O próprio usuário (`isCurrentUser === true`) sempre vê seu palpite, inclusive em pendente.

### Prioridade dos dados de breakdown

- `status === 'finished'`: usar `officialBreakdown` e `officialPoints`
- `status === 'live'`: usar `liveBreakdown` e `livePoints` (calculados client-side em
  `usePalpitesAoVivo.ts`)
- `status === 'pending'`: nenhum breakdown exibido; total vazio (`—`)

### Ordenação dos jogos

Os jogos em `participant.games` já chegam ordenados por `match_date ASC` do hook.
Não é necessário reordenar no componente.

### Ordenação das sub-linhas de regra

Seguir a ordem canônica definida pelas chaves de `BREAKDOWN_LABELS`:
`winner → exact → winner_score → diff → loser_score → goleada`.

### Sinalização de pontos ao vivo

- Todo valor de ponto de jogo `live` recebe sufixo `*` (asterisco) e cor `var(--color-live)`.
- Isso inclui o total da linha-cabeçalho E cada `+N` nas sub-linhas.
- O sufixo `*` comunica "provisório, pode mudar".

### Jogo sem palpite (userPrediction === null)

- `status === 'finished'` + `userPrediction === null`: exibir só o cabeçalho sem palpite e
  sem total (ou total `0`). Sem sub-linhas.
- `status === 'live'` + `userPrediction === null`: exibir cabeçalho com `—` no palpite e
  `—` no total. Sem sub-linhas.
- `status === 'pending'` + `userPrediction === null` + `isCurrentUser === true`:
  exibir `—` no palpite. O usuário simplesmente não palpitou ainda.

---

## Proteção de Rotas

Nenhuma mudança. A rota `/palpites` já está protegida pelo middleware existente.

---

## Integração Supabase Realtime

Nenhuma mudança. O hook `usePalpitesAoVivo.ts` já implementa polling de 10s que entrega
`livePoints` e `liveBreakdown` atualizados. O componente apenas consome esses dados.

---

## Critérios de Aceite

- [ ] Em viewport 375px, ao expandir qualquer participante: sem scroll horizontal; cada jogo
      aparece como bloco vertical empilhado
- [ ] Jogo encerrado: linha-cabeçalho exibe `COD Hg×Ag COD | pred | +N`; sub-linhas batem com
      `officialBreakdown` (cruzável via MCP `ver_palpites_jogo`)
- [ ] Jogo ao vivo: total e sub-linhas em `var(--color-live)` com sufixo `*`; ao repoliar (10s)
      os valores atualizam sem reload
- [ ] Jogo pendente + terceiro: palpite exibe `—`; total exibe `—`; sem sub-linhas
- [ ] Jogo pendente + próprio usuário: palpite visível se existir; total `—`; sem sub-linhas
- [ ] Participante sem nenhum jogo no dia: exibe "NENHUM PONTO CONQUISTADO HOJE"
- [ ] Participante com jogos mas zero pontos: jogos aparecem (cabeçalho com total `0` ou `—`),
      sem o estado vazio
- [ ] Funções e tipos removidos: `buildRuleGroups`, `RuleGroupLine`, `LiveGameLine`,
      interfaces `RuleGame` e `RuleGroup` não existem mais no arquivo
- [ ] `npm run lint` sem erros ou warnings novos
- [ ] `npm run build` sem erros
- [ ] Design segue DESIGN.md: fonte monospace JetBrains Mono, paleta de tokens CSS,
      sem ícones SVG, símbolos ASCII (`✓`, `—`, `*`)

---

## Referências de Implementação

- Arquivo a modificar: `components/bolao/PalpitesRankingRow.tsx`
- Hook de dados (somente leitura): `lib/hooks/usePalpitesAoVivo.ts` — tipos `GameScoreEntry`,
  `RankingParticipantDetail`
- Ordem canônica das regras: `lib/scoring.ts` → `BREAKDOWN_LABELS`
- Guard de privacidade de referência: `components/bolao/GameParticipantsList.tsx` linhas 151–159
- Tipo de breakdown: `lib/types/score.ts` → `ScoreBreakdown`

---

## Mockup de Referência

```
1 ► VOCÊ                  42 ▲
  ──────────────────────────────
  BRA 2×1 ARG   2×1        +8
    ✓ Acertou o vencedor   +3
    ✓ Placar exato         +5
  FRA 0×2 ESP   0×2         0
  ALE 3×0 POR   3×0        +5
    ✓ Acertou o vencedor   +3
    ✓ Diferença de gols    +2
  MEX 1×0* URU  1×0        +3*   ← ao vivo (vermelho)
    ✓ Acertou o vencedor   +3*
  ITA vs FRA    —           —    ← pendente (terceiro)

2   OUTRO_JOGADOR         28 ▼
  ITA vs FRA    2×1         —   ← pendente (próprio usuário)
```
