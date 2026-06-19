# Spec: Modal de Resumo Diário

**Slug:** daily-recap-modal
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Exibir automaticamente, no primeiro acesso do dia de cada usuário autenticado, um modal lúdico mostrando o resumo de pontuação do dia anterior — ranking do dia (pontos ganhos nas partidas daquele dia) e badges temáticas para os melhores e piores desempenhos. O modal aparece uma única vez por dia por usuário (controle via `localStorage`), é escopado ao grupo ativo via cookie `bolao_active_group`, e não exibe nada se não houver jogos finalizados no dia anterior (horário de Brasília).

---

## Histórias de Usuário

- Como participante do bolão, quero ver ao abrir o app um resumo lúdico do que aconteceu ontem, para não precisar fuçar ranking e jogos manualmente para saber quem se deu bem ou mal no dia anterior
- Como participante do bolão, quero que o modal apareça apenas uma vez por dia (não toda vez que eu navego), para não ser perturbado na minha sessão depois do primeiro acesso
- Como participante do bolão, quero poder fechar o modal a qualquer momento, para acessar o dashboard normalmente
- Como participante do bolão, quero ver quem foi o Craque do Dia, o Pé-Frio e o Vidente, para ter uma experiência mais divertida acompanhando o bolão

---

## Modelo de Dados

### Nenhuma tabela nova

Esta feature é 100% client-side. Todos os dados são lidos do Supabase (tabelas `scores`, `predictions`, `games`, `profiles`) via queries diretas com o cliente browser. Nenhuma migration é necessária.

### Queries necessárias (client-side, no hook `useDailyRecap`)

**1. Jogos finalizados do dia anterior em BRT:**

```sql
SELECT id, home_team, away_team, home_team_code, away_team_code,
       home_score, away_score, match_date
FROM games
WHERE status = 'finished'
  AND match_date >= '<ontem_BRT_inicio_UTC>'
  AND match_date < '<hoje_BRT_inicio_UTC>'
```

Conversão BRT → UTC: BRT é UTC-3. "Início do dia anterior em BRT" = `ontem_date + 03:00 UTC`. "Início do hoje em BRT" = `hoje_date + 03:00 UTC`. O cálculo é feito em JS com `Date` antes de passar para o filtro:

```typescript
const now = new Date()
// início de hoje em BRT (UTC-3): today 00:00 BRT = today 03:00 UTC
const todayBRT = new Date(now)
todayBRT.setUTCHours(todayBRT.getUTCHours() - (-3)) // não — calcular corretamente:
// BRT = UTC-3, então 00:00 BRT = 03:00 UTC
const todayMidnightBRT = new Date(Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate() + (now.getUTCHours() < 3 ? 0 : 1), // se antes das 03:00 UTC, ainda é "ontem BRT"
  3, 0, 0, 0
))
// simplificado: ajusta ao dia corrente em BRT e monta os limites
```

Implementação simplificada e correta para o hook:

```typescript
function getBRTDayBounds(): { yesterdayStart: string; yesterdayEnd: string } {
  // UTC agora
  const nowUTC = new Date()
  // BRT = UTC-3: subtrair 3h para saber "que hora é agora em BRT"
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  // "Ontem" em BRT
  const yesterdayBRT = new Date(nowBRT)
  yesterdayBRT.setDate(yesterdayBRT.getDate() - 1)
  // Início e fim do dia de ontem em BRT, convertidos de volta para UTC (para a query)
  const ys = new Date(Date.UTC(
    yesterdayBRT.getUTCFullYear(),
    yesterdayBRT.getUTCMonth(),
    yesterdayBRT.getUTCDate(),
    3, 0, 0, 0  // 00:00 BRT = 03:00 UTC
  ))
  const ye = new Date(Date.UTC(
    yesterdayBRT.getUTCFullYear(),
    yesterdayBRT.getUTCMonth(),
    yesterdayBRT.getUTCDate() + 1,
    3, 0, 0, 0  // 00:00 BRT do dia seguinte = 03:00 UTC do dia seguinte
  ))
  return {
    yesterdayStart: ys.toISOString(),
    yesterdayEnd: ye.toISOString(),
  }
}
```

