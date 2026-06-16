# Spec: Detalhamento da Pontuação no Palpite

**Slug:** prediction-score-breakdown
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Dentro da seção "PALPITES DOS PARTICIPANTES" (`GameParticipantsList`), exibida quando um `GameCard` está expandido (feature `collapse-game-card`), permitir que o usuário clique na linha do palpite de um participante para revelar o breakdown detalhado da pontuação oficial daquele palpite — leitura pura do campo `breakdown jsonb` já persistido em `scores`, sem reimplementar nenhuma regra de cálculo no frontend.

Esta feature é estritamente de apresentação. A lógica de pontuação já existe em `lib/scoring.ts` (função `calculateScore`, exportada também via `BREAKDOWN_LABELS`) e na função Postgres `calculate_scores_for_game`. Nenhuma dessas duas implementações é tocada.

---

## Histórias de Usuário

- Como participante logado, quero clicar no palpite de outro participante (ou no meu próprio) dentro de um jogo expandido para entender exatamente quais bônus contribuíram para a pontuação dele naquele jogo.
- Como participante logado, quero que ao clicar novamente na mesma linha o detalhamento feche, sem afetar as outras linhas da lista nem o estado de expansão do card do jogo.
- Como participante logado, quero que, se a pontuação daquele palpite ainda não foi calculada (jogo `pending`/`live`, ou trigger ainda não disparado), a linha não me ofereça um detalhamento vazio ou quebrado.

---

## Modelo de Dados

### Nenhuma tabela nova ou modificada

Esta feature lê exclusivamente o campo `breakdown jsonb` já existente em `scores` (populado pelo trigger Postgres `calculate_scores_for_game`, ver `scoring-spec.md`/`fix-loser-score-rule`). **Nenhuma migration é necessária.**

### RLS

Não aplicável — a feature não introduz nenhuma query nova de banco. O dado de `breakdown` já é lido hoje na query existente de `scores` em `JogosPage` (`select('*')`, ver `app/(dashboard)/jogos/page.tsx` linha 134), mas atualmente **descartado** ao montar `participantsByGameId` (apenas `points` é propagado, não `breakdown`). As políticas RLS de `scores` (`SELECT` para `auth.role() = 'authenticated'`, escopado por `group_id` conforme feature `grupos`) já permitem essa leitura — nada muda em RLS.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. O `breakdown` já está disponível no Server Component (`app/(dashboard)/jogos/page.tsx`) através da query `scores` existente; o trabalho desta feature é 100% de propagação de dado já buscado + apresentação no client. Nenhum código Ruby em `api/` precisa ser tocado.

---

## Mudança no fluxo de dados (Server Component → Client)

### `lib/types/participant.ts`

**Arquivo:** `lib/types/participant.ts`

Adicionar o campo `breakdown` à interface `ParticipantEntry`, usando o tipo já existente `ScoreBreakdown` de `lib/types/score.ts`:

```typescript
import type { ScoreBreakdown } from '@/lib/types/score'

export interface ParticipantEntry {
  userId: string
  name: string
  prediction: { home_score: number; away_score: number } | null
  points: number | null
  breakdown: ScoreBreakdown | null // null quando não há score calculado para este palpite
}
```

`breakdown` é `null` sempre que `points` for `null` (mesma condição: sem palpite, ou palpite sem score oficial calculado ainda). Quando `points` não é `null`, `breakdown` deve corresponder exatamente ao registro de `scores` daquele `(user_id, game_id)`.

### `app/(dashboard)/jogos/page.tsx`

**Arquivo:** `app/(dashboard)/jogos/page.tsx`

Hoje a página indexa apenas o campo `points` por `(user_id, game_id)`:

```typescript
const scoreByUserGame: Record<string, number> = {}
for (const s of typedAllScores) {
  scoreByUserGame[`${s.user_id}:${s.game_id}`] = s.points
}
```

Isso deve ser estendido para também indexar `breakdown`. Substituir por uma estrutura que carregue ambos os campos:

```typescript
const scoreByUserGame: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}
for (const s of typedAllScores) {
  scoreByUserGame[`${s.user_id}:${s.game_id}`] = {
    points: s.points,
    breakdown: s.breakdown,
  }
}
```

E, ao montar `participantsByGameId`, propagar `breakdown` junto de `points`:

