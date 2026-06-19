# Spec: Jogos do Dia no Bottom Sheet "Tá Rolando"

**Slug:** live-today-games
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Exibir os jogos do dia corrente no `LiveTodayBottomSheet`, acima da tabela de ranking ao vivo, mostrando times com bandeiras emoji, placar atual e status de cada partida. Os dados dos jogos já são buscados dentro de `useLiveTodayRanking` mas a query SELECT está incompleta (faltam `home_team`, `away_team`, `home_team_code`, `away_team_code`, `match_date`) e os dados não são retornados pelo hook nem consumidos pelo componente.

---

## Histórias de Usuário

- Como participante do bolão, quero ver quais jogos estão acontecendo hoje ao abrir o "Tá rolando", para saber o contexto dos placares ao vivo.
- Como participante, quero ver o placar atualizado de cada jogo do dia no bottom sheet, para acompanhar a partida sem sair da tela.
- Como participante, quero identificar claramente quais jogos estão ao vivo versus encerrados versus ainda não iniciados, para saber em quais os pontos ainda podem mudar.

---

## Modelo de Dados

Nenhuma migration necessária. Todos os campos já existem na tabela `games`:

```
games.id               uuid
games.home_team        text
games.away_team        text
games.home_team_code   char(3)
games.away_team_code   char(3)
games.home_score       int (nullable)
games.away_score       int (nullable)
games.status           text  -- 'pending' | 'live' | 'finished'
games.match_date       timestamptz
```

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. Toda a lógica é client-side via Supabase JS SDK.

---

## Alterações em `lib/hooks/useLiveTodayRanking.ts`

### 1. Novo tipo exportado `LiveTodayGame`

Adicionar logo abaixo de `LiveTodayEntry` (linha ~17 do arquivo atual):

```typescript
export interface LiveTodayGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'live' | 'finished'
  match_date: string
}
```

### 2. Ampliar SELECT da query de jogos

Linha 74 do arquivo atual:
```typescript
// ANTES
.select('id, status, home_score, away_score')

// DEPOIS
.select('id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, match_date')
```

### 3. Adicionar estado `games` ao hook

Adicionar ao bloco de estados (após `hasGamesToday`):
```typescript
const [games, setGames] = useState<LiveTodayGame[]>([])
```

### 4. Popular o estado `games` com os dados retornados pela query

Imediatamente após `setHasGamesToday(true)` (linha ~93 atual), adicionar:
```typescript
setGames(
  (gamesRaw ?? []).map((g) => ({
    id: g.id as string,
    home_team: g.home_team as string,
    away_team: g.away_team as string,
    home_team_code: g.home_team_code as string,
    away_team_code: g.away_team_code as string,
    home_score: g.home_score as number | null,
    away_score: g.away_score as number | null,
    status: g.status as 'pending' | 'live' | 'finished',
    match_date: g.match_date as string,
  }))
)
```

Também garantir que `setGames([])` seja chamado no branch de `games.length === 0` (antes de `setHasGamesToday(false)`), para que o estado seja limpo em rerenders quando não há jogos.

### 5. Atualizar assinatura de retorno do hook

```typescript
// ANTES
return { entries, loading, hasGamesToday }

// DEPOIS
return { entries, games, loading, hasGamesToday }
```

E atualizar a declaração de tipos do retorno na linha ~52:
```typescript
export function useLiveTodayRanking(groupId: string): {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]
  loading: boolean
  hasGamesToday: boolean
}
```

---

## Alterações em `components/bolao/LiveTodayBottomSheet.tsx`

### 1. Importar tipos e utilitários necessários

Adicionar imports no topo do arquivo:
```typescript
import type { LiveTodayGame } from '@/lib/hooks/useLiveTodayRanking'
import { getTeamFlag } from '@/lib/utils/teamFlag'
```

### 2. Adicionar prop `games` à interface

```typescript
interface LiveTodayBottomSheetProps {
  entries: LiveTodayEntry[]
  games: LiveTodayGame[]      // novo
  loading: boolean
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}
```

### 3. Adicionar `games` à desestruturação do componente

```typescript
export function LiveTodayBottomSheet({
  entries,
  games,
  loading,
  currentUserId,
  isOpen,
  onClose,
}: LiveTodayBottomSheetProps)
```

### 4. Adicionar keyframes `blink` para o badge "AO VIVO"

Adicionar dentro do JSX do painel, via `<style>` tag, imediatamente após o handle de arrasto:
```tsx
<style>{`
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
`}</style>
```

### 5. Sub-componente `LiveTodayGameCard`

Criar um sub-componente inline (acima do componente principal) para renderizar cada card de jogo:

