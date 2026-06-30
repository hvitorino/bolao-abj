# Spec: Chaveamento Expansível no Card de Palpites

**Slug:** inline-bracket-expand
**Data:** 2026-06-30
**Status:** spec

---

## Objetivo

Adicionar um ícone de expandir (⤢/⤡) no cabeçalho do card de jogos do dia (`PalpitesLiveCard`) na aba Palpites, visível apenas em dias de mata-mata (fase ≥ 16 avos de Final). Ao expandir, renderiza o componente `BracketTree` inline abaixo da grade de jogos, com fetch lazy dos dados do bracket.

---

## Histórias de Usuário

- Como participante do bolão, quero visualizar o chaveamento completo do mata-mata a partir da tela de palpites para entender o contexto dos jogos do dia sem precisar navegar para outra página.
- Como participante, quero clicar nos jogos do bracket para ver detalhes e fazer/editar meu palpite via GameAnaliseDrawer.

---

## Modelo de Dados

Nenhuma alteração. Reutiliza tabelas existentes:

- `bracket_slots` — 31 slots do mata-mata (já seedados)
- `games` — com FK `bracket_slot_id` para vincular jogo ao slot
- `predictions` — palpites do usuário

---

## Frontend — Alterações

### 1. `lib/hooks/usePalpitesAoVivo.ts`

**Mudanças:**

- Adicionar `phase` ao select do Supabase (campo já existe na tabela `games`)
- Adicionar `phase: string` à interface `LiveGameWithPrediction`
- Adicionar `phase` ao `GameRow` interno

### 2. `components/bolao/PalpitesLiveCard.tsx`

**Novas props:**
```ts
interface PalpitesLiveCardProps {
  todayGames: LiveGameWithPrediction[]
  loading: boolean
  onGameClick: (gameId: string) => void
  groupId: string          // NOVO — para o bracket e GameAnaliseDrawer
  currentUserId: string    // NOVO — para buscar palpites do usuário e drawer
}
```

**Novo estado:**
- `bracketExpanded: boolean` — controla expandir/recolher
- `bracketRoots: BracketSlotWithGame[] | null` — árvore do bracket (null = não carregado)
- `bracketPredictions: Record<string, Prediction>` — palpites do usuário para jogos do bracket
- `bracketLoading: boolean` — loading do fetch lazy
- `bracketGameId: string | null` — jogo selecionado no bracket para abrir drawer

**Lógica de detecção de mata-mata:**
```ts
const KNOCKOUT_PHASES = [
  '16 avos de Final',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinal',
  'Terceiro Lugar',
  'Final',
]
const isKnockoutDay = todayGames.length > 0 && KNOCKOUT_PHASES.includes(todayGames[0].phase)
```

**Ícone de expandir:**
- Posição: canto direito do cabeçalho (mesma linha do título da rodada)
- Sem label, apenas o caractere:
  - `⤢` quando recolhido (expandir)
  - `⤡` quando expandido (recolher)
- Estilo: botão inline, sem borda, cor `color-accent`, cursor pointer, fonte monospace
- `aria-label`: "Expandir chaveamento" / "Recolher chaveamento"
- `aria-expanded`: true/false

**Fetch lazy do bracket:**
- Disparado ao clicar em expandir, apenas se `bracketRoots === null`
- Busca do Supabase (client-side):
  1. `bracket_slots` → todos os slots
  2. `games` com `.not('bracket_slot_id', 'is', null)` → jogos vinculados
  3. `predictions` do `currentUserId` → palpites
- Constrói `gameBySlotId` e `gamesBySlotLabel`
- Chama `buildBracketTree(slots, gamesBySlotLabel)`
- Constrói `predictionByGameId`

**Renderização do bracket:**
- Quando `bracketExpanded && bracketRoots`:
  - Separador visual (`borderTop: 1px solid var(--color-border)`)
  - Label "CHAVEAMENTO — MATA-MATA" (11px, uppercase, color-muted)
  - `<BracketTree roots={bracketRoots} predictions={bracketPredictions} groupId={groupId} currentUserId={currentUserId} />`

**GameAnaliseDrawer do bracket:**
- Mesmo padrão do drawer já usado em `PalpitesLiveSection`
- `onPredictionSubmitted`: recarregar palpites do bracket (refetch das predictions)

### 3. `app/(dashboard)/palpites/palpites-live-section.tsx`

**Mudanças:**
- Passar `groupId` e `currentUserId` como props para `PalpitesLiveCard`

### Layout (mobile first)

```
┌─────────────────────────────────────────┐
│  OITAVAS DE FINAL                  ⤢   │  ← cabeçalho com ícone
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐              │
│  │ 🏴 2×1 🏴 │  │ 🏴 3×0 🏴 │              │  ← grade 2-col
│  │   2×1   │  │   3×0   │              │
│  └─────────┘  └─────────┘              │
├─────────────────────────────────────────┤
│  CHAVEAMENTO — MATA-MATA          ⤡   │  ← expandido
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──────┐    │
│  │  │→ │  │→ │  │→ │  │→ │FINAL │    │
│  │  │  │  │  │  │  │  │  │3º L  │    │
│  └──┘  └──┘  └──┘  └──┘  └──────┘    │
│         ← scroll horizontal →          │
└─────────────────────────────────────────┘
```

---

## Regras de Negócio

- O ícone ⤢ só aparece se `todayGames[0].phase` estiver na lista `KNOCKOUT_PHASES`
- Se `todayGames` estiver vazio ou for fase de grupos, o ícone não renderiza
- O fetch do bracket é lazy: só ocorre na primeira expansão. Expansões subsequentes reutilizam dados em memória
- Ao recolher, os dados do bracket permanecem em memória (não refetch ao re-expandir na mesma sessão)
- O `GameAnaliseDrawer` do bracket é independente do drawer principal da página — ao fechar o drawer, volta ao bracket expandido

---

## Critérios de Aceite

- [ ] Ícone ⤢ visível apenas em dias com fase ≥ 16 avos de Final
- [ ] Ícone não aparece em dias de fase de grupos
- [ ] Clique em ⤢ expande o bracket inline com transição visual
- [ ] Clique em ⤡ recolhe o bracket
- [ ] BracketTree renderiza slots com times, placares e palpites coloridos
- [ ] Clique em jogo do bracket abre GameAnaliseDrawer
- [ ] Ao fechar drawer, volta ao bracket expandido
- [ ] Fetch lazy: só carrega dados ao primeiro expandir
- [ ] Scroll horizontal funciona no bracket em mobile
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta, bordas simples, ASCII symbols
- [ ] Acessibilidade: aria-expanded, aria-label no botão
- [ ] Sem regressão: card de jogos em fase de grupos permanece inalterado