```typescript
for (const gameId of gameIds) {
  participantsByGameId[gameId] = memberProfiles.map((profile) => {
    const key = `${profile.id}:${gameId}`
    const prediction = predByUserGame[key] ?? null
    const scoreEntry = prediction !== null ? (scoreByUserGame[key] ?? null) : null
    return {
      userId: profile.id,
      name: profile.name,
      prediction,
      points: scoreEntry?.points ?? null,
      breakdown: scoreEntry?.breakdown ?? null,
    } as ParticipantEntry
  })
}
```

Adicionar o import de `ScoreBreakdown` (`import type { ScoreBreakdown } from '@/lib/types/score'`) caso ainda não esteja presente — hoje o arquivo já importa `Score` de `lib/types/score`, então o tipo `ScoreBreakdown` pode ser importado do mesmo módulo.

**Nenhuma query nova é adicionada.** A query `supabase.from('scores').select('*')` (linha 134-137) já retorna a coluna `breakdown` (select `*`); a mudança é puramente de como o resultado já obtido é mapeado em memória.

### `components/games/GameCard.tsx`

Nenhuma mudança de lógica. O componente já repassa `participants` (agora com `breakdown` incluso em cada `ParticipantEntry`) para `GameParticipantsList` sem alteração de prop — `ParticipantEntry[]` é o mesmo tipo, apenas com um campo adicional. Nenhuma edição é necessária neste arquivo além de garantir (por leitura, não por mudança) que o tipo `ParticipantEntry` importado já reflita a nova interface.

---

## Frontend — Componentes React

### `GameParticipantsList` — adicionar interatividade de linha

**Arquivo:** `components/bolao/GameParticipantsList.tsx`

Hoje é um componente puramente apresentacional sem estado (`function GameParticipantsList(...)`, sem `'use client'` explícito, mas já renderizado dentro de `GameCard`, que é `'use client'` — logo já roda no client por herança de árvore). Esta feature introduz estado local de UI: qual linha (se alguma) está com o detalhamento expandido.

**Novo estado:**

```typescript
const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
```

- Inicializado como `null` (nenhuma linha expandida) a cada montagem do componente — consistente com a regra já estabelecida por `collapse-game-card` de não persistir estados de expansão entre remontagens (ex: trocar de dia, ou colapsar/expandir o card pai, que desmonta `GameParticipantsList` por estar condicionado a `isParticipantsExpanded` no `GameCard`).
- Apenas uma linha pode estar expandida por vez **dentro da mesma lista de participantes de um jogo** (accordion exclusivo). Justificativa: o detalhamento de breakdown é uma informação secundária de leitura rápida (poucas linhas de texto), diferente da decisão de `collapse-game-card` de permitir múltiplos jogos expandidos simultaneamente (que comparam contextos distintos); aqui, expandir o breakdown de um participante enquanto se compara com outro do mesmo jogo é um caso de uso menos comum que justifica a UI mais simples de accordion. Clicar em uma linha diferente da que está expandida troca o `expandedUserId` para a nova linha (fecha a anterior, abre a nova) em vez de exigir dois cliques.
- Adicionar `'use client'` no topo do arquivo, já que o componente passa a usar `useState`. (Hoje funciona sem a diretiva porque é importado por um Client Component, mas a diretiva explícita é a convenção correta para um componente que usa hooks — torna o componente client-safe independente de quem o importa.)

**Lógica de quais linhas são clicáveis:**

Uma linha de participante é clicável (oferece expansão de detalhamento) **somente quando**:
1. `p.prediction !== null` (participante fez palpite), **e**
2. `p.breakdown !== null` (há um registro de `scores` calculado para aquele palpite — equivalente a `gameStatus === 'finished'` e o trigger já ter rodado).

Quando `gameStatus !== 'finished'` (`pending` ou `live`), `breakdown` é sempre `null` no dado recebido (ver seção "Mudança no fluxo de dados" acima — `scoreEntry` só existe quando há registro oficial em `scores`, e jogos não finalizados não têm esse registro). Portanto, na prática, o detalhamento só fica disponível para jogos `finished` com score já calculado — **a pontuação provisória de jogos `live` (`livePoints`, calculada client-side via `calculateLiveScore`) não oferece breakdown clicável nesta feature**, pois não é o dado "já existente na tabela `scores`" que esta feature foi pedida para expor; é um cálculo client-side projetivo, fora do escopo desta spec. Isso é consistente com o pedido do usuário ("ler diretamente o campo breakdown jsonb já existente na tabela scores").

