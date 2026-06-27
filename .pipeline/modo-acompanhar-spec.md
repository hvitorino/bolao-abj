# Spec: Modo Acompanhar

**Slug:** modo-acompanhar
**Data:** 2026-06-27
**Status:** spec

---

## Objetivo

Adicionar na tela `/palpites` um segundo modo de visualização — "Modo Acompanhar" — que substitui o layout atual por um carrossel horizontal de mini-cards de placares + ranking simplificado do dia. O modo padrão continua sendo "Modo Preencher" (layout atual inalterado). O usuário alterna entre os dois modos com um botão toggle.

---

## Histórias de Usuário

- Como participante do bolão, quero ver o placar de todos os jogos do dia num carrossel compacto para consumir rapidamente sem rolar muito a tela.
- Como participante do bolão, quero ver quantos pontos cada participante somou no dia para acompanhar quem está ganhando no dia.
- Como participante do bolão, quero voltar ao modo de preenchimento de palpites com um toque, sem perder o contexto da data selecionada.
- Como participante do bolão, quero que o modo que escolhi seja mantido quando troco de data, mas que seja resetado quando troco de grupo.

---

## Modelo de Dados

### Sem alterações no banco de dados

Toda informação necessária já está disponível via:
- `games`: jogos do dia com `status`, `home_score`, `away_score`, `match_date`
- `predictions`: palpites do usuário por jogo
- `scores`: pontuação calculada por usuário por jogo (já populada pelo trigger Postgres)
- `group_members` + `profiles`: participantes do grupo

O campo `minute_elapsed` (minuto atual de jogos ao vivo) **não existe na tabela `games`** atualmente. O mini-card de "Ao Vivo" deve omitir o minuto e exibir apenas o label "AO VIVO". Nenhuma migration é necessária.

---

## Frontend — Componentes React

### Mudanças em `palpites-live-section.tsx`

**Arquivo:** `app/(dashboard)/palpites/palpites-live-section.tsx`

#### Novo estado local

```typescript
const [viewMode, setViewMode] = useState<'preencher' | 'acompanhar'>(() => {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('palpites_mode')
    return saved === 'acompanhar' ? 'acompanhar' : 'preencher'
  }
  return 'preencher'
})
```

#### Persistência e reset

```typescript
// Persiste o modo no sessionStorage quando muda
useEffect(() => {
  sessionStorage.setItem('palpites_mode', viewMode)
}, [viewMode])

// Reseta para Preencher quando o grupo ativo muda
const prevGroupId = useRef(groupId)
useEffect(() => {
  if (prevGroupId.current !== groupId) {
    prevGroupId.current = groupId
    setViewMode('preencher')
    sessionStorage.removeItem('palpites_mode')
  }
}, [groupId])
```

#### Substituição do botão "Copiar link do dia"

A linha atual:
```jsx
<button onClick={handleCopyLink}>⎘ COPIAR LINK DO DIA</button>
```

É substituída por uma linha com dois botões lado a lado:

```jsx
<div style={{ display: 'flex', gap: '8px' }}>
  <AcompanharToggle
    isActive={viewMode === 'acompanhar'}
    onToggle={() => setViewMode(v => v === 'acompanhar' ? 'preencher' : 'acompanhar')}
  />
  <CompartilharButton groupId={groupId} selectedDate={selectedDate} />
</div>
```

#### Renderização condicional do conteúdo

No modo Preencher, o conteúdo abaixo do sticky continua sendo `<PalpitesRanking />` (inalterado). O `PalpitesLiveCard` permanece no sticky header em ambos os modos (ele é o strip de mini-cards de navegação/análise).

No modo Acompanhar, o `PalpitesLiveCard` do sticky é **ocultado** (já que o carrossel substitui essa visualização) e o conteúdo principal muda:

```jsx
{/* No sticky header */}
{viewMode === 'preencher' && (
  <PalpitesLiveCard todayGames={todayGames} loading={loading} onGameClick={setSelectedGameId} />
)}

{/* Fora do sticky */}
{viewMode === 'preencher' ? (
  <PalpitesRanking
    currentUserId={currentUserId}
    rankingWithDetails={rankingWithDetails}
    todayGames={todayGames}
    loading={loading}
    error={error}
  />
) : (
  <>
    <AcompanharCarrossel
      todayGames={todayGames}
      currentUserGameScores={rankingWithDetails.find(p => p.userId === currentUserId)?.games ?? []}
      loading={loading}
    />
    <AcompanharRanking
      rankingWithDetails={rankingWithDetails}
      currentUserId={currentUserId}
      loading={loading}
    />
  </>
)}
```

