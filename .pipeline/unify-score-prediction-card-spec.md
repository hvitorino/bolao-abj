# Spec: Unificação do placar real e palpite no card de jogo

**Slug:** unify-score-prediction-card
**Data:** 2026-07-14
**Status:** spec

---

## Objetivo

Eliminar a duplicação visual de bandeiras/nomes de times entre a seção "Placar" (placar real) e a caixa "Seu Palpite" no card de jogo (`GameCardView.tsx`). O palpite do usuário passa a ser exibido como uma linha compacta, sem bandeiras e sem caixa/borda própria, logo abaixo do placar real — no mesmo estilo já usado em `PalpitesLiveCard.tsx` (função `GameItem`): placar real maior/destacado em cima, palpite menor/muted embaixo.

Esta é uma melhoria visual pontual sobre features já implementadas (`game-navigation`, `predictions`, `live-scores`, `scoring`). Não há mudança de modelo de dados, de endpoints ou de regras de pontuação — apenas de composição visual dos componentes React existentes.

---

## Histórias de Usuário

- Como participante navegando pela lista de jogos do dia, quero ver o placar real e meu palpite em um único bloco compacto, sem repetição de bandeiras, para conseguir escanear mais jogos na tela sem rolar tanto.
- Como participante com um jogo pendente e dentro do prazo, quero uma forma clara (mas discreta) de editar meu palpite, sem que isso ocupe uma caixa inteira.
- Como participante acompanhando um jogo ao vivo ou encerrado, quero tocar na linha do meu palpite para expandir o detalhamento de pontos (breakdown), sem elementos extras.

---

## Modelo de Dados

Nenhuma mudança. Esta feature não introduz tabelas, colunas, migrations ou políticas RLS novas. Usa os mesmos dados já carregados pelos componentes (`Game`, `Prediction`, `Score`, `ScoreBreakdown`).

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma mudança. Nenhum endpoint é criado, alterado ou removido nesta feature.

---

## Frontend — Componentes React

### Princípio geral de layout (`GameCardView.tsx`)

A seção "Placar" atual (linhas ~111-124: grid `1fr auto 1fr` com bandeira + nome de casa, placar central, bandeira + nome de fora) **permanece exatamente como está** — nenhuma alteração de JSX ou estilo nessa parte.

A seção "Área de palpite" atual (linhas ~126-171) é reestruturada para nunca mais renderizar bandeiras/nomes de times. Ela passa a conter, dependendo do estado:

1. O formulário de palpite (`PredictionForm`) — inalterado, usado quando não há palpite ou durante edição.
2. A linha compacta de palpite (`PredictionDisplay` simplificado) — nova versão, sem bandeiras/caixa.
3. Opcionalmente, uma faixa fina "EDITAR PALPITE" abaixo da linha de palpite (elemento novo, vive em `GameCardView.tsx`, não em `PredictionDisplay`).
4. Opcionalmente, o breakdown expansível (`ScoreDisplay`) abaixo da linha de palpite — inalterado, sem mudança funcional.

### Máquina de estados da "Área de palpite"

Usar as variáveis já existentes em `GameCardView.tsx`: `isPending`, `isLive`, `isFinished`, `isEditing`, `currentPrediction`, `canEdit` (= `isPending && currentPrediction != null && !isDeadlinePassed(game.match_date)`), `displayScore`, `liveHomeScore`, `liveAwayScore`.

| # | Condição | Renderização |
|---|----------|--------------|
| 1 | `isPending && !currentPrediction && !isEditing` | `PredictionForm` (inalterado) |
| 2 | `isPending && currentPrediction && !isEditing && canEdit` | `PredictionDisplay` (linha compacta, sem expandir) + faixa fina "EDITAR PALPITE" abaixo |
| 3 | `isPending && currentPrediction && !isEditing && !canEdit` | `PredictionDisplay` (linha compacta, sem expandir), **sem** a faixa de editar |
| 4 | `isEditing && currentPrediction` | `PredictionForm` em modo edição (inalterado) |
| 5 | `(isLive \|\| isFinished) && currentPrediction` | `PredictionDisplay` (linha compacta, expansível: `isExpandable=true`) + `ScoreDisplay` revelado ao expandir (inalterado, já existe) |
| 6 | `(isLive \|\| isFinished) && !currentPrediction` | Linha muted simples "SEM PALPITE · +0 PTS" (substitui a caixa com borda + bandeiras apagadas que existe hoje) |