**Linhas não clicáveis** (sem palpite, ou sem score calculado) devem manter exatamente a aparência visual atual — nenhuma mudança de cursor, hover ou borda. Apenas as linhas elegíveis ganham indicação de interatividade.

**Modificações na renderização:**

1. A `<tr>` de cada participante elegível (`p.prediction !== null && p.breakdown !== null`) recebe:
   - `onClick` que faz toggle: `setExpandedUserId((prev) => (prev === p.userId ? null : p.userId))`
   - `style={{ cursor: 'pointer' }}` adicional
   - `role="button"` e `tabIndex={0}` (já que `<tr>` não é nativamente focável/ativável como `<button>`) — necessário para acessibilidade via teclado
   - `aria-expanded={expandedUserId === p.userId}`
   - `onKeyDown` tratando `Enter` e `Espaço` para disparar o mesmo toggle do `onClick` (replicando o padrão de ativação por teclado, já que `<tr>` não tem isso nativamente como o `<button>` usado em `collapse-game-card`)
   - Indicação visual sutil de que é clicável: alterar a cor da coluna PALPITE (ou adicionar um indicador textual `▾`/`▴` ao final da linha) — ver detalhe de layout abaixo.

2. Linhas não elegíveis não recebem nenhum desses atributos/handlers — permanecem `<tr>` simples, exatamente como hoje.

3. Quando `expandedUserId === p.userId`, renderizar uma linha adicional imediatamente após a `<tr>` daquele participante: uma única `<tr>` com um `<td colSpan={...}>` (o número de colunas visíveis: 2 quando `pending`/`live`, 3 quando `finished`) contendo o componente de breakdown (ver `PredictionBreakdown` abaixo).

**Indicador visual de linha expansível (coluna PARTICIPANTE):**

Para sinalizar que a linha é clicável sem introduzir ícones decorativos (proibido por DESIGN.md), adicionar um indicador ASCII discreto ao final do nome do participante, somente em linhas elegíveis:

```
GOLEADOR_MASTER  ▾     <- colapsado, elegível
GOLEADOR_MASTER  ▴     <- expandido
FUTEBOL_REI            <- não elegível (sem score), sem indicador
```

- Indicador em `color-muted`, `font-size: 9px`, posicionado à direita do nome dentro da própria célula (`display: flex`, `justify-content: space-between` na célula, ou um `<span>` com `margin-left: 0.35rem`).
- Usar os mesmos caracteres já convencionados pelo projeto em `collapse-game-card`: `▾` (colapsado) / `▴` (expandido).

### Novo componente: `PredictionBreakdown`

**Arquivo:** `components/bolao/PredictionBreakdown.tsx`

Componente de apresentação pura, sem lógica de cálculo, que recebe um `ScoreBreakdown` já resolvido e o `points` total, e renderiza a lista de componentes que contribuíram. Reaproveita o padrão visual e os rótulos já estabelecidos por `ScoreDisplay.tsx` (que já importa `BREAKDOWN_LABELS` de `lib/scoring.ts`), mas em versão compacta adequada para uma linha de tabela dentro de `GameParticipantsList` (que já é mais densa que o card de palpite individual onde `ScoreDisplay` aparece).

**Props:**

```typescript
import type { ScoreBreakdown } from '@/lib/types/score'

interface PredictionBreakdownProps {
  points: number
  breakdown: ScoreBreakdown
}
```

**Rótulos** — reaproveitar `BREAKDOWN_LABELS` de `lib/scoring.ts` (já existente, não duplicar):

```typescript
import { BREAKDOWN_LABELS } from '@/lib/scoring'
```

```
winner       -> "Acertou o vencedor"     (+3)
exact        -> "Placar exato"           (+5)
winner_score -> "Placar do vencedor"     (+3)
diff         -> "Diferença de gols"      (+2)
loser_score  -> "Placar do perdedor"     (+1)
goleada      -> "Goleada"                (+1)
```

(Nota: os rótulos acima já existem literalmente em `BREAKDOWN_LABELS`; usar exatamente esses textos, sem reescrever. Os nomes mencionados no contexto do PM — "Somente placar do vencedor", "Somente placar do perdedor" — são as descrições do CLAUDE.md; o código já usa "Placar do vencedor"/"Placar do perdedor" como rótulo mais curto. Manter consistência com o que já está em produção em `ScoreDisplay`, não introduzir um segundo texto para o mesmo conceito.)