O `GameAnaliseDrawer` e o estado `selectedGameId` permanecem inalterados — só são ativados no Modo Preencher (onde `PalpitesLiveCard` com `onGameClick` está visível).

---

### Novo componente: `AcompanharToggle`

**Arquivo:** `components/bolao/AcompanharToggle.tsx`

**Props:**
```typescript
interface AcompanharToggleProps {
  isActive: boolean
  onToggle: () => void
}
```

**Estados visuais:**

| isActive | background | border | color | label |
|---|---|---|---|---|
| false | `transparent` | `1px solid var(--color-primary)` | `var(--color-primary)` | `◉ ACOMPANHAR` |
| true | `var(--color-primary)` | `1px solid var(--color-primary)` | `var(--color-bg)` | `● ACOMPANHANDO` |

- Ocupa `flex: 1` (50% da linha)
- `padding: '0.4rem 0.75rem'`
- Fonte JetBrains Mono, 10px, uppercase, letter-spacing 0.08em
- `cursor: 'pointer'`
- Transição de cor instantânea (sem `transition`)
- Sem estado "ativo/pressionado" persistente além do `isActive` prop

---

### Novo componente: `CompartilharButton`

**Arquivo:** `components/bolao/CompartilharButton.tsx`

**Props:**
```typescript
interface CompartilharButtonProps {
  groupId: string
  selectedDate: string
}
```

**Comportamento:**
- Copia `${window.location.origin}/publico/${groupId}/${selectedDate}` para a área de transferência
- Estado visual temporário de feedback: após cópia bem-sucedida, altera label para `✓ COPIADO!` em `var(--color-win)` por 2s
- **Nunca tem estado "ativo"** — é uma ação, não um toggle
- Estilo sempre neutro: `background: 'transparent'`, `border: '1px solid var(--color-border)'`, `color: 'var(--color-muted)'`
- Ocupa `flex: 1` (50% da linha)
- Mesmas dimensões/fonte que `AcompanharToggle`
- Label padrão: `⎘ COMPARTILHAR`
- Label após cópia: `✓ COPIADO!`

---

### Novo componente: `AcompanharCarrossel`

**Arquivo:** `components/bolao/AcompanharCarrossel.tsx`

**Props:**
```typescript
interface AcompanharCarrosselProps {
  todayGames: LiveGameWithPrediction[]           // de usePalpitesAoVivo
  currentUserGameScores: GameScoreEntry[]        // de rankingWithDetails.find(userId)?.games
  loading: boolean
}
```

**Layout:**
```css
.acompanhar-carrossel {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;            /* Firefox */
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 0;
}
.acompanhar-carrossel::-webkit-scrollbar { display: none; } /* Webkit — via className em globals.css */
```

Adicionar no `app/globals.css`:
```css
.acompanhar-carrossel::-webkit-scrollbar {
  display: none;
}
```

**Comportamento de overflow:** `overflow-x: auto` já garante que, quando os cards cabem sem scroll, não há arraste nem espaço vazio. Nenhuma lógica JS adicional é necessária.

**Mini-card — estrutura visual:**

Cada mini-card exibe de cima para baixo (empilhado, `flexDirection: 'column'`, `alignItems: 'center'`):
1. Horário do jogo (formatar em BRT, ex: `18:00`)
2. Linha de placar: `[bandeira] [placar] [bandeira]`
3. Label de status (ver tabela abaixo)

**Dimensões do mini-card:**
- `width: 'auto'`, `flexShrink: 0`
- `minWidth: '80px'`
- `padding: '0.4rem 0.6rem'`
- `border: '1px solid var(--color-border)'`
- `backgroundColor: 'var(--color-surface)'`
- Sem cursor pointer (não clicável)

**4 estados do mini-card:**

Determinar o estado com a seguinte lógica (em ordem de prioridade):

