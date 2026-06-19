# Spec: Barra Dupla no Rodapé (Rolou ontem / Tá rolando)

**Slug:** dual-footer-bar
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Substituir o `RecapFooterButton` único (botão verde de largura total fixado no rodapé) por um componente `DualFooterBar` que exibe dois botões lado a lado de largura igual: "ROLOU ONTEM" (reabre o `RecapBottomSheet` existente) e "TÁ ROLANDO" (novo `LiveTodayBottomSheet` com ranking ao vivo dos jogos do dia corrente, atualizado via Supabase Realtime). O chip flutuante de chat (`GroupChatWidget`) permanece inalterado em posição, aparência e comportamento.

---

## Histórias de Usuário

- Como participante do bolão, quero ver o botão de resumo de ontem e o botão de ranking ao vivo lado a lado no rodapé, para acessar as duas informações principais com um toque, sem precisar navegar por menus.
- Como participante do bolão, quero que o botão "TÁ ROLANDO" abra um ranking atualizado em tempo real dos pontos do dia, para acompanhar minha posição enquanto os jogos acontecem.
- Como participante do bolão, quero que os botões do rodapé fiquem ocultos quando não há conteúdo relevante (sem jogos ontem, sem jogos hoje), para que a interface não mostre ações vazias.
- Como participante do bolão, quero que o chip de chat continue acessível e posicionado corretamente, independentemente da configuração da barra dupla.

---

## Modelo de Dados

### Sem migrations necessárias

Esta feature não requer nenhuma alteração de schema. Os dados do ranking ao vivo são derivados das tabelas existentes `games`, `predictions` e `scores`, com a lógica de pontuação parcial já existente em `lib/scoring.ts`.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. A feature é 100% client-side:
- Pontuação oficial de jogos `finished`: lida diretamente da tabela `scores` via Supabase client
- Pontuação parcial de jogos `live`: calculada client-side por `calculateLiveScore()` de `lib/scoring.ts`
- Realtime: canal Supabase já habilitado para `scores` e `games`

---

## Frontend — Componentes React

### 1. `useLiveTodayRanking` (hook novo)

**Arquivo:** `lib/hooks/useLiveTodayRanking.ts`

**Assinatura:**
```ts
export interface LiveTodayEntry {
  userId: string
  name: string
  points: number       // soma de pontos oficiais (scores, jogos finished do dia) + parciais (live)
  hasLiveGame: boolean // true se há pelo menos um jogo live hoje com palpite deste usuário
}

export function useLiveTodayRanking(groupId: string): {
  entries: LiveTodayEntry[]
  loading: boolean
  hasGamesToday: boolean // false se não há nenhum jogo hoje (botão deve ficar oculto)
}
```

**Lógica de dados:**

1. **Calcular limites BRT do dia corrente** — usar a mesma técnica de `useDailyRecap.ts` mas para "hoje em BRT":
   ```
   nowUTC = new Date()
   nowBRT = nowUTC - 3h
   todayStart (UTC) = Date.UTC(year, month, day, 3, 0, 0)  // 00:00 BRT = 03:00 UTC
   todayEnd   (UTC) = Date.UTC(year, month, day+1, 3, 0, 0)
   ```
   Ambos como strings ISO 8601 para filtrar `games.match_date`.

2. **Buscar jogos de hoje** — query:
   ```ts
   supabase
     .from('games')
     .select('id, status, home_score, away_score')
     .gte('match_date', todayStart)
     .lt('match_date', todayEnd)
   ```
   Se resultado vazio: `hasGamesToday = false`, `entries = []`, retornar cedo.

3. **Separar jogos por status**:
   - `finishedIds`: jogos com `status === 'finished'`
   - `liveGames`: jogos com `status === 'live'` (manter objeto com `id`, `home_score`, `away_score`)

4. **Buscar membros do grupo** — para obter `userId` + `name` de todos os participantes:
   ```ts
   supabase
     .from('group_members')
     .select('user_id, profiles(name)')
     .eq('group_id', groupId)
   ```