**Lógica de renderização (idêntica à de `ScoreDisplay`, sem reimplementar cálculo — apenas filtra e lista):**

```typescript
const breakdownItems: Array<{ key: keyof ScoreBreakdown; label: string; pts: number }> = [
  { key: 'winner', label: BREAKDOWN_LABELS.winner, pts: breakdown.winner },
  { key: 'exact', label: BREAKDOWN_LABELS.exact, pts: breakdown.exact },
  { key: 'winner_score', label: BREAKDOWN_LABELS.winner_score, pts: breakdown.winner_score },
  { key: 'diff', label: BREAKDOWN_LABELS.diff, pts: breakdown.diff },
  { key: 'loser_score', label: BREAKDOWN_LABELS.loser_score, pts: breakdown.loser_score },
  { key: 'goleada', label: BREAKDOWN_LABELS.goleada, pts: breakdown.goleada },
].filter((item) => item.pts > 0)
```

**Layout (compacto, dentro da linha de tabela expandida):**

```
┌────────────────────────────────────────────────────┐
│  ✓ Acertou o vencedor                          +3   │
│  ✓ Placar exato                                +5   │
│  ──────────────────────────────────────────────────│
│  TOTAL                                      8 pontos │
└────────────────────────────────────────────────────┘
```

Estado zero (nenhum item com pontos > 0, mas `points === 0` — ex: vencedor errado):

```
┌────────────────────────────────────────────────────┐
│  ✗ SEM PONTOS NESTE PALPITE                          │
└────────────────────────────────────────────────────┘
```

**Regras visuais:**
- `font-family: 'JetBrains Mono', 'Courier New', monospace`, `font-size: 10px–11px` (mais compacto que `ScoreDisplay`, que usa 11-13px, pois vive dentro de uma célula de tabela já densa)
- Cada item: `✓` em `color-win`, label em `color-text` (uppercase, `letter-spacing: 0.03em`), valor `+N` em `color-accent`, alinhado à direita (`display: flex; justify-content: space-between`)
- Separador entre itens e total: `border-top: 1px solid var(--color-border)`
- Linha de `TOTAL`: label em `color-muted` uppercase, valor em `color-accent` bold
- Estado zero: texto único `✗ SEM PONTOS NESTE PALPITE` centralizado, em `color-muted`, uppercase, `letter-spacing: 0.05em` — mesmo padrão usado em `ScoreDisplay` (`✗ SEM PONTOS NESTE JOGO`), adaptado para o singular do palpite
- `background-color: var(--color-bg)` ou `var(--color-surface)` (escolha do Programador, desde que haja contraste sutil com a linha da tabela acima, sem introduzir sombra)
- Sem bordas externas arredondadas, sem `box-shadow`
- `padding: 0.5rem 0.75rem` aproximadamente, ajustável para caber dentro do `<td colSpan>`

**Estados do componente:**

| Estado | Condição | Renderização |
|--------|----------|---------------|
| `populated` | `breakdownItems.length > 0` | Lista de itens com pontos + linha de total |
| `zero` | `breakdownItems.length === 0` (palpite errou o vencedor, `points === 0`) | `✗ SEM PONTOS NESTE PALPITE` |

Não há estado `loading` ou `error` — o dado já chega resolvido via props (Server Component → Client), sem fetch assíncrono nesta feature.

### Integração em `GameParticipantsList`

Trecho ilustrativo de como a linha expandida é renderizada (dentro do `<tbody>`, após o `.map`):

```tsx
{participants.map((p) => {
  const isCurrentUser = p.userId === currentUserId
  const shouldHidePrediction = isPending && !isCurrentUser
  const isExpandable = p.prediction !== null && p.breakdown !== null
  const isExpanded = expandedUserId === p.userId

  function handleToggle() {
    if (!isExpandable) return
    setExpandedUserId((prev) => (prev === p.userId ? null : p.userId))
  }

  return (
    <Fragment key={p.userId}>
      <tr
        onClick={isExpandable ? handleToggle : undefined}
        onKeyDown={
          isExpandable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggle()
                }
              }
            : undefined
        }
        role={isExpandable ? 'button' : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? isExpanded : undefined}
        style={isExpandable ? { cursor: 'pointer' } : undefined}
      >
        {/* ...colunas PARTICIPANTE / PALPITE / PTS como hoje, com indicador ▾/▴ adicional na coluna PARTICIPANTE quando isExpandable */}
      </tr>
      {isExpanded && p.breakdown && p.points !== null && (
        <tr>
          <td colSpan={showPoints || showLivePoints ? 3 : 2} style={{ padding: 0 }}>
            <PredictionBreakdown points={p.points} breakdown={p.breakdown} />
          </td>
        </tr>
      )}
    </Fragment>
  )
})}
```

