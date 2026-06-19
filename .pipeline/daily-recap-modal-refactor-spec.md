# Spec: Refatoração do Daily Recap Modal — Bottom Sheet + Revisão de Badges

**Slug:** daily-recap-modal-refactor
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Reposicionar o acesso ao resumo do dia anterior: remover o `RecapButton` embutido no menu de navegação superior (`nav-links.tsx`) e substituí-lo por um elemento fixo no canto inferior esquerdo da tela, visível em todas as páginas do dashboard enquanto houver jogos finalizados no dia anterior.

Ao mesmo tempo, revisar os badges exibidos no `DailyRecapModal` para reduzir de 5 para exatamente 3: **Craque do Dia**, **Mãe Diná** (fusão de Vidente do Dia e dados de artilharia de palpites) e **Pé-frio** (renomeado de "Pé-frio do Dia"). Os badges "Artilheiro do Dia" e "Apostador do Dia" são removidos.

---

## Histórias de Usuário

- Como participante do bolão, quero acessar o resumo do dia anterior por um botão sempre visível no rodapé da tela, para não precisar procurá-lo no menu de navegação superlotado.
- Como participante, quero ver exatamente 3 badges no resumo — Craque, Mãe Diná e Pé-frio — para ter um resumo conciso e sem redundâncias.
- Como participante, quero que o badge Mãe Diná me mostre tanto quem acertou mais placares exatos quanto quem apostou mais gols totais, para ter uma visão completa dos "videntes" do dia.
- Como participante, quero que o botão de resumo desapareça automaticamente quando não há jogos finalizados no dia anterior, para não ver um botão inútil.

---

## Modelo de Dados

Nenhuma alteração de banco de dados é necessária. Toda a lógica é computada no frontend a partir das tabelas `games`, `scores` e `predictions` já existentes.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. A feature é puramente frontend.

---

## Frontend — Componentes React

### RecapFloatingButton

**Arquivo:** `components/bolao/RecapFloatingButton.tsx`

**Descrição:** Novo componente client-side que substitui o `RecapButton` dentro do nav. Exibe um chip fixo no canto inferior esquerdo da tela. Ao clicar, abre o `DailyRecapModal` com `forceOpen=true`.

**Props:**
```typescript
interface RecapFloatingButtonProps {
  groupId: string
  currentUserId: string
}
```

**Estados:**
- `loading`: enquanto `useDailyRecap` carrega — não renderiza nada (`return null`)
- `sem dados` (`!hasData`): não renderiza nada (`return null`)
- `com dados`: exibe o chip fixo no bottom-left

**Comportamento:**
- Usa o hook `useDailyRecap(groupId)` para verificar disponibilidade de dados.
- Enquanto `loading` ou `!hasData`, retorna `null` — sem renderização.
- Quando dados disponíveis, renderiza um chip fixo com texto `RESUMO DE ONTEM`.
- Ao clicar, define `recapOpen = true`, passando `forceOpen` para `DailyRecapModal`.
- Ao fechar o modal (`onClose`), define `recapOpen = false`.
- Renderiza o `DailyRecapModal` internamente com `forceOpen={recapOpen}`.

**Posicionamento:** `position: fixed`, `bottom: 1.5rem`, `left: 1.5rem`, `zIndex: 50`.
- Este posicionamento evita colisão com o `GroupChatWidget`, que ocupa `bottom: 1.5rem`, `right: 1.5rem`.

**Estilo (seguindo DESIGN.md):**
```
┌────────────────────────┐
│  ► RESUMO DE ONTEM     │
└────────────────────────┘
```
- Fonte: `JetBrains Mono`, 11px, uppercase, `letter-spacing: 0.05em`
- Cor do texto: `var(--color-muted)` em repouso; `var(--color-accent)` no hover
- Background: `var(--color-surface)`
- Borda: `1px solid var(--color-border)` em repouso; `1px solid var(--color-accent)` no hover
- Padding: `0.5rem 0.75rem`
- `border-radius: 0` (sem arredondamento — padrão DESIGN.md)
- Sem sombras (`box-shadow: none`)
- Cursor: `pointer`
- Transition: `color 0.15s ease, border-color 0.15s ease`

### Alterações em nav-links.tsx