```typescript
type MiniCardState = 'em-breve' | 'ao-vivo' | 'pontuado' | 'final'

function getMiniCardState(
  game: LiveGameWithPrediction,
  userScore: GameScoreEntry | undefined
): MiniCardState {
  if (game.status === 'live') return 'ao-vivo'
  if (game.status === 'finished') {
    // "Pontuado": jogo encerrado E score oficial já calculado (pode ser 0)
    if (userScore?.officialPoints !== null && userScore?.officialPoints !== undefined) {
      return 'pontuado'
    }
    return 'final'
  }
  return 'em-breve'
}
```

| Estado | `status` | Placar | Cor do placar | Border do card | Label |
|---|---|---|---|---|---|
| `em-breve` | `pending` | `×` (sem números) | `var(--color-muted)` | `var(--color-border)` | `EM BREVE` em muted |
| `ao-vivo` | `live` | `N×N` (ou `0×0` se null) | `var(--color-accent)` | `2px solid var(--color-live)` | `● AO VIVO` em `var(--color-live)` |
| `final` | `finished` sem score | `N×N` | `var(--color-muted)` | `var(--color-border)` | `FINAL` em muted |
| `pontuado` | `finished` com score | `N×N` | `var(--color-accent)` | `var(--color-border)` | `+N PTS` em `var(--color-win)` se >0, `+0` em muted se 0 |

**Estado loading:** exibir placeholder com 3 mini-cards de largura fixa (80px) com cor muted, sem texto.

**Estado vazio (todayGames.length === 0 após load):** renderizar nada (nulo) — o DateChipsNav já exibe "0 JOGOS".

---

### Novo componente: `AcompanharRanking`

**Arquivo:** `components/bolao/AcompanharRanking.tsx`

**Props:**
```typescript
interface AcompanharRankingProps {
  rankingWithDetails: RankingParticipantDetail[]
  currentUserId: string
  loading: boolean
}
```

**Descrição:** Lista simples ordenada por pontuação do dia. Usa os mesmos dados de `rankingWithDetails` que `PalpitesRanking`, mas sem accordion, sem animação FLIP, sem breakdown de jogo. É uma tabela estática.

**Estrutura visual:**

```
┌──────────────────────────────────┐
│ RANKING DO DIA                   │
├────┬──────────────────────┬──────┤
│ #  │ PARTICIPANTE         │ PTS  │
├────┼──────────────────────┼──────┤
│  1 │ ► RODRIGO            │  12  │  ← líder: ► em color-accent
│  1 │   MARINA             │  12  │  ← empate: mesma posição
│  3 │ ■ VOCÊ               │   9  │  ← usuário atual: ■ em color-primary, linha com bg rgba(0,151,59,0.08)
│  4 │   PAULO              │   5  │
└────┴──────────────────────┴──────┘
```

**Regras:**
- Posição calculada como em `usePalpitesAoVivo` — participantes com mesma pontuação compartilham a mesma posição numérica
- `► ` antes do nome se `rank_position === 1 && total_points > 0` (cor: `var(--color-accent)`)
- `■ ` antes do nome se `userId === currentUserId && !isLeader` (cor: `var(--color-primary)`)
- Linha com `backgroundColor: 'rgba(0,151,59,0.08)'` para o usuário atual
- Pontuação em `var(--color-accent)`, negrito
- Se `hasLivePoints`, adicionar `*` em `var(--color-live)` após o número de pontos

**Estado loading:** renderizar esqueleto com 3 linhas de texto muted ("─── ──────── ──")
**Estado vazio:** exibir "NENHUM PARTICIPANTE" em muted, centralizado

---

## Regras de Negócio

### Persistência do modo

1. Ao montar, ler `sessionStorage.getItem('palpites_mode')` para restaurar o modo anterior
2. Ao alternar modo, salvar em `sessionStorage`
3. Ao detectar mudança de `groupId` (via `useRef` comparando valor anterior), resetar para `preencher` e remover do `sessionStorage`

### Carrossel — comportamento de scroll

- Usar `overflow-x: auto` + `scrollbar-width: none` (Firefox) + classe CSS para webkit
- **Não** usar `overflow-x: scroll` (forçaria scrollbar mesmo sem conteúdo suficiente)
- Com `overflow-x: auto`, quando o conteúdo cabe na tela, não há comportamento de arraste — satisfeito nativamente pelo CSS