Notas de implementação:
- Importar `Fragment` de `'react'` (necessário para retornar duas `<tr>` por participante sem quebrar a estrutura de `<table>`/`<tbody>` com um wrapper inválido como `<div>`).
- `colSpan` deve corresponder exatamente ao número de `<th>` renderizados no `<thead>` (2 quando nem `showPoints` nem `showLivePoints`; 3 quando algum dos dois é `true`) — o Programador deve calcular isso a partir das mesmas variáveis já usadas no `<thead>` existente, não introduzir uma constante separada que possa dessincronizar.
- O clique não deve disparar quando o usuário seleciona texto na linha (comportamento padrão de `onClick` em React já é compatível com isso; não é necessário tratamento extra).

---

## Regras de Negócio

1. **Fonte de verdade do breakdown:** o componente `PredictionBreakdown` nunca calcula pontuação. Ele recebe `breakdown: ScoreBreakdown` e `points: number` já resolvidos a partir do registro de `scores` correspondente, propagados via `ParticipantEntry.breakdown`/`ParticipantEntry.points`. Nenhuma chamada a `calculateScore()` ou `calculateLiveScore()` ocorre dentro deste componente ou do toggle de linha.

2. **Elegibilidade de linha clicável:** uma linha só é clicável quando `prediction !== null && breakdown !== null`. Isso exclui automaticamente: participantes sem palpite; jogos `pending` (nenhum score existe ainda); jogos `live` (score oficial só existe após `finished`, mesmo que haja pontuação provisória calculada client-side exibida na coluna PTS*). Não há necessidade de checar `gameStatus` explicitamente na lógica de elegibilidade — a ausência de `breakdown` já captura todos esses casos pela ausência do registro em `scores`.

3. **Toggle exclusivo por jogo:** dentro de uma mesma instância de `GameParticipantsList` (i.e., dentro de um jogo expandido), no máximo uma linha de participante tem o breakdown visível por vez. Clicar em uma segunda linha enquanto outra está expandida fecha a primeira e abre a segunda. Clicar na linha já expandida fecha (volta a nenhuma expandida).

4. **Independência entre jogos:** cada `GameParticipantsList` é uma instância separada (uma por `GameCard` expandido) com seu próprio estado `expandedUserId`. Expandir o breakdown de um participante no jogo A não afeta o jogo B, nem o estado de expansão do card do jogo (`isParticipantsExpanded`, controlado pelo `GameCard` pai e fora do escopo desta feature).

5. **Reset ao desmontar:** como `GameParticipantsList` só é montado quando `isParticipantsExpanded === true` no `GameCard` pai (feature `collapse-game-card`), colapsar o card desmonta `GameParticipantsList` por completo — o estado `expandedUserId` é perdido junto (comportamento padrão do React, nenhum código extra necessário). Ao expandir o card novamente, `GameParticipantsList` remonta do zero com `expandedUserId = null`.

6. **Apresentação dos itens do breakdown:** apenas componentes com `pts > 0` aparecem listados (mesma regra já usada em `ScoreDisplay.tsx`). Se todos os seis componentes forem `0` (palpite errou completamente o vencedor — `points === 0`), exibir o estado "zero": `✗ SEM PONTOS NESTE PALPITE`.

7. **Sem duplicação de rótulos:** os rótulos em português usados em `PredictionBreakdown` devem ser importados de `BREAKDOWN_LABELS` (`lib/scoring.ts`), nunca redeclarados localmente como strings soltas no novo componente.

8. **Acessibilidade do toggle de linha:** como `<tr>` não é nativamente focável, a linha elegível precisa de `role="button"`, `tabIndex={0}` e `onKeyDown` tratando `Enter`/`Espaço`, replicando manualmente o que o `<button>` nativo oferece de graça (usado em `collapse-game-card` para o toggle do card). Isso é uma exceção justificada: não é possível aninhar um `<button>` inteiro como filho de `<tr>` envolvendo as células sem quebrar a semântica de tabela; a alternativa (um `<button>` dentro de uma das células, cobrindo só parte da linha) fragmentaria a área clicável e contradiria o pedido explícito do usuário ("clicar na linha").