**Arquivo:** `app/(dashboard)/nav-links.tsx`

**Mudanças:**
1. Remover o import de `RecapButton`.
2. Remover a linha `<RecapButton groupId={groupId} currentUserId={currentUserId} />` do JSX.
3. Remover as props `groupId` e `currentUserId` da interface `NavLinksProps` — se não forem usadas por nenhum outro elemento após a remoção.

**Atenção:** Verificar se `groupId` e `currentUserId` são usados por outros elementos em `nav-links.tsx` além do `RecapButton`. Se não forem, remover da interface e da assinatura da função. Se o componente pai (`layout.tsx`) ainda passar essas props, ajustar lá também.

### Alterações em layout.tsx

**Arquivo:** `app/(dashboard)/layout.tsx`

**Mudanças:**
1. Adicionar import: `import { RecapFloatingButton } from '@/components/bolao/RecapFloatingButton'`
2. Após o bloco do `GroupChatWidget`, adicionar:
```tsx
{activeGroup && (
  <RecapFloatingButton
    groupId={activeGroup.id}
    currentUserId={user.id}
  />
)}
```
3. O `DailyRecapModal` já presente no layout (abertura automática) deve ser **mantido** — ele continua responsável pela exibição automática ao carregar a página (lógica de `localStorage`). O `RecapFloatingButton` é responsável apenas pela abertura sob demanda.
4. Se `NavLinks` não precisar mais de `groupId` e `currentUserId`, ajustar a chamada em layout.tsx.

### Alterações em useDailyRecap.ts

**Arquivo:** `lib/hooks/useDailyRecap.ts`

**Mudanças na função `calcBadges`:**

#### Badge 1 — CRAQUE DO DIA (sem mudança)
Mantém a lógica atual: quem mais pontuou nos jogos do dia anterior.

#### Badge 2 — MAE DINA (substitui VIDENTE DO DIA + remove ARTILHEIRO DO DIA)

**Label:** `MAE DINA` (sem acento — uppercase, monospace)

**Critério primário — acertos de placar exato:**
- Identifica quem teve `breakdown.exact > 0`, conta por usuário.
- Ordena decrescente por quantidade de acertos exatos.
- O "vidente" é quem liderou em placares exatos.

**Critério secundário — artilharia de palpites (novidade):**
- Para cada score, soma `home_score + away_score` do palpite original.
- **Problema:** o hook atual não carrega os scores de palpite (home_score/away_score da tabela `predictions`), apenas os scores calculados.
- **Solução:** o hook já busca `predictions` do Supabase para montar o ranking. Expandir a query de predictions para incluir `home_score, away_score` além de `user_id, game_id`.
- Calcular `total_goals_predicted` por usuário: somar `home_score + away_score` de cada prediction do dia.
- Ordenar decrescente — o maior apostador de gols é o "artilheiro de palpites".

**Montagem do badge Mãe Diná:**
- `recipient`: nome(s) do líder em acertos exatos (como o Vidente atual).
- `description`: duas linhas de informação:
  1. Dado de acertos: ex. `"${nome} acertou ${N} placar(es) exato(s). Poderes sobrenaturais."`
  2. Dado de artilharia: ex. `"Artilharia dos palpites: ${nomeArtilheiro} apostou ${totalGols} gols no total."`
- Se não houver nenhum acerto exato no dia (ninguém acertou placar), o badge Mãe Diná deve ser emitido mesmo assim, com base só na artilharia: `recipient` = nome do maior apostador de gols, `description` = `"Ninguém acertou o placar exato. Mas ${nome} apostou alto: ${totalGols} gols no total."`
- Se não houver predictions com dados de score (edge case), omitir o badge.

**Assinatura alterada de `calcBadges`:**
```typescript
interface RawPredictionWithScore {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

function calcBadges(
  rankingDay: RankingDayEntry[],
  scores: RawScore[],
  predictions: RawPredictionWithScore[]
): RecapBadge[]
```

#### Badge 3 — PE-FRIO (renomeado de "PÉ-FRIO DO DIA")

**Label:** `PE-FRIO` (sem acento — uppercase, monospace)

Lógica idêntica ao badge atual `pe_frio`, apenas o label muda de `'PÉ-FRIO DO DIA'` para `'PE-FRIO'`.

