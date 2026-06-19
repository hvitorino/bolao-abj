# Spec: Cards Visuais de Jogos no Recap

**Slug:** recap-game-cards
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Na seção "JOGOS DE ONTEM" do `RecapBottomSheet`, substituir a linha de texto simples (`home_team_code + placar + away_team_code`) por cards compactos com bandeira emoji, código do time e placar centralizado, tornando a leitura dos resultados mais rápida e o visual mais rico sem alterar qualquer dado ou lógica de negócio.

---

## Histórias de Usuário

- Como participante do bolão, quero ver os resultados dos jogos de ontem de forma visualmente clara no bottom sheet, para identificar rapidamente os placares sem ter que decifrar texto puro.
- Como participante do bolão, quero ver a bandeira e o código de cada seleção nos cards de jogo do recap, para reconhecer os times de forma imediata, da mesma forma que vejo nos cards da tela de jogos.

---

## Modelo de Dados

Nenhuma alteração. O tipo `RecapGame` existente em `lib/hooks/useDailyRecap.ts` já expõe todos os campos necessários:

```typescript
export interface RecapGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string   // usado para getTeamFlag() e exibição
  away_team_code: string   // usado para getTeamFlag() e exibição
  home_score: number
  away_score: number
}
```

Sem migrations, sem novos endpoints, sem alteração no hook.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. Mudança puramente de frontend.

---

## Frontend — Componentes React

### RecapGameCard (sub-componente interno)

**Arquivo:** `components/bolao/RecapBottomSheet.tsx` (definido como função local dentro do arquivo, não como arquivo separado — a feature é pequena demais para justificar arquivo novo)

**Interface do sub-componente:**

```typescript
interface RecapGameCardProps {
  game: RecapGame
}

function RecapGameCard({ game }: RecapGameCardProps): JSX.Element
```

**Layout visual do card:**

```
┌─────────────────────────────────────────────────┐
│  🇧🇷         3  ×  1         🇦🇷               │
│  BRA                         ARG               │
└─────────────────────────────────────────────────┘
```

O card usa `display: grid` com três colunas (`1fr auto 1fr`), espelhando a estrutura já usada no `GameCard.tsx` (corpo do card, linhas 200-274).

**Coluna esquerda (time da casa):**
- Bandeira emoji via `getTeamFlag(game.home_team_code)`, `fontSize: '22px'`, `lineHeight: 1`
- Código `game.home_team_code` abaixo, `fontSize: '11px'`, `color: 'var(--color-muted)'`, `textTransform: 'uppercase'`, `fontFamily: FONT`, `letterSpacing: '0.05em'`
- Alinhamento: `textAlign: 'center'`

**Coluna central (placar):**
- Texto `{game.home_score} × {game.away_score}`, `fontSize: '18px'`, `fontWeight: 'bold'`, `color: 'var(--color-accent)'`, `fontFamily: FONT`, `letterSpacing: '0.05em'`
- `textAlign: 'center'`, `minWidth: '60px'`

**Coluna direita (time visitante):**
- Bandeira emoji via `getTeamFlag(game.away_team_code)`, `fontSize: '22px'`, `lineHeight: 1`
- Código `game.away_team_code` abaixo, mesmos estilos da coluna esquerda
- Alinhamento: `textAlign: 'center'`

**Container do card:**
- `border: '1px solid var(--color-border)'`
- `padding: '0.5rem 0.75rem'`
- `marginBottom: '0.5rem'`
- `backgroundColor: 'var(--color-bg)'` (levemente mais escuro que `color-surface` do painel)
- Sem `borderRadius`, sem `boxShadow`

### RecapBottomSheet (modificação)

**Arquivo:** `/Users/hamonvitorino/workspace/bolao-abj/components/bolao/RecapBottomSheet.tsx`

**O que muda:**

1. Adicionar import de `getTeamFlag` no topo:
   ```typescript
   import { getTeamFlag } from '@/lib/utils/teamFlag'
   ```

2. Remover o estilo `gameRow` e `gameScore` do objeto `S` (não serão mais usados após a substituição).

3. Substituir o bloco da seção "JOGOS DE ONTEM" (linhas 311-323 atuais):

   **Antes:**
   ```tsx
   {data.games.map((g) => (
     <div key={g.id} style={S.gameRow}>
       <span style={{ color: 'var(--color-muted)', minWidth: '3ch', textAlign: 'right' }}>
         {g.home_team_code}
       </span>
       <span style={S.gameScore}>
         {g.home_score} × {g.away_score}
       </span>
       <span style={{ color: 'var(--color-muted)' }}>
         {g.away_team_code}
       </span>
     </div>
   ))}
   ```

   **Depois:**
   ```tsx
   {data.games.map((g) => (
     <RecapGameCard key={g.id} game={g} />
   ))}
   ```

4. Definir a função `RecapGameCard` dentro do mesmo arquivo, antes do componente principal `RecapBottomSheet`.

**Supabase Realtime:** não aplicável — seção estática, sem subscribe.

---

## Regras de Negócio

Não há regras de negócio novas. Os dados de `data.games` já chegam prontos via `useDailyRecap`: apenas jogos com `status = 'finished'` do dia anterior em BRT, com `home_score` e `away_score` garantidamente não-nulos (o hook faz `g.home_score ?? 0`).

---

## Proteção de Rotas

Sem alteração. `RecapBottomSheet` é renderizado dentro do dashboard que já exige autenticação.

---

## Integração Supabase Realtime

Não aplicável. Nenhuma subscrição nova.

---

## Critérios de Aceite

- [ ] Cada jogo de `data.games` é renderizado como um card independente com layout de três colunas (`1fr auto 1fr`)
- [ ] Coluna esquerda exibe `getTeamFlag(g.home_team_code)` (emoji, `22px`) acima de `g.home_team_code` (uppercase, `11px`, `color-muted`)
- [ ] Coluna central exibe `{g.home_score} × {g.away_score}` em `color-accent`, bold, `18px`, centralizado
- [ ] Coluna direita exibe `getTeamFlag(g.away_team_code)` acima de `g.away_team_code`, mesmos estilos da esquerda
- [ ] Card tem `border: 1px solid var(--color-border)`, sem `borderRadius`, sem `boxShadow`, conforme DESIGN.md
- [ ] Import de `getTeamFlag` adicionado em `RecapBottomSheet.tsx`
- [ ] Estilos `gameRow` e `gameScore` removidos do objeto `S` (dead code eliminado)
- [ ] Nenhuma alteração em `useDailyRecap.ts`, no schema do Supabase ou em endpoints Ruby
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, dense, sem ícones decorativos além das bandeiras emoji, sem border-radius excessivo, sem sombra
- [ ] Funciona em mobile (coluna única, card full-width)