---

## Proteção de Rotas

Nenhuma mudança. A funcionalidade vive inteiramente dentro de `/jogos`, já protegida pelo middleware existente (grupo de rotas `(dashboard)`).

---

## Integração Supabase Realtime

Nenhum canal novo é criado, nenhum canal existente é alterado.

- O `breakdown` chega ao client exclusivamente via SSR (Server Component `JogosPage`, no carregamento/navegação da página) — não há atualização em tempo real do breakdown nesta feature, consistente com a decisão já tomada em `game-participants-view-spec.md` ("palpites são imutáveis após o deadline; scores são calculados após o jogo encerrar... Realtime para `participantsByGameId` não agrega valor perceptível").
- Caso um jogo passe de `live` para `finished` enquanto o usuário está com a página aberta, o `liveScore` do próprio usuário atualiza via `useScoreRealtime` (já existente, sem mudança), mas o `breakdown` dos **outros participantes** dentro de `GameParticipantsList` só refletirá o novo registro de `scores` em uma navegação/reload subsequente da página — mesma limitação já documentada (e aceita) para `points` na feature `game-participants-view`. Esta spec não introduz regressão nem corrige essa limitação preexistente; está fora do escopo solicitado.

---

## Critérios de Aceite

- [ ] Dentro de um `GameCard` expandido (`isParticipantsExpanded === true`), clicar na linha de um participante com palpite e score já calculado (`gameStatus === 'finished'`, `breakdown !== null`) exibe o breakdown detalhado da pontuação daquele palpite, listando cada componente com pontos > 0 (rótulo + valor) ou o estado "✗ SEM PONTOS NESTE PALPITE" quando `points === 0`
- [ ] Clicar novamente na mesma linha fecha o detalhamento (toggle), retornando a tabela ao estado normal
- [ ] Clicar em uma linha diferente enquanto outra está expandida fecha a anterior e abre a nova (accordion exclusivo por jogo)
- [ ] Expandir/colapsar uma linha não afeta o estado de expansão de `GameParticipantsList` de outros jogos, nem o estado de expansão (`isParticipantsExpanded`) do `GameCard` pai
- [ ] Linhas de participantes sem palpite (`prediction === null`) ou sem score calculado (`breakdown === null` — jogos `pending`/`live`, ou `finished` sem trigger ainda disparado) não são clicáveis: sem `cursor: pointer`, sem indicador `▾`/`▴`, sem `role="button"`, clique não tem efeito
- [ ] O breakdown exibido é fiel ao campo `breakdown` de `scores` — nenhuma chamada a `calculateScore()`/`calculateLiveScore()` ocorre em `PredictionBreakdown` ou no handler de toggle; os valores vêm exclusivamente das props recebidas
- [ ] Rótulos em português usados no breakdown vêm de `BREAKDOWN_LABELS` (`lib/scoring.ts`), sem strings duplicadas/redeclaradas
- [ ] `ParticipantEntry` (`lib/types/participant.ts`) tem novo campo `breakdown: ScoreBreakdown | null`, populado em `app/(dashboard)/jogos/page.tsx` a partir do mesmo registro de `scores` já buscado (nenhuma query nova adicionada)
- [ ] Linha clicável é acessível via teclado: focável via Tab (`tabIndex={0}`), ativável via Enter ou Espaço, com `aria-expanded` refletindo o estado atual
- [ ] Nenhuma migration de banco criada; nenhum endpoint novo ou modificado em `api/`; nenhuma alteração em `lib/scoring.ts` ou na função Postgres `calculate_scores_for_game`
- [ ] Design segue DESIGN.md rigorosamente: fonte monospace JetBrains Mono, paleta de tokens `color-*`, dense, dark only, sem ícones SVG decorativos (apenas ASCII: `✓`, `✗`, `▾`, `▴`), bordas simples (`1px solid`/`1px dashed var(--color-border)`), sem `box-shadow`
- [ ] Funciona em mobile (coluna única, linha clicável com área de toque adequada, `<td colSpan>` do breakdown sem overflow horizontal)
- [ ] `npm run lint` e `npm run build` executam sem erros