#### Badges removidos:
- `artilheiro` — remover completamente da função `calcBadges`.
- `apostador` — remover completamente da função `calcBadges`.

**Alteração na query de predictions:**

No hook `useDailyRecap`, a query atual busca:
```typescript
supabase
  .from('predictions')
  .select('user_id, game_id')
  .in('game_id', gameIds)
  .eq('group_id', groupId)
```

Deve passar a buscar:
```typescript
supabase
  .from('predictions')
  .select('user_id, game_id, home_score, away_score')
  .in('game_id', gameIds)
  .eq('group_id', groupId)
```

O tipo `RawPrediction` deve ser atualizado para incluir `home_score: number` e `away_score: number`.

A variável `predictions` local deve ser atualizada para mapear os campos adicionais.

A chamada `calcBadges(rankingDay, scoresRaw)` deve passar a ser `calcBadges(rankingDay, scoresRaw, predictions)`.

### DailyRecapModal.tsx

**Arquivo:** `components/bolao/DailyRecapModal.tsx`

**Mudanças:**
- Nenhuma mudança estrutural. O modal já renderiza badges de forma genérica via `data.badges.map(...)`.
- Com o hook retornando exatamente 3 badges (Craque do Dia, Mãe Diná, Pé-frio), o modal exibirá exatamente esses 3 automaticamente.
- Verificar se os estilos existentes suportam a descrição em dois parágrafos da Mãe Diná. A `description` pode conter `\n` — o estilo atual usa um único `<div>` com `style={S.badgeDesc}`. Se necessário, renderizar a descrição com `white-space: pre-line` ou quebrar em dois `<div>` separados se o badge for `key === 'mae_dina'`.

**Sugestão de renderização condicional para Mãe Diná:**
```tsx
{badge.key === 'mae_dina' && badge.secondaryDescription ? (
  <>
    <div style={S.badgeDesc}>{badge.description}</div>
    <div style={{ ...S.badgeDesc, marginTop: '0.15rem' }}>{badge.secondaryDescription}</div>
  </>
) : (
  <div style={S.badgeDesc}>{badge.description}</div>
)}
```

Isso requer adicionar `secondaryDescription?: string` ao tipo `RecapBadge` em `useDailyRecap.ts`.

---

## Regras de Negócio

### Visibilidade do RecapFloatingButton
- O botão só é exibido se `useDailyRecap(groupId).hasData === true`.
- `hasData` é `true` apenas quando há ao menos 1 jogo com `status = 'finished'` no dia anterior em BRT.
- A lógica de "dia anterior em BRT" já está implementada em `getBRTDayBounds()` — não alterar.

### Coexistência com abertura automática
- O `DailyRecapModal` no `layout.tsx` continua com sua lógica de abertura automática (verifica `localStorage` uma vez por dia).
- O `RecapFloatingButton` usa `forceOpen` para abrir o modal sob demanda, ignorando o `localStorage`.
- Ambos passam `groupId` e `currentUserId` para o modal, que é o mesmo componente `DailyRecapModal`.
- **Conflito potencial:** se o layout já instancia `DailyRecapModal` e o `RecapFloatingButton` também instancia `DailyRecapModal`, haverá duas instâncias montadas simultaneamente. Para evitar isso, o `RecapFloatingButton` **não** deve instanciar seu próprio `DailyRecapModal`. Em vez disso, a abertura sob demanda deve ser controlada por estado no `layout.tsx`.

**Arquitetura recomendada para evitar dupla instância:**

No `layout.tsx` (server component), não é possível ter estado. A solução é extrair a lógica de "recap aberto sob demanda" para um componente client wrapper no layout:

**Arquivo novo:** `components/bolao/RecapController.tsx`
```typescript
'use client'

interface RecapControllerProps {
  groupId: string
  currentUserId: string
}
```

Este componente client:
1. Detém o estado `forceOpen: boolean`.
2. Renderiza `<RecapFloatingButton>` que ao clicar chama `setForceOpen(true)`.
3. Renderiza `<DailyRecapModal forceOpen={forceOpen} onClose={() => setForceOpen(false)} ...>`.

