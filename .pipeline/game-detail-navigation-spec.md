# Spec: Navegação para Detalhe do Jogo

**Slug:** game-detail-navigation
**Data:** 2026-06-22
**Status:** spec

---

## Objetivo

Tornar jogos clicáveis na aba "Campanha" (`/perfil`) e na aba "Palpites" (`/meus-palpites`), redirecionando para a página individual de cada jogo em `/jogos/[gameId]/analise`. Adicionalmente, ajustar o label padrão do `BackButton` na página de análise (`/jogos/[gameId]/analise`) para refletir que ele retorna à última rota visitada — não necessariamente à página de palpite.

---

## Análise do Estado Atual

### Página de detalhe do jogo
A página de detalhe já existe em `/jogos/[gameId]/analise` — implementada pela feature `analise-confronto`. Ela já usa `BackButton` com `fallbackHref` calculado a partir de `game.match_day`.

### BackButton (`components/bolao/BackButton.tsx`)
Componente Client já implementa a lógica correta de retorno:
- Se `window.history.length > 1`, chama `router.back()` (retorna à última rota visitada)
- Caso contrário, usa `router.push(fallbackHref)` (fallback)

A lógica de `router.back()` já está correta. O único problema é que o `label` padrão é `'← VOLTAR AO PALPITE'`, que não faz sentido quando o usuário chegou pela aba Campanha ou Palpites. O label precisa ser genérico o suficiente para todos os contextos.

### Aba "Campanha" (`/perfil` → `HistoryPanel.tsx`)
O `HistoryPanel` (`components/bolao/perfil/HistoryPanel.tsx`) exibe um feed cronológico de jogos encerrados. Cada item da lista (linhas 193–244) é uma `<div>` não clicável que mostra bandeiras, placar, palpite e pontos. Não há nenhum link ou navegação para a página do jogo.

Cada item tem `item.game_id` disponível como dado. O componente já importa `getTeamFlag`.

### Aba "Palpites" (`/meus-palpites/page.tsx`)
A página `meus-palpites` exibe uma tabela Server Component. Cada linha da tabela (`<tr key={prediction.id}`) é estática — não há link para a página do jogo. O `game.id` está disponível via `row.game` em cada iteração do `rows.map(...)`.

O campo JOGO (primeira coluna) exibe `getTeamFlag(game.home_team_code) × getTeamFlag(game.away_team_code)` e metadados. Esse conteúdo precisa virar um link.

---

## Mudanças Necessárias

### 1. `components/bolao/BackButton.tsx`

Alterar o label padrão de `'← VOLTAR AO PALPITE'` para `'← VOLTAR'`.

Isso resolve o texto inconsistente quando o usuário chega pela aba Campanha ou Palpites. A lógica de `router.back()` já funciona corretamente — nenhuma mudança de comportamento é necessária.

```tsx
// ANTES
export default function BackButton({ fallbackHref, label = '← VOLTAR AO PALPITE' }: BackButtonProps)

// DEPOIS
export default function BackButton({ fallbackHref, label = '← VOLTAR' }: BackButtonProps)
```

### 2. `components/bolao/perfil/HistoryPanel.tsx`

Tornar cada item do feed clicável, envolvendo o conteúdo da linha com um `<a>` (ou `Link` do Next.js) apontando para `/jogos/[game_id]/analise`.

O componente é `'use client'`, então pode importar `Link` de `next/link`.

**Mudanças específicas:**

- Importar `Link` de `'next/link'`
- No loop `dayItems.map((item, idx) => ...)`: substituir a `<div>` externa por um `<Link href={/jogos/${item.game_id}/analise}>` que preserve o estilo visual atual e adicione indicação visual de clicabilidade (cursor pointer, hover color)
- O link deve envolver apenas o bloco do `HistoryGameCard` e o conteúdo inline (palpite, pontos, troféu) — não o cabeçalho do dia (`▼ DD MMM`)
- Estilo do link: `textDecoration: 'none'`, `display: 'flex'`, `alignItems: 'center'`, `gap: '0.5rem'`, `flexWrap: 'wrap'`, `color: 'inherit'`. Adicionar `':hover': { backgroundColor: 'rgba(0, 156, 59, 0.07)' }` via className ou style inline com `onMouseEnter`/`onMouseLeave` (usar state local `hoveredId` ou pseudo-classe via CSS class)
- Para evitar complexidade de hover state, usar uma `<a>` nativa com uma classe CSS simples ou inline style sem hover

**Implementação recomendada** — substituir a `<div>` pai por `<Link>`:

```tsx
import Link from 'next/link'

// No dayItems.map:
<Link
  key={item.game_id}
  href={`/jogos/${item.game_id}/analise`}
  style={{
    padding: '0.4rem 1rem',
    borderBottom: idx < dayItems.length - 1 ? '1px solid var(--color-border)' : 'none',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  }}
>
  {/* conteúdo existente: HistoryGameCard + palpite + pontos + troféu */}
</Link>
```

### 3. `app/(dashboard)/meus-palpites/page.tsx`

Tornar cada linha da tabela clicável, navegando para `/jogos/[game.id]/analise`. A página é um Server Component — pode usar `Link` de `next/link` diretamente.

**Mudanças específicas:**

- Importar `Link` de `'next/link'`
- Na coluna JOGO (primeiro `<td>`), envolver o conteúdo interno (flags, metadados) com um `<Link href={/jogos/${game.id}/analise}>` que ocupe toda a célula
- Alternativa mais clara: tornar o `<tr>` inteiro clicável via um `<Link>` na célula JOGO com `display: 'block'` ou usar um wrapper que cubra toda a linha

**Implementação recomendada** — envolver o conteúdo da célula JOGO com Link:

```tsx
import Link from 'next/link'

// No <td> da coluna JOGO:
<td style={{ padding: '0.6rem 0.75rem', borderTop: cellBorder, textAlign: 'center' }}>
  <Link
    href={`/jogos/${game.id}/analise`}
    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
  >
    <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--color-text)', letterSpacing: '0.05em' }}>
      {getTeamFlag(game.home_team_code)} × {getTeamFlag(game.away_team_code)}
    </div>
    <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '0.2rem', textTransform: 'uppercase' }}>
      {formatRound(game.round)} · {formatDate(game.match_date)}
    </div>
    <div style={{
      fontSize: '9px',
      color: 'var(--color-primary)',
      textTransform: 'uppercase',
      marginTop: '0.2rem',
      letterSpacing: '0.08em',
    }}>
      ► VER ANÁLISE
    </div>
  </Link>
</td>
```

O indicador `► VER ANÁLISE` sinaliza claramente que o item é clicável, seguindo o padrão visual já usado no `GameCard.tsx` (barra "VER ANÁLISE").

---

## Comportamento Esperado

### Aba Campanha (`/perfil` → seção HISTÓRICO)
- Cada linha do feed histórico (jogos encerrados) é clicável
- Clicar navega para `/jogos/[game_id]/analise`
- Ao chegar na página de análise, `BackButton` chama `router.back()` porque `window.history.length > 1`, retornando para `/perfil`
- Se o usuário abrir a URL de análise diretamente (sem histórico), `BackButton` usa `fallbackHref` (que aponta para `/jogos?date=YYYY-MM-DD` do dia do jogo)

### Aba Palpites (`/meus-palpites`)
- A célula JOGO de cada linha da tabela é clicável
- Clicar navega para `/jogos/[game.id]/analise`
- Ao chegar na página de análise, `BackButton` chama `router.back()`, retornando para `/meus-palpites`
- Indicador `► VER ANÁLISE` abaixo do placar/metadados sinaliza a navegabilidade

### BackButton na página de análise
- Label alterado de `← VOLTAR AO PALPITE` para `← VOLTAR`
- Comportamento de `router.back()` inalterado — já funciona corretamente

---

## Histórias de Usuário

- Como participante do bolão, quero clicar em um jogo no meu histórico de campanha para ver a análise de confronto daquele jogo e revisitar meu desempenho
- Como participante do bolão, quero clicar em um jogo na lista de palpites para ver a análise de confronto daquele jogo sem precisar navegar manualmente até ele
- Como participante do bolão, quero que o botão Voltar na página de análise me leve de volta para onde eu estava (campanha ou palpites), não para um destino fixo

---

## Modelo de Dados

Nenhuma alteração de schema, migration ou endpoint é necessária. A feature é puramente de navegação e UI.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. A rota `/jogos/[gameId]/analise` já existe e funciona.

---

## Frontend — Componentes React

### BackButton
**Arquivo:** `components/bolao/BackButton.tsx`
**Mudança:** Alterar label padrão de `'← VOLTAR AO PALPITE'` para `'← VOLTAR'`
**Comportamento:** Inalterado — `router.back()` quando `window.history.length > 1`, `router.push(fallbackHref)` como fallback

### HistoryPanel
**Arquivo:** `components/bolao/perfil/HistoryPanel.tsx`
**Mudança:** Cada `<div>` de item no loop `dayItems.map(...)` vira um `<Link href={/jogos/${item.game_id}/analise}>`
**Importação a adicionar:** `import Link from 'next/link'`
**Estilo:** `textDecoration: 'none'`, `color: 'inherit'`, `display: 'flex'`, manter padding/border existentes
**Estados:** Não há estados novos — o componente é um loop de itens estáticos