```tsx
function LiveTodayGameCard({ game }: { game: LiveTodayGame }) {
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'

  const teamStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: FONT,
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        padding: '0.3rem 0.5rem',
        marginBottom: '0.2rem',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Linha principal: time casa | placar | time visitante */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
        }}
      >
        {/* Time da casa */}
        <div style={teamStyle}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>
            {getTeamFlag(game.home_team_code)}
          </span>
          {game.home_team_code}
        </div>

        {/* Placar central */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {game.status === 'pending'
            ? '— × —'
            : `${game.home_score ?? 0} × ${game.away_score ?? 0}`}
        </div>

        {/* Time visitante */}
        <div style={{ ...teamStyle, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>
            {getTeamFlag(game.away_team_code)}
          </span>
          {game.away_team_code}
        </div>
      </div>

      {/* Badge de status (apenas live e finished) */}
      {(isLive || isFinished) && (
        <div
          style={{
            marginTop: '0.2rem',
            fontFamily: FONT,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isLive ? 'var(--color-live)' : 'var(--color-muted)',
            animation: isLive ? 'blink 1s step-end infinite' : 'none',
          }}
        >
          {isLive ? '● AO VIVO' : '✓ ENCERRADO'}
        </div>
      )}
    </div>
  )
}
```

### 6. Seção "JOGOS DE HOJE" no corpo do bottom sheet

Inserir **antes** do bloco de loading/empty/tabela, dentro do `<div style={{ marginTop: '1.25rem' }}>` (corpo do painel). A seção de jogos deve aparecer **sempre que `games.length > 0`**, independentemente dos estados `loading` ou `entries.length`:

```tsx
{/* Corpo */}
<div style={{ marginTop: '1.25rem' }}>

  {/* Seção: JOGOS DE HOJE */}
  {games.length > 0 && (
    <>
      <div
        style={{
          fontFamily: FONT,
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          color: 'var(--color-text)',
          letterSpacing: '0.12em',
          marginBottom: '0.4rem',
        }}
      >
        JOGOS DE HOJE
      </div>
      {games.map((g) => (
        <LiveTodayGameCard key={g.id} game={g} />
      ))}
      {/* Separador antes do ranking */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          margin: '0.75rem 0',
        }}
      />
    </>
  )}

  {/* ... bloco loading / empty / allZero / tabela de ranking (inalterado) ... */}
```

**Comportamento dos estados de UI:**
- `loading === true`: a seção de jogos já renderiza com os dados disponíveis (se o hook retornou algum antes do re-render); abaixo do separador, a área de ranking exibe "CARREGANDO...". Na prática, `games` estará vazia no primeiro render enquanto `loading === true`, portanto a seção não é exibida durante o carregamento inicial — este é o comportamento correto (sem skeleton necessário).
- `games.length === 0` e `loading === false`: seção "JOGOS DE HOJE" não é renderizada.
- `entries.length === 0` e `loading === false`: apenas a seção de jogos aparece (quando `games.length > 0`); a tabela de ranking exibe "SEM PALPITES PARA OS JOGOS DE HOJE" como já ocorre hoje.
- `allZero === true`: seção de jogos aparece normalmente; abaixo, a mensagem "SEM PONTUAÇÃO DISPONÍVEL — AGUARDANDO INÍCIO DOS JOGOS" é exibida como já ocorre hoje.

---

## Alterações em `components/bolao/RecapController.tsx`

### Passar a nova prop `games` para `LiveTodayBottomSheet`

Linha ~40, desestruturar `games` do hook:
```typescript
// ANTES
const { hasGamesToday, entries: liveTodayEntries, loading: liveTodayLoading } = useLiveTodayRanking(groupId)

// DEPOIS
const { hasGamesToday, entries: liveTodayEntries, games: liveTodayGames, loading: liveTodayLoading } = useLiveTodayRanking(groupId)
```

Linhas ~86-92, passar a prop:
```tsx
// ANTES
<LiveTodayBottomSheet
  entries={liveTodayEntries}
  loading={liveTodayLoading}
  currentUserId={currentUserId}
  isOpen={liveTodayOpen}
  onClose={() => setLiveTodayOpen(false)}
/>

// DEPOIS
<LiveTodayBottomSheet
  entries={liveTodayEntries}
  games={liveTodayGames}
  loading={liveTodayLoading}
  currentUserId={currentUserId}
  isOpen={liveTodayOpen}
  onClose={() => setLiveTodayOpen(false)}
/>
```

---

## Frontend — Componentes React