Estado 2 e 3 usam o mesmo `PredictionDisplay` não-expansível (a diferença entre eles é só a presença da faixa "EDITAR PALPITE", controlada em `GameCardView.tsx` por `canEdit`).

### `PredictionDisplay.tsx` (simplificado)

**Arquivo:** `components/bolao/PredictionDisplay.tsx`

Responsabilidade reduzida: renderizar **apenas a linha do palpite**, sem bandeiras, sem caixa/borda própria, sem botão de editar (isso sai do componente — a faixa de editar passa a ser responsabilidade de `GameCardView.tsx`).

**Nova interface de props:**
```typescript
interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  submittedAt?: string
  // Modo expansível (ao vivo / encerrado, com palpite)
  isExpandable?: boolean
  isExpanded?: boolean
  onToggle?: () => void
  points?: number | null
}
```

Remover de `PredictionDisplayProps`: `homeTeamCode`, `awayTeamCode` (não são mais usados — sem bandeiras) e `onEditRequest` (o botão de editar sai do componente).

**Estrutura visual (linha única, sem borda/caixa):**

- Placar do palpite: `{homeScore} × {awayScore}`, fonte ~16-18px, bold, cor `var(--color-accent)` — igual ao padrão do placar real em `PalpitesLiveCard.tsx` `GameItem` (mas em escala menor que o placar real do card, para manter hierarquia: placar real maior/destaque em cima, palpite menor embaixo).
- Se `points != null` (estados live/finished): badge inline "+{points} PTS" à direita do placar, mesma linha, cor `var(--color-accent)` sobre fundo `var(--color-primary)` (reaproveitar o estilo do badge de pontos já existente), seguido do indicador `▾`/`▲` de expansão quando `isExpandable`.
- Se `submittedAt` presente (estados pending): texto pequeno abaixo, `color-muted`, "enviado às HH:MM BRT" — mantém o comportamento atual.
- Todo o bloco perde `border`, `backgroundColor` e `padding` de caixa — vira uma `div`/linha simples com `padding` vertical mínimo (ex.: `0.35rem 0`), sem outline.
- Quando `isExpandable && onToggle`: o elemento raiz continua com `role="button"`, `tabIndex={0}`, `onClick={onToggle}`, `onKeyDown` (Enter/Espaço) — mantém a acessibilidade atual, só remove a borda/caixa visual.
- Layout da linha: `display: flex; alignItems: center; gap: 0.5rem` — placar à esquerda, badge de pontos (se houver) à direita, cursor `pointer` quando expansível.

**Estados internos (`loading`/`error`/`empty`/`populated`):** este componente é puramente apresentacional (sem fetch), portanto não tem estado de loading/error próprio — a lógica de "populated" (tem palpite) vs. "empty" (sem palpite, estado 6) é decidida no componente pai (`GameCardView.tsx`), que decide se renderiza `PredictionDisplay` ou a linha "SEM PALPITE" descrita abaixo.

**Supabase Realtime:** não — este componente recebe dados via props do pai, sem hooks Realtime próprios (mesma convenção documentada no cabeçalho de `GameCardView.tsx`).

### `GameCardView.tsx` (seção "Área de palpite")

**Arquivo:** `components/games/GameCardView.tsx`

Mudanças na seção que hoje vai das linhas ~126 a ~171:

1. **Remover** o parâmetro `homeTeamCode`/`awayTeamCode` e `onEditRequest` das chamadas a `PredictionDisplay` (não existem mais nessas props).
2. **Estado 2** (`isPending && currentPrediction && !isEditing && canEdit`): renderizar `PredictionDisplay` (não expansível) e, logo abaixo, um elemento novo — faixa fina "EDITAR PALPITE":
   - Botão full-width, fino (menor altura que a "Barra de ações" — ex. `padding: 0.35rem 0.75rem` vs. `0.6rem 0.75rem` da barra de ações), `backgroundColor: var(--color-primary)`, `color: var(--color-bg)`, `fontSize: 10-11px`, `fontWeight: bold`, `textTransform: uppercase`, `letterSpacing: 0.08em`, `border: none`, `cursor: pointer`, texto `✎ EDITAR PALPITE`.
   - `onClick`: `() => setIsEditing(true)` (mesma lógica que hoje dispara `onEditRequest`).
   - Fica **dentro** do bloco "Área de palpite" (mesmo container com `borderTop: 1px dashed var(--color-border)`), não na "Barra de ações" (que é para VER ANÁLISE / VER PALPITES).
3. **Estado 3** (`isPending && currentPrediction && !isEditing && !canEdit`): renderizar apenas `PredictionDisplay` (não expansível), sem a faixa de editar.
4. **Estado 5** (`isLive || isFinished`, com `currentPrediction`): mesma lógica atual, mas chamando o `PredictionDisplay` simplificado (sem `homeTeamCode`/`awayTeamCode`/`onEditRequest`) com `isExpandable={!!(displayScore && liveHomeScore !== null && liveAwayScore !== null)}`, `isExpanded={isScoreExpanded}`, `onToggle={() => setIsScoreExpanded((prev) => !prev)}`, `points={displayScore?.points ?? null}`. O `ScoreDisplay` revelado ao expandir continua idêntico ao atual (linhas ~147-153).
5. **Estado 6** (`isLive || isFinished`, sem `currentPrediction`): substituir o bloco atual (linhas ~156-167, com borda, bandeiras apagadas e "✗ SEM PALPITE" + badge "+0 PTS") por uma linha simples, sem borda/caixa, sem bandeiras:
   - Texto único: `SEM PALPITE · +0 PTS`, `color: var(--color-muted)`, `fontSize: 12-13px`, `textAlign: center` (ou alinhado à esquerda, consistente com a nova linha de `PredictionDisplay** — decidir durante implementação com base no alinhamento adotado para a linha de palpite normal, mantendo consistência visual entre os estados 5 e 6).
   - Sem símbolo `✗` obrigatório (opcional, mas se usado deve seguir o padrão ASCII do DESIGN.md).

**Estados de loading/error/empty/populated do card como um todo:** inalterados — esta feature não introduz novos estados de carregamento; a lógica de exibição já existe via os estados de jogo (`pending`/`live`/`finished`) e presença/ausência de `currentPrediction`.

### `ScoreDisplay.tsx`

**Arquivo:** `components/bolao/ScoreDisplay.tsx`

Sem mudanças funcionais ou visuais. Continua sendo revelado dentro do mesmo bloco `grid-template-rows` transition ao expandir a linha do palpite (comportamento já existente em `GameCardView.tsx` linhas ~148-153).

---

## Regras de Negócio

Nenhuma regra de pontuação ou de deadline é alterada. Regras existentes que esta feature deve **preservar exatamente**:

- Deadline de edição: `isDeadlinePassed(matchDate)` = `Date.now() >= matchDate - 5min`. A faixa "EDITAR PALPITE" só aparece quando `canEdit` for `true` (jogo pendente, com palpite, deadline não expirado).
- Cálculo de pontuação ao vivo: `calculateLiveScore` (inalterado) continua alimentando `provisionalScore`/`displayScore` exibido na linha de palpite durante jogos `live`.
- Pontuação de jogos `finished`: vem do objeto `score` (banco), não recalculada no cliente — inalterado.
- Nenhuma alteração em `lib/scoring.ts`.

---

## Proteção de Rotas

Nenhuma mudança. Esta feature não introduz novas rotas nem altera middlewares de autenticação existentes.

---

## Integração Supabase Realtime

Nenhuma mudança. `GameCardView.tsx` continua sendo componente presentacional puro (sem hooks Realtime), recebendo `game`, `prediction`, `score` via props do componente pai, conforme já documentado no cabeçalho do arquivo.

---

## Critérios de Aceite

- [ ] Nenhuma bandeira ou nome de time aparece duplicado entre a seção "Placar" e a linha de palpite no card de jogo.
- [ ] Estado 1 (pendente, sem palpite): `PredictionForm` inalterado.
- [ ] Estado 2 (pendente, com palpite, dentro do prazo): placar real inalterado em cima; linha compacta de palpite (sem bandeiras/caixa) embaixo; faixa fina "EDITAR PALPITE" visível abaixo da linha, clicável, ativa `isEditing`.
- [ ] Estado 3 (pendente, com palpite, prazo encerrado): igual ao estado 2, porém **sem** a faixa "EDITAR PALPITE".
- [ ] Estado 4 (editando): `PredictionForm` em modo edição inalterado, cancelamento e envio funcionando como hoje.
- [ ] Estado 5 (live/finished, com palpite): placar real em cima; linha "{palpite} +{N} PTS ▾" embaixo; tocar na linha expande/colapsa `ScoreDisplay` com o breakdown de pontos, com a mesma transição suave já existente.
- [ ] Estado 6 (live/finished, sem palpite): placar real em cima; linha muted "SEM PALPITE · +0 PTS" embaixo, sem borda, sem bandeiras apagadas.
- [ ] `PredictionDisplay.tsx` não recebe mais `homeTeamCode`, `awayTeamCode` nem `onEditRequest` — a assinatura da prop `onEditRequest` é removida do componente e do call site em `GameCardView.tsx`.
- [ ] Barra de ações (VER ANÁLISE / VER PALPITES), lista de participantes (`GameParticipantsList`) e botão "COPIAR LINK" continuam funcionando sem regressão.
- [ ] `npm run lint` e `npm run build` (ou equivalente do projeto) executam sem erros novos introduzidos por esta mudança.
- [ ] Design segue DESIGN.md: fonte JetBrains Mono, paleta de cores via `var(--color-*)`, placares em destaque (`color-accent`), sem sombras, bordas simples, densidade Elifoot mantida.
- [ ] Funciona em mobile (coluna única) — testar visualmente a lista de jogos em largura estreita (~360px) sem overflow horizontal.
- [ ] Nenhum outro componente que usa `PredictionDisplay` (verificar todos os call sites no repositório, ex. `GameAnaliseDrawer` ou similares) quebra por causa da mudança de props — atualizar todos os usos encontrados.

---

## Observações para o Programador

- Antes de alterar `PredictionDisplay.tsx`, rodar uma busca (`grep -r "PredictionDisplay" --include=*.tsx`) para localizar **todos** os call sites e atualizar cada um — não apenas `GameCardView.tsx`.
- Usar `components/bolao/PalpitesLiveCard.tsx` (função `GameItem`, linhas ~292-314) como referência de padrão visual "placar real em cima maior / palpite embaixo menor, sem bandeiras" — mas não copiar o estilo de botão/card com `outline`/`boxShadow` daquele componente, pois o card de `GameCardView.tsx` já tem sua própria borda de card; a linha de palpite deve ser "flat" (sem outline/boxShadow próprios), já que vive dentro do card existente.
- Não é necessário criar branch: seguir a convenção do projeto (`feature/unify-score-prediction-card`), fazer commits em português, e submeter para revisão do Revisor antes de merge na main.
- Após aprovação do Revisor e merge, o pipeline **para** — esta feature não faz parte do `product-roadmap.md` e não deve disparar avanço automático para outras features. O Revisor deve notificar diretamente que "unify-score-prediction-card foi mergeada na main" para o Gerente de Produto repassar ao usuário.