### Estado "Pontuado" dos mini-cards

- Verificar `officialPoints !== null && officialPoints !== undefined` (não apenas `> 0`), pois jogos sem palpite têm `officialPoints: null` e jogos com palpite que resultaram em 0 pts têm `officialPoints: 0`
- Exibir `+0` em `var(--color-muted)` para pontuação zero (não esconder o resultado)
- Exibir `+N PTS` em `var(--color-win)` para pontuação positiva

### Toggle buttons — largura

- Linha com `display: 'flex'`, `gap: '8px'`
- Cada botão: `flex: 1` (50% - gap/2 cada)

---

## Proteção de Rotas

Sem alterações — `palpites/page.tsx` já redireciona para `/login` se não autenticado.

---

## Integração Supabase Realtime

Sem alterações — o polling de `usePalpitesAoVivo` (10s) já atualiza `todayGames` e `rankingWithDetails`. Ambos os modos consomem os mesmos dados reativos.

---

## Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `components/bolao/AcompanharToggle.tsx` | Botão toggle Preencher/Acompanhar |
| `components/bolao/CompartilharButton.tsx` | Botão de copiar link (extrai lógica existente) |
| `components/bolao/AcompanharCarrossel.tsx` | Carrossel horizontal de mini-cards |
| `components/bolao/AcompanharRanking.tsx` | Ranking simplificado do dia |

## Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `app/(dashboard)/palpites/palpites-live-section.tsx` | Estado de modo, renderização condicional, nova linha de botões |
| `app/globals.css` | Adicionar regra `.acompanhar-carrossel::-webkit-scrollbar { display: none }` |

## Arquivos sem alteração

- `lib/hooks/usePalpitesAoVivo.ts` — nenhuma mudança (dados já suficientes)
- `components/bolao/PalpitesLiveCard.tsx` — permanece inalterado (Modo Preencher)
- `components/bolao/PalpitesRanking.tsx` — permanece inalterado (Modo Preencher)
- `components/bolao/GameAnaliseDrawer.tsx` — permanece inalterado
- `components/games/DateChipsNav.tsx` — permanece inalterado
- `app/(dashboard)/palpites/page.tsx` — permanece inalterado

---

## Critérios de Aceite

- [ ] Botão ACOMPANHAR alterna corretamente entre os dois modos sem reload da tela
- [ ] Estado visual do botão (outline vs preenchido com texto "ACOMPANHANDO") reflete corretamente o modo ativo
- [ ] Botão COMPARTILHAR copia o link do dia e exibe feedback "✓ COPIADO!", independente do modo ativo, e nunca fica "ativo"
- [ ] No modo Acompanhar, carrossel nunca exibe barra de scroll visível em nenhum navegador/dispositivo
- [ ] Carrossel permite arrastar horizontalmente via touch/drag quando o conteúdo excede a largura da tela
- [ ] Quando os jogos do dia cabem sem overflow, carrossel não exibe comportamento de arraste nem espaço vazio
- [ ] Estado "EM BREVE" exibe placar como `×` em cinza e label "EM BREVE"
- [ ] Estado "AO VIVO" exibe borda em `var(--color-live)` e label "● AO VIVO"
- [ ] Estado "FINAL" exibe placar final sem indicador de pontos
- [ ] Estado "PONTUADO" exibe placar final e label `+N PTS` em cor correta (`var(--color-win)` se >0, muted se 0)
- [ ] Ranking do dia exibe apenas pontuação dos jogos da data selecionada (dado de `rankingWithDetails` já filtrado por `usePalpitesAoVivo`)
- [ ] Trocar a data selecionada mantém o modo Acompanhar/Preencher já escolhido (sessionStorage)
- [ ] Trocar o grupo ativo reseta a tela para o modo Preencher
- [ ] Não há regressão no fluxo de preenchimento de palpite no modo Preencher (PalpitesLiveCard clicável, GameAnaliseDrawer abre)
- [ ] Design segue DESIGN.md: JetBrains Mono, dark only, sem sombras, bordas 1px solid
- [ ] Funciona em mobile (carrossel arrastável, ranking legível em tela estreita)