5. **Buscar pontos oficiais** (jogos `finished` de hoje):
   - Se `finishedIds.length > 0`:
     ```ts
     supabase
       .from('scores')
       .select('user_id, points')
       .in('game_id', finishedIds)
       .eq('group_id', groupId)
     ```
   - Agregar: `{ [userId]: totalOfficialPoints }`

6. **Calcular pontos parciais** (jogos `live` de hoje):
   - Se `liveGames.length > 0`:
     ```ts
     supabase
       .from('predictions')
       .select('user_id, game_id, home_score, away_score')
       .in('game_id', liveGames.map(g => g.id))
       .eq('group_id', groupId)
     ```
   - Para cada prediction, chamar `calculateLiveScore(game, prediction)` usando `calculateLiveScore` de `lib/scoring.ts`
   - Agregar: `{ [userId]: totalLivePoints }`

7. **Montar `entries`**:
   - Para cada membro do grupo: `points = (officialPoints[userId] ?? 0) + (livePoints[userId] ?? 0)`
   - `hasLiveGame = userId in livePoints && livePoints[userId] > 0` (alternativamente: se existe prediction deste usuário para algum jogo live de hoje)
   - Ordenar por `points DESC`, empate por `name ASC`
   - Numerar `position` respeitando RANK() (posições iguais para empates, pulo de posição após grupo empatado — mesmo padrão de `applyLivePoints` em `RankingTable.tsx`)

**Supabase Realtime:**

Assinar dois canais independentes:

- Canal `live-today-scores-${groupId}`: evento `*` na tabela `scores`, filtro `group_id=eq.${groupId}` — dispara refetch quando pontuação oficial é calculada (trigger Postgres ao jogo `finished`)
- Canal `live-today-games-${groupId}`: evento `UPDATE` na tabela `games` — dispara recálculo dos pontos parciais quando placar de jogo muda

Ambos com debounce de 1000ms (mesmo padrão de `useRankingRealtime` e `useLivePointsByUser`).

**Cleanup:** `supabase.removeChannel()` para ambos os canais no retorno do `useEffect`.

**Erro de rede:** degradar graciosamente — logar no console, manter último valor calculado, não exibir banner de erro (mesmo padrão de `useLivePointsByUser`).

---

### 2. `LiveTodayBottomSheet` (componente novo)

**Arquivo:** `components/bolao/LiveTodayBottomSheet.tsx`

**Props:**
```ts
interface LiveTodayBottomSheetProps {
  groupId: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}
```

**Estados internos:**
- `visible` / `animating`: controle de animação (mesmo padrão de `RecapBottomSheet`)

**Conteúdo:**

O bottom sheet é um Client Component que instancia `useLiveTodayRanking(groupId)` internamente e exibe:

1. **Handle de arrasto** — barra cinza centralizada no topo (mesmo visual do `RecapBottomSheet`)
2. **Cabeçalho colorido** — `backgroundColor: var(--color-primary)`, título `TÁ ROLANDO` em `color-accent` 15px bold, `letterSpacing: 0.12em`, subtítulo "PONTUAÇÃO DO DIA · AO VIVO" em `rgba(240,244,248,0.7)` 11px uppercase
3. **Tabela de ranking do dia** — colunas: `#` | `PARTICIPANTE` | `PTS`
   - Coluna `#`: posição, 2 chars, `color-muted`
   - Coluna `PARTICIPANTE`: nome em `color-text`; se `rank_position === 1`: `color-accent` bold com prefixo `►`; se `userId === currentUserId` e não líder: `color-primary`
   - Coluna `PTS`: `text-align: right`; se `hasLiveGame && points > 0`: exibir em `color-live` com sufixo `*`; senão `color-text`
   - Legenda abaixo da tabela: se há jogo live, exibir `* PARCIAL — AO VIVO` em `color-muted` 11px