**2. Pontuações do dia anterior (escopadas ao grupo ativo):**

```sql
SELECT s.user_id, s.game_id, s.points, s.breakdown,
       p.name AS participant_name
FROM scores s
JOIN profiles p ON p.id = s.user_id
WHERE s.game_id IN (<ids_jogos_ontem>)
  AND s.group_id = '<group_id>'
```

**3. Palpites do dia anterior (para detectar quem participou e quem acertou placar exato):**

```sql
SELECT pr.user_id, pr.game_id, pr.home_score, pr.away_score
FROM predictions pr
WHERE pr.game_id IN (<ids_jogos_ontem>)
  AND pr.group_id = '<group_id>'
```

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. Toda a lógica é client-side usando o cliente Supabase browser (`createClient()` de `@/lib/supabase/client`).

---

## Frontend — Componentes React

### Hook: `useDailyRecap`

**Arquivo:** `lib/hooks/useDailyRecap.ts`

**Assinatura:**

```typescript
export interface DailyRecapData {
  yesterdayLabel: string          // ex: "18/06/2026"
  games: RecapGame[]              // jogos finalizados ontem
  rankingDay: RankingDayEntry[]   // ranking do dia (pontos ganhos ontem, ordenado decrescente)
  badges: RecapBadge[]            // badges calculados
}

export interface RecapGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}

export interface RankingDayEntry {
  user_id: string
  participant_name: string
  points_yesterday: number        // soma de scores.points para os jogos de ontem
  games_predicted: number         // quantos jogos ontem teve palpite registrado
}

export interface RecapBadge {
  key: string                     // identificador único, ex: 'craque', 'pe_frio', 'vidente', 'artilheiro', 'agiota'
  label: string                   // ex: "CRAQUE DO DIA"
  recipient: string               // nome do participante (ou lista se múltiplos)
  description: string             // mensagem lúdica
}

export function useDailyRecap(groupId: string): {
  data: DailyRecapData | null
  loading: boolean
  hasData: boolean  // false se não houver jogos finalizados ontem — modal não deve abrir
}
```

**Lógica interna:**

1. Calcular `yesterdayStart` e `yesterdayEnd` via `getBRTDayBounds()`
2. Buscar jogos finalizados de ontem no grupo (query 1)
3. Se `games.length === 0` → retornar `{ data: null, loading: false, hasData: false }`
4. Buscar scores e predictions para esses jogos (queries 2 e 3 em paralelo via `Promise.all`)
5. Calcular `rankingDay`: agrupar `scores` por `user_id`, somar `points`, contar `game_id` distintos, ordenar decrescente por `points_yesterday`
6. Calcular badges (ver seção "Regras de Negócio — Badges")
7. Retornar `{ data, loading: false, hasData: true }`

---

### Componente: `DailyRecapModal`

**Arquivo:** `components/bolao/DailyRecapModal.tsx`

**Props:**

```typescript
interface DailyRecapModalProps {
  groupId: string
  currentUserId: string
}
```

**Estados internos:**

- `isOpen: boolean` — controla visibilidade do modal
- dados via `useDailyRecap(groupId)`

**Comportamento:**

1. Ao montar: verificar `localStorage` para a chave `bolao_recap_<YYYY-MM-DD>` (onde a data é a data de hoje em BRT, formatada como `YYYY-MM-DD`). Se a chave já existir com valor `'shown'`, NÃO abrir o modal.
2. Aguardar `loading === false`. Se `hasData === false`, não abrir o modal (e NÃO gravar localStorage — se não houver jogos ontem, o modal pode aparecer amanhã se houver jogos anteontem — na verdade gravar mesmo assim para não repetir checagem).
3. Se `hasData === true` e a chave `localStorage` não existir: abrir o modal (`isOpen = true`) e imediatamente gravar `localStorage.setItem('bolao_recap_<YYYY-MM-DD>', 'shown')`.
4. Fechar modal: ao clicar no botão "FECHAR" ou no backdrop (fora do container do modal). Ao fechar, `isOpen = false`. O localStorage já foi gravado no passo 3, portanto não reaparecerá.