### LiveTodayGameCard (sub-componente inline)
**Arquivo:** `components/bolao/LiveTodayBottomSheet.tsx`
**Props:** `{ game: LiveTodayGame }`
**Comportamento:**
- Layout horizontal de 3 colunas: time casa (esquerda), placar (centro), time visitante (direita)
- Time: emoji de bandeira via `getTeamFlag(code)` + código uppercase (ex: `🇧🇷 BRA`)
- Placar: `— × —` quando `status === 'pending'`; `N × N` com `home_score`/`away_score` caso contrário
- Badge de status: ausente para `pending`; `● AO VIVO` em `color-live` com `animation: blink 1s step-end infinite` para `live`; `✓ ENCERRADO` em `color-muted` sem animação para `finished`
- Container: `border: 1px solid var(--color-border)`, `background: var(--color-bg)`, sem border-radius
- Margem inferior de `0.2rem` entre cards

### LiveTodayBottomSheet (modificado)
**Arquivo:** `components/bolao/LiveTodayBottomSheet.tsx`
**Props adicionadas:** `games: LiveTodayGame[]`
**Estrutura do corpo após as mudanças:**
1. Seção "JOGOS DE HOJE" com `LiveTodayGameCard` por jogo (visível quando `games.length > 0`)
2. Separador `1px solid var(--color-border)`
3. Conteúdo existente de ranking (inalterado: loading / empty / allZero / tabela)
**Supabase Realtime:** não adiciona canal novo; as atualizações chegam via `live-today-games-{groupId}` já existente no hook, que chama `fetchData()` ao receber UPDATE em `games`, re-populando `games` no estado do hook

---

## Regras de Negócio

1. A seção "JOGOS DE HOJE" exibe todos os jogos do dia (independentemente de status), ordenados pela ordem retornada pela query (que já usa `match_date` com `.gte`/`.lt`). Nenhuma ordenação adicional é necessária no componente — o Supabase retorna por `match_date ASC` por padrão.
2. O placar exibido no card é o placar atual do jogo, podendo ser parcial (jogo `live`) ou final (jogo `finished`). Para `pending`, exibir `— × —` (travessão Unicode U+2014, não hífen).
3. A animação `blink` para "AO VIVO" usa `animation: blink 1s step-end infinite`, exatamente como especificado em DESIGN.md (comportamento `step-end` para piscar discretamente, não fade).
4. Não há ordenação especial por status dentro da seção — os jogos aparecem na ordem da query (por `match_date ASC`), o que é semanticamente correto (cronológico).
5. Quando `home_score` ou `away_score` for `null` em jogo `live` ou `finished`, exibir `0` como fallback (`?? 0`). Na prática isso não ocorre em produção, mas garante que a UI não renderize "null × null".

---

## Proteção de Rotas

Nenhuma rota nova. O `LiveTodayBottomSheet` é renderizado dentro do `RecapController`, que já está em `app/(dashboard)/layout.tsx` (rota protegida por autenticação via middleware existente).

---

## Integração Supabase Realtime

Nenhum canal novo. O canal `live-today-games-{groupId}` já existente no hook observa UPDATEs na tabela `games` e, ao receber um evento, chama `fetchData()` novamente. Como o SELECT de `fetchData` agora inclui os campos de times e `match_date`, os dados de `games` no estado do hook se atualizam automaticamente a cada mudança de placar, e o componente re-renderiza os cards com o novo placar sem ação adicional.

---

## Critérios de Aceite

- [ ] `useLiveTodayRanking` exporta a interface `LiveTodayGame` com os 9 campos especificados
- [ ] O SELECT de games em `useLiveTodayRanking` inclui `home_team`, `away_team`, `home_team_code`, `away_team_code`, `match_date`
- [ ] `useLiveTodayRanking` retorna `games: LiveTodayGame[]` além de `entries`, `loading`, `hasGamesToday`
- [ ] `LiveTodayBottomSheet` aceita a prop `games: LiveTodayGame[]` sem erro de TypeScript
- [ ] Seção "JOGOS DE HOJE" aparece acima do ranking quando há jogos no dia
- [ ] Cada card exibe: bandeira + código do time da casa | placar | bandeira + código do time visitante
- [ ] Placar exibe `— × —` (travessão, não hífen) para jogos `pending`
- [ ] Badge `● AO VIVO` aparece em `color-live` com animação `blink 1s step-end infinite` para jogos `live`
- [ ] Badge `✓ ENCERRADO` aparece em `color-muted` sem animação para jogos `finished`
- [ ] Nenhum badge de status aparece para jogos `pending`
- [ ] Bandeiras obtidas via `getTeamFlag()` de `lib/utils/teamFlag.ts` (sem nova dependência)
- [ ] `RecapController` desestrutura `games` do hook e passa como prop para `LiveTodayBottomSheet`
- [ ] Nenhuma migration, nenhum endpoint novo, nenhum canal Realtime novo
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, dense, `border: 1px solid var(--color-border)`, sem border-radius nos cards, sem sombras
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