4. **Estado vazio** (jogos hoje mas sem palpites ainda): texto `SEM PALPITES PARA OS JOGOS DE HOJE` em `color-muted`
5. **Estado loading**: texto `CARREGANDO...` em `color-muted`

**Animações:** reutilizar os keyframes `slideUp` e `slideDown` já declarados em `app/globals.css`. Comportamento idêntico ao `RecapBottomSheet`: `visible/animating` controlados por `isOpen`, `queueMicrotask` para `setState` em `useEffect` (mesmo padrão aprovado no lint).

**Backdrop:** semitransparente `rgba(0,0,0,0.7)`, `zIndex: 200`, fecha o sheet ao clicar.

**Z-index do painel:** `zIndex: 201` — idêntico ao `RecapBottomSheet`, pois os dois nunca ficam abertos simultaneamente.

**Botão de fechar (✕):** canto superior direito do cabeçalho, cor `color-muted`, hover `color-accent`.

**Safe-area iOS:** `paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'` no container do painel.

**Trava de scroll:** `document.body.style.overflow = 'hidden'` enquanto aberto, restaurar no cleanup.

---

### 3. `DualFooterBar` (componente novo)

**Arquivo:** `components/bolao/DualFooterBar.tsx`

**Props:**
```ts
interface DualFooterBarProps {
  // Lado "Rolou ontem"
  recapLoading: boolean
  recapHasData: boolean
  onOpenRecap: () => void

  // Lado "Tá rolando"
  todayHasGames: boolean
  onOpenToday: () => void
}
```

**Comportamento de visibilidade:**

A barra inteira é `position: fixed; bottom: 0; left: 0; right: 0; zIndex: 50`.

Cada botão é exibido ou oculto individualmente:
- `recapBtn` visível: `!recapLoading && recapHasData`
- `todayBtn` visível: `todayHasGames`

Cenários possíveis:
- Ambos visíveis: cada botão ocupa exatamente 50% da largura (via `flex: 1`)
- Apenas `recapBtn` visível: ocupa 100% da largura
- Apenas `todayBtn` visível: ocupa 100% da largura
- Nenhum visível: `return null` — barra não renderiza, sem impacto no `padding-bottom` do `<main>`

**Layout interno:**

```
┌─────────────────────────────────────────────────────────┐
│  border-top: 2px solid var(--color-accent)              │
│  background: var(--color-primary)                       │
├──────────────────────┬──────────────────────────────────┤
│  border-right: 1px   │  sem borda direita               │
│  solid color-border  │                                  │
│  ● ROLOU ONTEM       │  ▶ TÁ ROLANDO                    │
│  (50%)               │  (50%)                           │
└──────────────────────┴──────────────────────────────────┘
```

- Contêiner: `display: flex; flexDirection: row`
- Divisor entre botões: `borderRight: '1px solid var(--color-border)'` no `recapBtn` quando ambos estão visíveis
- `padding`: `paddingTop: 0.4rem; paddingBottom: calc(0.4rem + env(safe-area-inset-bottom)); paddingLeft: 1rem; paddingRight: 1rem`
- `maxWidth: 960px; margin: 0 auto` no contêiner interno (igual ao `RecapFooterButton` atual)

**Estilo dos botões:**

Ambos os botões seguem o mesmo padrão visual do `RecapFooterButton` atual:
- `fontFamily: FONT`, `fontSize: 13px`, `fontWeight: bold`, `textTransform: uppercase`, `letterSpacing: 0.1em`
- `color: var(--color-bg)`, `backgroundColor: transparent`, `border: none`, `borderRadius: 0`
- `width: 100%`, `cursor: pointer`, `padding: 0.375rem 1rem`
- Hover: gerenciado por `useState` independente por botão — fundo `#007a2e` no contêiner (idêntico ao hover atual do `RecapFooterButton`)

**Conteúdo textual dos botões:**