**Chave do localStorage:**

```typescript
function getRecapKey(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = nowBRT.getUTCFullYear()
  const mm = String(nowBRT.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowBRT.getUTCDate()).padStart(2, '0')
  return `bolao_recap_${yyyy}-${mm}-${dd}`
}
```

**Estrutura do modal (JSX/layout):**

```
┌──────────────────────────────────────────────────────────────────┐
│  RESUMO DO DIA — <DATA>                                          │
│  ──────────────────────────────────────────────────────────────  │
│  <MENSAGEM LÚDICA DE ABERTURA>                                   │
│                                                                  │
│  JOGOS DE ONTEM                                                  │
│  <HOME_CODE> <HOME_SCORE> × <AWAY_SCORE> <AWAY_CODE>  (linha)   │
│  ...                                                             │
│                                                                  │
│  RANKING DO DIA                                                  │
│  #   PARTICIPANTE         PTS NO DIA   JOGOS                     │
│  1   NOME_A               12           3                         │
│  2   NOME_B               8            3                         │
│  ...                                                             │
│                                                                  │
│  DESTAQUES                                                       │
│  [CRAQUE DO DIA]   NOME — mensagem                               │
│  [PÉ-FRIO DO DIA]  NOME — mensagem                               │
│  [VIDENTE DO DIA]  NOME — mensagem                               │
│  ...                                                             │
│                                                                  │
│  [   FECHAR   ]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Design detalhado:**

- **Backdrop:** `position: fixed; inset: 0; background: rgba(10,14,26,0.88); z-index: 200` — clicar no backdrop fecha o modal; o container interno deve ter `onClick={(e) => e.stopPropagation()}`
- **Container do modal:** `position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 201; background: var(--color-surface); border: 1px solid var(--color-border); padding: 1.5rem; width: min(90vw, 520px); max-height: 85vh; overflow-y: auto`
- **Sem border-radius; sem box-shadow**
- **Título:** JetBrains Mono, bold, uppercase, `color-accent`, `font-size: 14px`, `letter-spacing: 0.1em`
- **Separadores:** `border-top: 1px solid var(--color-border)`
- **Seção "JOGOS DE ONTEM":** cada jogo em uma linha compacta — `<HOME_CODE> <HOME_SCORE> × <AWAY_SCORE> <AWAY_CODE>` — placar em `color-accent` bold, códigos em `color-muted`, `font-size: 13px`
- **Seção "RANKING DO DIA":** tabela compacta com 3 colunas (#, PARTICIPANTE, PTS NO DIA). O usuário atual destacado em `color-primary`. Líder em `color-accent` com `►` prefixado. `font-size: 13px`
- **Seção "DESTAQUES":** cada badge em bloco separado — label em `color-accent` uppercase, `[LABEL]` simulado com brackets (sem box), nome do recipiente em `color-text`, descrição em `color-muted` italic não disponível em monospace — usar `color-muted` regular
- **Botão FECHAR:** `background: var(--color-primary); color: var(--color-bg); font-family: JetBrains Mono; text-transform: uppercase; padding: 0.5rem 2rem; border: none; cursor: pointer; width: 100%; margin-top: 1rem; font-size: 13px; letter-spacing: 0.1em`

**Mensagens lúdicas de abertura (escolher aleatoriamente uma):**

```
"Ontem foi épico. Veja quem se deu bem (e quem vai apagar o histórico do navegador)."
"Os jogos de ontem já ficaram no passado. Os pontos, não."
"Quem dormiu estudando os palpites... quem não dormiu também está aqui."
"Resultado final do dia anterior. Sem spoiler — a tabela abaixo já é o spoiler."
"Resumo do ontem: alguns palpites brilharam, outros foram criativos."
```

Selecionar com `useMemo(() => MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)], [])` para evitar re-render.

---

### Integração no DashboardLayout

**Arquivo a modificar:** `app/(dashboard)/layout.tsx`

O `DailyRecapModal` deve ser montado dentro do `DashboardLayout`, após o conteúdo principal, mas só quando `activeGroup` existir.

**Adicionar ao final do JSX, após `<GroupChatWidget>` e antes do fechamento do `<div>` raiz:**

```tsx
{activeGroup && (
  <DailyRecapModal
    groupId={activeGroup.id}
    currentUserId={user.id}
  />
)}
```

O `DailyRecapModal` é um Client Component (`'use client'`). O `DashboardLayout` é um Server Component — isso é compatível pois o Server Component passa props serializáveis (strings) para o Client Component.

---

## Regras de Negócio

### Controle de exibição

- **Chave localStorage:** `bolao_recap_<YYYY-MM-DD>` onde a data é "hoje em BRT"
- Se a chave existir → não abrir
- Se não houver jogos finalizados no dia anterior em BRT → não abrir (mas gravar chave para não re-verificar)
- A verificação e abertura ocorrem após o carregamento dos dados (após `loading === false`)
- O modal só é montado no `DashboardLayout` — qualquer rota protegida dispara a verificação; mas como o localStorage é gravado no primeiro acesso, as navegações subsequentes não re-abrem

### Cálculo do "dia anterior em BRT"

BRT = UTC-3. A lógica de `getBRTDayBounds()` deve calcular os limites ISO 8601 em UTC para filtrar `games.match_date`:

- Se agora UTC for 01:00 (= 22:00 BRT do dia anterior), "hoje em BRT" ainda é D-1; "ontem em BRT" é D-2.
- Para evitar esse edge case às 00h-02h59 UTC, usar a lógica de `getBRTDayBounds()` conforme descrito no modelo de dados, que deriva a data BRT subtraindo 3h do UTC antes de calcular o dia.

### Escopo por grupo ativo

Todas as queries usam o `groupId` recebido como prop. O `groupId` vem do cookie `bolao_active_group` resolvido no layout (Server Component) e passado como prop para o modal (Client Component). Não há nova resolução de grupo ativo no modal.

### Badges — Cálculo Client-Side

Todos os badges são calculados a partir dos dados já carregados (`scores`, `predictions`, `games`). Nenhuma query adicional.

#### Badge 1 — CRAQUE DO DIA

**Critério:** usuário(s) com maior `points_yesterday` no `rankingDay`, desde que `points_yesterday > 0`.

**Mensagem:** `"<NOME> dominou o dia com <X> pontos. Respeito."`

Em caso de empate: listar todos os nomes separados por ` e `. Se todos zerados: não exibir badge.

#### Badge 2 — PÉ-FRIO DO DIA

**Critério:** usuário(s) com menor `points_yesterday` entre quem fez **pelo menos um palpite** nos jogos de ontem (ou seja: `games_predicted > 0`), desde que não seja o único participante.

**Mensagem:** `"<NOME> foi generoso: deixou os pontos pra turma."`

Em caso de empate na mínima: listar todos. Se só um participante: não exibir. Se o menor é também o maior (único com palpites): não exibir.

#### Badge 3 — VIDENTE DO DIA

**Critério:** usuário(s) que acertaram pelo menos um **placar exato** nos jogos de ontem. Detectado via `scores.breakdown.exact > 0` (campo `exact` do `ScoreBreakdown`).

**Mensagem:**
- 1 acerto exato: `"<NOME> tem poderes. Acertou o placar exato."`
- 2+ acertos exatos: `"<NOME> está em outro nível. <N> placares exatos ontem."`

Se múltiplos participantes: exibir um sub-badge por participante (ou juntar em um só badge listando todos).

Implementação: ao calcular, contar quantos acertos exatos cada usuário teve:

```typescript
const exactCountByUser = scores.reduce((acc, s) => {
  if (s.breakdown.exact > 0) acc[s.user_id] = (acc[s.user_id] ?? 0) + 1
  return acc
}, {} as Record<string, number>)

