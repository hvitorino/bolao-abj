# Spec: Exibir Todos os Jogos Anteriores na Análise

**Slug:** fix-all-recent-games
**Data:** 2026-06-30
**Status:** spec

---

## Objetivo

Alterar a seção "Últimos 3 jogos na Copa 2026" no drawer de análise de jogos para "Jogos", exibindo todos os jogos anteriores dos times na Copa 2026, em vez de apenas os 3 mais recentes.

---

## Histórias de Usuário

- Como participante do bolão, quero ver todos os jogos anteriores de cada time na Copa 2026 na seção de análise, para ter uma visão completa do desempenho histórico do time no torneio.

---

## Modelo de Dados

Nenhuma alteração. Nenhuma migration necessária.

---

## Backend

Nenhum endpoint novo ou modificado. A query de `allTeamGames` no Supabase já retorna todos os jogos — a limitação a 3 ocorre apenas no frontend.

---

## Frontend — Alterações

### 1. `lib/analytics/team-stats.ts` — Função `getRecentGames`

**Alteração:** Remover `.slice(0, 3)` da linha 94.

**Antes:**
```ts
.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
.slice(0, 3)
```

**Depois:**
```ts
.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
```

A ordenação por data (mais recente primeiro) é mantida.

### 2. `components/bolao/RecentGamesSection.tsx` — Título da seção

**Alteração:** Linha 193 — mudar o texto do título.

**Antes:**
```
► ÚLTIMOS 3 JOGOS NA COPA 2026
```

**Depois:**
```
► JOGOS
```

### 3. `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — Comentários

**Alteração:** Atualizar comentários nas linhas 231 e 273 para refletir a nova semântica.

**Linha 231 — Antes:**
```ts
// Calcular últimos 3 jogos por time
```

**Depois:**
```ts
// Calcular jogos anteriores por time
```

**Linha 273 — Antes:**
```ts
{/* Seção de últimos 3 jogos */}
```

**Depois:**
```ts
{/* Seção de jogos anteriores */}
```

---

## Regras de Negócio

Nenhuma alteração nas regras de pontuação ou deadlines.

---

## Integração Supabase Realtime

Nenhuma alteração.

---

## Critérios de Aceite

- [ ] Título da seção é "► JOGOS" (não "► ÚLTIMOS 3 JOGOS NA COPA 2026")
- [ ] `.slice(0, 3)` removido de `getRecentGames` — todos os jogos anteriores são retornados
- [ ] Comentários na página de análise atualizados
- [ ] Layout, cores e tipografia mantêm o estilo Elifoot retro conforme DESIGN.md
- [ ] Funciona em mobile (coluna única)
- [ ] Sem regressão: página `/jogos/[gameId]/analise` e drawer de análise continuam funcionando