No `layout.tsx`, substituir as duas instâncias separadas:
```tsx
// ANTES
<GroupChatWidget ... />
<DailyRecapModal groupId={...} currentUserId={...} />
// + NavLinks com RecapButton

// DEPOIS
<GroupChatWidget ... />
<RecapController groupId={activeGroup.id} currentUserId={user.id} />
```

O `RecapController` engloba tanto o botão flutuante quanto o modal, eliminando a necessidade de dois componentes separados montando `DailyRecapModal`.

**Prop `forceOpen` do DailyRecapModal:** o `RecapController` gerencia o estado `forceOpen`. O modal já suporta abertura automática (via `useEffect` interno com localStorage) e abertura sob demanda (via `forceOpen`). Ambas as lógicas convivem no mesmo componente.

### Cálculo da artilharia de palpites (Mãe Diná)
```
totalGoalsByUser[userId] = sum(prediction.home_score + prediction.away_score)
  for each prediction where prediction.game_id in gameIds
  and prediction.user_id === userId
```

Ordenar decrescente — quem tem maior soma é o "artilheiro dos palpites".

Em caso de empate na artilharia, exibir todos os empatados: `"${nome1} e ${nome2} apostaram ${totalGols} gols no total."`.

### Label dos badges (exatos, sem acentos por ser uppercase monospace)
- `'CRAQUE DO DIA'` — mantido
- `'MAE DINA'` — novo (não `'MÃE DINÁ'` — monospace uppercase sem acento é padrão do projeto conforme DESIGN.md)
- `'PE-FRIO'` — novo (não `'PÉ-FRIO DO DIA'`)

### Keys dos badges
- `'craque'` — mantido
- `'mae_dina'` — novo (era `'vidente'`)
- `'pe_frio'` — mantido

---

## Proteção de Rotas

Nenhuma mudança. Toda a feature opera dentro do dashboard já protegido pelo `layout.tsx` que verifica sessão.

---

## Integração Supabase Realtime

Nenhuma alteração. O `useDailyRecap` é um fetch único sem assinatura realtime — mantém-se assim.

---

## Critérios de Aceite

- [ ] `RecapButton` removido de `nav-links.tsx` — sem import, sem uso no JSX
- [ ] `NavLinks` não recebe `groupId` nem `currentUserId` se não houver mais uso (ou ajustar conforme análise)
- [ ] `RecapController` criado em `components/bolao/RecapController.tsx` gerenciando estado `forceOpen`
- [ ] `RecapFloatingButton` exibido em `position: fixed`, `bottom: 1.5rem`, `left: 1.5rem` — canto inferior esquerdo
- [ ] `RecapFloatingButton` retorna `null` quando `loading || !hasData`
- [ ] `RecapFloatingButton` abre o `DailyRecapModal` ao clicar (via estado no `RecapController`)
- [ ] Apenas 1 instância de `DailyRecapModal` montada no layout — via `RecapController`
- [ ] Modal exibe exatamente 3 badges: Craque do Dia, Mãe Diná, Pé-frio
- [ ] Badge Mãe Diná mostra dado de acertos exatos E dado de artilharia de palpites
- [ ] Badge Mãe Diná é exibido mesmo quando ninguém acerta placar exato (fallback só artilharia)
- [ ] Badges "Artilheiro do Dia" e "Apostador do Dia" não existem mais em nenhuma circunstância
- [ ] Badge "Pé-frio do Dia" renomeado para "PE-FRIO" (label uppercase sem acento)
- [ ] Badge "Vidente do Dia" renomeado para "MAE DINA" (label uppercase sem acento)
- [ ] Query de `predictions` agora inclui `home_score` e `away_score`
- [ ] Tipo `RawPrediction` atualizado para incluir `home_score: number` e `away_score: number`
- [ ] Tipo `RecapBadge` contém campo opcional `secondaryDescription?: string`
- [ ] `DailyRecapModal` renderiza `secondaryDescription` quando presente (badge mae_dina)
- [ ] Layout não quebra em mobile (coluna única) — botão flutuante não conflita com ChatWidget
- [ ] Botão flutuante segue DESIGN.md: JetBrains Mono, uppercase, sem border-radius, paleta verde/amarelo, sem sombra
- [ ] Abertura automática (localStorage) continua funcionando independentemente do botão flutuante