- "ROLOU ONTEM": ponto animado (7×7px, `color-accent`, `animation: blink 1s step-end infinite`) + texto `► ROLOU ONTEM`
- "TÁ ROLANDO": ponto animado (7×7px, `color-live`, `animation: blink 1s step-end infinite`) + texto `► TÁ ROLANDO`

**Nota:** O ponto do "TÁ ROLANDO" usa `color-live` (#ff3b30) para indicar atividade ao vivo, enquanto o "ROLOU ONTEM" mantém `color-accent` (amarelo).

---

### 4. `RecapController` (modificado)

**Arquivo:** `components/bolao/RecapController.tsx`

**Mudanças:**
1. Importar `DualFooterBar` e `LiveTodayBottomSheet` em vez de `RecapFooterButton`
2. Adicionar estado `liveTodayOpen: boolean` (inicia `false`)
3. Instanciar `useLiveTodayRanking(groupId)` para obter `{ hasGamesToday }`
4. Substituir `<RecapFooterButton ... />` por `<DualFooterBar ... />`
5. Renderizar `<LiveTodayBottomSheet ... />` condicionalmente junto ao `<RecapBottomSheet />`

**Estrutura do return:**
```tsx
return (
  <>
    <DualFooterBar
      recapLoading={loading}
      recapHasData={hasData}
      onOpenRecap={() => setForceOpen(true)}
      todayHasGames={hasGamesToday}
      onOpenToday={() => setLiveTodayOpen(true)}
    />
    <RecapBottomSheet
      data={data}
      currentUserId={currentUserId}
      isOpen={forceOpen}
      onClose={() => setForceOpen(false)}
    />
    <LiveTodayBottomSheet
      groupId={groupId}
      currentUserId={currentUserId}
      isOpen={liveTodayOpen}
      onClose={() => setLiveTodayOpen(false)}
    />
  </>
)
```

**`--recap-footer-h` CSS custom property:**

A propriedade que informa o `GroupChatWidget` da altura do footer deve refletir se a barra está visível ou não. Atualizar o `useEffect` existente:

```ts
useEffect(() => {
  // A barra é visível se pelo menos um botão está ativo
  const barVisible = (hasData && !loading) || hasGamesToday
  document.documentElement.style.setProperty(
    '--recap-footer-h',
    barVisible ? '60px' : '0px'
  )
  return () => {
    document.documentElement.style.setProperty('--recap-footer-h', '0px')
  }
}, [hasData, loading, hasGamesToday])
```

**`useDailyRecap` permanece inalterado** — o `RecapController` continua consumindo `{ loading, hasData, data }` do hook existente.

---

### 5. `RecapFooterButton` (removido)

**Arquivo:** `components/bolao/RecapFooterButton.tsx`

Este arquivo deve ser **deletado** após confirmar que nenhum outro arquivo o importa além de `RecapController.tsx`. A funcionalidade é absorvida pelo `DualFooterBar`.

---

### 6. `app/(dashboard)/layout.tsx` (verificação — sem alteração esperada)

O layout atual já tem:
```tsx
paddingBottom: activeGroup ? 'calc(4rem + env(safe-area-inset-bottom))' : '1.5rem'
```

Este valor foi calculado para um botão de rodapé de altura ~60px. O `DualFooterBar` tem a mesma altura que o `RecapFooterButton` (mesmos valores de padding), portanto **nenhuma alteração é necessária no layout**.

Contudo, quando a barra está oculta (ambos os botões sem conteúdo), o padding-bottom `4rem` sobra. Isso é aceitável e já era o comportamento atual quando `RecapFooterButton` ficava oculto em um grupo sem jogos ontem. Não alterar.

---

## Regras de Negócio

### Visibilidade dos botões

**Botão "ROLOU ONTEM":**
- Visível quando: `!recapLoading && recapHasData === true`
- `hasData` do hook `useDailyRecap` já resolve corretamente: `true` somente quando há pelo menos um jogo com `status === 'finished'` e `match_date` dentro dos bounds BRT de ontem.
- Não alterar a lógica do hook.

**Botão "TÁ ROLANDO":**
- Visível quando: `hasGamesToday === true`
- `hasGamesToday` é `true` se há pelo menos um jogo com `match_date` dentro dos bounds BRT de hoje (qualquer status: `pending`, `live` ou `finished`)
- Justificativa: exibir o botão mesmo para jogos `pending` do dia é útil para o usuário saber que há jogos hoje, mesmo que ainda sem pontuação. O bottom sheet lidará com o estado "sem pontos ainda" adequadamente.

### Ranking do "Tá rolando"

- **Pontos exibidos** = soma de pontos de `scores` (jogos `finished` de hoje no grupo) + pontuação parcial calculada client-side via `calculateLiveScore` (jogos `live` de hoje)
- **Não inclui** jogos `pending` (sem placar para calcular)
- **Critério de ordenação:** `points DESC`, empate por `name ASC`
- **Numeração de posições:** RANK() — mesmas posições para empates, pulo após grupo empatado
- **Exibição de pontos parciais:** sufixo `*` na coluna PTS quando `hasLiveGame === true` para aquele participante; legenda `* PARCIAL — AO VIVO` ao rodapé da tabela se qualquer entrada tem `hasLiveGame`
- **Estado vazio:** se nenhum jogo do dia tem placar ainda (todos `pending`), exibir mensagem `SEM PONTUAÇÃO DISPONÍVEL — AGUARDANDO INÍCIO DOS JOGOS`

### Independência dos bottom sheets

Os dois bottom sheets (`RecapBottomSheet` e `LiveTodayBottomSheet`) nunca ficam abertos simultaneamente:
- Abrir "TÁ ROLANDO" não fecha "ROLOU ONTEM" automaticamente — o controlador `RecapController` gerencia dois estados independentes (`forceOpen` e `liveTodayOpen`). Na prática, a sobreposição de dois backdrops não ocorrerá porque o usuário fecha um antes de abrir o outro.
- Se necessário, o `DualFooterBar` pode chamar `onClose` do outro ao abrir, mas isso não é obrigatório — a UI é usável sem isso.

### Atualização em tempo real

O `LiveTodayBottomSheet` assina os dados via `useLiveTodayRanking`. A atualização ocorre:
1. Quando um jogo muda para `live` ou tem placar atualizado (canal `games`, evento `UPDATE`)
2. Quando pontuação oficial é inserida/atualizada em `scores` (canal `scores`, evento `*`)

A subscription existe enquanto o `LiveTodayBottomSheet` está montado (mesmo fechado — é montado quando `liveTodayOpen` é inicializado, que acontece no mount do `RecapController`). Alternativa: montar o `LiveTodayBottomSheet` apenas quando `isOpen === true` (lazy mount), economizando subscriptions. Recomenda-se a **montagem sempre** (mesmo padrão do `RecapBottomSheet`) para que o Realtime esteja pronto quando o usuário abre.

Correção: o `useLiveTodayRanking` é instanciado **dentro do `RecapController`**, não dentro do bottom sheet — isso garante que `hasGamesToday` esteja disponível para o `DualFooterBar` independentemente de o bottom sheet estar aberto ou fechado.

---

## Proteção de Rotas

Nenhuma rota nova. O `DualFooterBar` e o `LiveTodayBottomSheet` são renderizados condicionalmente pelo `RecapController`, que já está dentro do bloco `activeGroup &&` do `DashboardLayout` (Server Component protegido por `redirect('/login')` quando não autenticado).

---

## Integração Supabase Realtime

### Canal `live-today-games-${groupId}`

- **Tabela:** `games`
- **Evento:** `UPDATE`
- **Filtro:** sem filtro de coluna (games é global, sem group_id — mesmo padrão de `useLivePointsByUser`)
- **Ação:** debounce 1000ms → refetch de todos os dados do dia (jogos + predictions + scores)

### Canal `live-today-scores-${groupId}`

- **Tabela:** `scores`
- **Evento:** `*` (INSERT e UPDATE — quando trigger Postgres calcula pontuação pós-jogo)
- **Filtro:** `group_id=eq.${groupId}`
- **Ação:** debounce 1000ms → refetch de todos os dados do dia

Ambos os canais dentro de `useLiveTodayRanking`. Cleanup via `supabase.removeChannel()` no retorno do `useEffect`.

---

## Critérios de Aceite

- [ ] `RecapFooterButton.tsx` é deletado; nenhum import restante no repositório
- [ ] `DualFooterBar.tsx` criado em `components/bolao/`; exibe dois botões lado a lado de largura igual quando ambos têm conteúdo
- [ ] Quando apenas "ROLOU ONTEM" tem conteúdo: somente aquele botão aparece, ocupa 100% da largura
- [ ] Quando apenas "TÁ ROLANDO" tem conteúdo: somente aquele botão aparece, ocupa 100% da largura
- [ ] Quando nenhum tem conteúdo: a barra não renderiza (`return null`)
- [ ] Botão "ROLOU ONTEM" abre o `RecapBottomSheet` existente sem regressão de conteúdo ou animação
- [ ] Botão "TÁ ROLANDO" abre o `LiveTodayBottomSheet` com o ranking de pontos do dia
- [ ] Ranking do `LiveTodayBottomSheet` exibe: posição, nome, pontos (oficiais + parciais)
- [ ] Ranking atualiza automaticamente quando há mudança em `games` (placar) ou `scores` (pontuação oficial)
- [ ] Pontos parciais (jogo `live`) exibidos com sufixo `*` e legenda `* PARCIAL — AO VIVO`
- [ ] Líder destacado em `color-accent` bold com prefixo `►`; usuário atual em `color-primary` (amarelo prevalece se for líder)
- [ ] `--recap-footer-h` atualizado corretamente: `60px` se a barra está visível, `0px` se não
- [ ] `GroupChatWidget` não alterado: chip permanece em `zIndex: 51`, posicionamento `right: 1.5rem` inalterado
- [ ] `RecapBottomSheet` não alterado: conteúdo, animação e z-index idênticos ao estado atual
- [ ] Design segue DESIGN.md: JetBrains Mono exclusivo, paleta verde/amarelo/azul/vermelho, `borderRadius: 0`, dense, sem ícones decorativos além de símbolos ASCII e ponto animado
- [ ] Funciona em mobile (375px): dois botões cabem lado a lado sem overflow de texto
- [ ] Safe-area iOS respeitada no `DualFooterBar` e no `LiveTodayBottomSheet`
- [ ] `npm run lint` e `npm run build` passam sem erros novos (os 2 erros pré-existentes em `group-switcher.tsx` e `GroupChatWidget.tsx` não contam)

---

## Arquivos a Criar

| Arquivo | Ação |
|---------|------|
| `components/bolao/DualFooterBar.tsx` | Criar |
| `lib/hooks/useLiveTodayRanking.ts` | Criar |
| `components/bolao/LiveTodayBottomSheet.tsx` | Criar |
| `components/bolao/RecapController.tsx` | Modificar |
| `components/bolao/RecapFooterButton.tsx` | Deletar |

## Arquivos Não Alterados

| Arquivo | Motivo |
|---------|--------|
| `app/(dashboard)/layout.tsx` | `RecapController` mantém a mesma interface de renderização no layout |
| `components/bolao/RecapBottomSheet.tsx` | Sem alteração — absorvido sem modificação |
| `components/bolao/GroupChatWidget.tsx` | Sem alteração — chip permanece inalterado |
| `lib/hooks/useDailyRecap.ts` | Sem alteração — consumido pelo `RecapController` sem mudanças na assinatura |
| `lib/scoring.ts` | Sem alteração — `calculateLiveScore` reutilizado diretamente |
| `app/globals.css` | Sem alteração — keyframes `slideUp`, `slideDown` e `blink` já existem |