### MeusPalpitesPage
**Arquivo:** `app/(dashboard)/meus-palpites/page.tsx`
**Mudança:** Conteúdo do `<td>` da coluna JOGO é envolvido em `<Link href={/jogos/${game.id}/analise}>` com `display: 'block'`
**Importação a adicionar:** `import Link from 'next/link'`
**Adicionar:** indicador `► VER ANÁLISE` em `color-primary` dentro do link, abaixo dos metadados do jogo
**Estados:** Nenhum — Server Component estático

---

## Regras de Negócio

- A navegação para `/jogos/[gameId]/analise` é válida para qualquer `game.id` — não há restrição por status do jogo (pending, live, finished)
- A página de análise já valida autorização (grupo ativo, autenticação) — nenhuma proteção adicional é necessária nos links
- Jogos sem pontuação calculada (pending) podem ser navegados — a página de análise trata esse caso exibindo stats sem placar
- O `BackButton` existente na página de análise (`/jogos/[gameId]/analise`) já usa `router.back()` como comportamento primário — a feature não muda essa lógica, apenas o label

---

## Proteção de Rotas

A rota `/jogos/[gameId]/analise` já é protegida (requer autenticação e membership no grupo ativo). Os links adicionados em `/perfil` e `/meus-palpites` apontam para essa rota existente — nenhuma proteção adicional é necessária.

---

## Integração Supabase Realtime

Nenhuma integração Realtime nova. A feature não adiciona subscriptions.

---

## Critérios de Aceite

- [ ] Cada item do feed HISTÓRICO em `/perfil` é clicável e navega para `/jogos/[game_id]/analise`
- [ ] Cada linha da tabela em `/meus-palpites` tem a coluna JOGO clicável, navegando para `/jogos/[game.id]/analise`
- [ ] A coluna JOGO em `/meus-palpites` exibe o indicador `► VER ANÁLISE` abaixo dos metadados do jogo
- [ ] O label do `BackButton` na página `/jogos/[gameId]/analise` é `← VOLTAR` (não `← VOLTAR AO PALPITE`)
- [ ] Ao navegar de `/perfil` → `/jogos/[gameId]/analise` e clicar em `← VOLTAR`, o usuário retorna para `/perfil`
- [ ] Ao navegar de `/meus-palpites` → `/jogos/[gameId]/analise` e clicar em `← VOLTAR`, o usuário retorna para `/meus-palpites`
- [ ] Os links não quebram o layout existente de `HistoryPanel` nem da tabela de `/meus-palpites`
- [ ] Design segue DESIGN.md: sem sublinhado nos links, `color: inherit` para não alterar paleta existente, estilo de cursor pointer
- [ ] `npm run lint` e `npm run build` passam sem erros novos
- [ ] Funciona em mobile (coluna única)

---

## Notas de Implementação

1. **`Link` vs `<a>`**: usar `Link` de `next/link` em ambos os casos para prefetch automático do Next.js. Em `HistoryPanel.tsx` (Client Component), `Link` funciona diretamente. Em `meus-palpites/page.tsx` (Server Component), `Link` também funciona diretamente.

2. **Hover state no HistoryPanel**: o componente é Client Component e poderia usar `useState` para hover, mas isso adiciona complexidade desnecessária. A abordagem mais simples é não adicionar hover visual explícito — o cursor `pointer` já sinaliza clicabilidade. Se hover for desejado, pode-se adicionar uma classe CSS ou usar `onMouseEnter`/`onMouseLeave` com state local.

3. **Impacto no BackButton**: a mudança do label padrão (`'← VOLTAR AO PALPITE'` → `'← VOLTAR'`) é um breaking change no nível de prop. Verificar se algum outro ponto de uso do `BackButton` passa o label explicitamente — se sim, não são afetados. Se algum ponto depende do label padrão e precisa do texto "VOLTAR AO PALPITE", ele deve passar o label explicitamente. Buscar todas as ocorrências de `BackButton` no codebase antes de alterar.

4. **Busca de usos do BackButton**: há apenas um uso confirmado — na `app/(dashboard)/jogos/[gameId]/analise/page.tsx` (linha 349), onde o componente é usado sem `label` explícito. Logo, a mudança do padrão afeta apenas essa instância.

5. **Sem nova rota, sem nova página**: a feature reutiliza exclusivamente a rota `/jogos/[gameId]/analise` já existente. Nenhuma rota nova precisa ser criada.

6. **Sem impacto em Realtime**: as subscriptions Realtime existentes (`useGameRealtime`, `useScoreRealtime`, `useParticipantsRealtime`) no `GameCard` da página de análise não são afetadas — elas já estão no componente correto.