const videntes = Object.entries(exactCountByUser)
  .filter(([, count]) => count > 0)
  .map(([userId, count]) => ({ userId, count, name: nameByUserId[userId] }))
  .sort((a, b) => b.count - a.count)
```

#### Badge 4 — ARTILHEIRO DO DIA

**Critério:** usuário(s) com o maior número de acertos de **vencedor** (qualquer nível de pontuação ≥ 3 pts, ou seja: `scores.breakdown.winner > 0`) entre os jogos de ontem. Mínimo de 2 acertos de vencedor para o badge aparecer.

**Mensagem:** `"<NOME> manda no diagnóstico: <N> acertos de resultado."`

Se empate: listar todos. Se nenhum com ≥ 2 acertos: não exibir.

#### Badge 5 — APOSTADOR DO DIA

**Critério:** usuário que fez palpite em **mais jogos** ontem (maior `games_predicted`), com um mínimo de 2 jogos. Serve como reconhecimento de participação ativa.

**Mensagem:** `"<NOME> não perdeu nem um jogo ontem. <N> palpites feitos."`

Se empate: listar todos. Se todos com o mesmo número: não exibir (sem distinção).

---

### Ordem dos badges exibidos

1. CRAQUE DO DIA (se existir)
2. VIDENTE DO DIA (se existir)
3. ARTILHEIRO DO DIA (se existir)
4. APOSTADOR DO DIA (se existir)
5. PÉ-FRIO DO DIA (se existir — exibido por último para não desanimar logo de cara)

---

## Proteção de Rotas

Nenhuma rota nova. O modal é montado dentro do `DashboardLayout` existente, que já protege todas as rotas de dashboard (redireciona para `/login` se não autenticado).

---

## Integração Supabase Realtime

Não aplicável. O modal exibe um snapshot do dia anterior — dados históricos que não mudam. Não há subscription Realtime.

---

## Critérios de Aceite

- [ ] Modal aparece automaticamente no primeiro acesso do dia em qualquer rota do dashboard
- [ ] Modal NÃO reaparece após ser fechado no mesmo dia (verificar via localStorage key `bolao_recap_<YYYY-MM-DD>`)
- [ ] Modal NÃO abre se não houver jogos com `status = 'finished'` cuja `match_date` esteja dentro do intervalo "ontem em BRT"
- [ ] Modal exibe corretamente os jogos finalizados de ontem (placar, código dos times)
- [ ] Ranking do dia exibe pontos ganhos **no dia anterior**, não o total acumulado
- [ ] Usuário atual destacado em `color-primary` no ranking do dia
- [ ] Líder do dia destacado em `color-accent` com `►` no ranking do dia
- [ ] Badge "CRAQUE DO DIA" exibe o participante com mais pontos no dia (ou não exibe se todos zerados)
- [ ] Badge "PÉ-FRIO DO DIA" exibe o participante com menos pontos entre quem fez palpite (não exibe se só 1 participante)
- [ ] Badge "VIDENTE DO DIA" exibe o(s) participante(s) com acerto de placar exato (lendo `breakdown.exact > 0`)
- [ ] Badge "ARTILHEIRO DO DIA" exibe quem acertou mais resultados (mínimo 2 acertos)
- [ ] Badge "APOSTADOR DO DIA" exibe quem fez mais palpites ontem (mínimo 2 jogos, com distinção entre os participantes)
- [ ] Badges não exibidos quando critério não se aplica (sem exibir badge vazio ou com "—")
- [ ] Modal fechado via botão "FECHAR" funciona
- [ ] Modal fechado via clique no backdrop funciona (clicar dentro do modal não fecha)
- [ ] Mensagem de abertura é escolhida aleatoriamente entre as 5 opções
- [ ] Todas as queries são escopadas pelo `groupId` do grupo ativo (cookie `bolao_active_group`)
- [ ] Sem nova tabela, migration ou endpoint backend
- [ ] Design segue DESIGN.md rigorosamente: JetBrains Mono, paleta verde/amarelo/azul, fundo `color-surface`, bordas `color-border`, sem border-radius, sem box-shadow, sem SVG decorativo
- [ ] Funciona em mobile (width ≤ 390px): `width: min(90vw, 520px)`, scroll interno via `max-height: 85vh; overflow-y: auto`
- [ ] `npm run lint` passa sem erros
- [ ] `npm run build` passa sem erros
