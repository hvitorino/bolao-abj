# Spec: Animação de Posição dos Palpites na Página Pública de Jogo

**Slug:** animated-predictions-ranking
**Data:** 2026-06-24
**Status:** spec

---

## Objetivo

Exibir os palpites da página pública de um jogo (`/jogos/[gameId]/publico`) em ordem decrescente de pontuação e animar visualmente a mudança de posição dos cards quando um palpite sobe ou desce no ranking em tempo real. A lista deve se reordenar com animação fluida (300–500ms) a cada atualização via Supabase Realtime, sem reload de página.

---

## Histórias de Usuário

- Como espectador da página pública de um jogo ao vivo, quero ver os palpites ordenados por pontuação decrescente para saber quem está ganhando o bolão naquele jogo.
- Como espectador, quero ver os cards de palpite se moverem com animação fluida quando a ordem muda, para perceber visualmente qual participante subiu ou desceu no ranking.
- Como espectador, quero que a ordenação inicial seja imediata (sem animação desnecessária no primeiro render).
- Como espectador, quero que o layout existente (placar do jogo, status, rodada, times) permaneça intacto.

---

## Modelo de Dados

Nenhuma alteração de schema, migration ou endpoint necessária. Esta feature é puramente de UI/UX: modifica apenas a ordenação e a animação dos dados já disponíveis em `PublicParticipantsList`.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. O Realtime de scores já está implementado em `PublicParticipantsList` e continua sem alteração de contrato.

---

## Frontend — Componentes React

### Visão geral das mudanças

A feature toca **dois arquivos**:

1. `components/bolao/PublicParticipantsList.tsx` — adiciona ordenação reativa e troca a estrutura de `<table>` por lista de itens animáveis com a técnica FLIP via CSS transitions.
2. Sem novos arquivos de hook necessários (a lógica de ordenação é local ao componente).

**Framer Motion não está instalado** (`package.json` não contém `framer-motion`). A animação deve ser implementada com **CSS transitions + técnica FLIP manual** usando `useLayoutEffect` e refs de DOM — sem dependências externas novas.

---

### PublicParticipantsList (modificado)

**Arquivo:** `components/bolao/PublicParticipantsList.tsx`

**Props:** sem alteração de interface — as props existentes são mantidas:
```typescript
interface PublicParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  gameId: string
  groupId: string
  liveHomeScore: number | null
  liveAwayScore: number | null
}
```

**Estados:**
- `participants: ParticipantEntry[]` — estado local existente, populado via `initialParticipants` e atualizado por Realtime
- `sortedParticipants: ParticipantEntry[]` — derivado de `participants` após aplicar ordenação; calculado por `useMemo`
- `isFirstRender: boolean` via `useRef` — controla se a animação deve ser suprimida no primeiro render

**Função de ordenação — `sortParticipants(participants, gameStatus, liveHomeScore, liveAwayScore)`:**

```
function sortParticipants(
  participants: ParticipantEntry[],
  gameStatus: 'pending' | 'live' | 'finished',
  liveHomeScore: number | null,
  liveAwayScore: number | null
): ParticipantEntry[]
```

Lógica de ordenação:
1. Se `gameStatus === 'pending'`: quem tem palpite vem antes (hasPrediction desc), desempate alfabético por `name` (pt-BR). Sem animação de posição — a lista não muda durante o jogo pendente.
2. Se `gameStatus === 'live'` ou `'finished'`: ordenar por pontuação efetiva decrescente. Pontuação efetiva:
   - `live`: `calculateLiveScore({ home_score: liveHomeScore, away_score: liveAwayScore }, p.prediction)?.points ?? -1`
   - `finished`: `p.points ?? -1`
   - Participantes sem palpite (`prediction === null`) ficam sempre ao final com valor `-1`.
   - Desempate estável: nome ascendente (pt-BR). Usar desempate estável garante que a ordem não mude desnecessariamente quando dois participantes têm a mesma pontuação.

**Técnica de animação (FLIP manual):**

A estrutura HTML deve mudar de `<table>` para uma lista de `<div>` com `key={p.userId}`, pois `<tr>` dentro de `<table>` não suporta animações CSS de `translateY` de forma confiável em todos os browsers.

```
Layout atual:  <table> → <thead> → <tbody> → <tr key={userId}>
Layout novo:   <div role="table"> → header row (div) → <div role="row" key={userId}>
```

Cada row de participante recebe:
- `ref` gerenciada via `useRef<Map<string, HTMLDivElement>>(new Map())` — mapa de `userId → ref do elemento`
- Transição CSS: `transition: transform 350ms ease-in-out`

**Algoritmo FLIP no `useLayoutEffect`:**

```
useLayoutEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false
    // Salva posições iniciais sem animar
    capturePositions()
    return
  }
  // 1. FIRST: ler posições anteriores salvas (ref de posições)
  // 2. LAST: ler posições atuais (após reorder do DOM via sortedParticipants)
  // 3. INVERT: calcular delta entre First e Last; aplicar transform inverso imediatamente
  // 4. PLAY: remover o transform invertido (ou aplicar transform 0) — o CSS transition anima
}, [sortedParticipants])
```

Implementação detalhada:
- `prevPositions = useRef<Map<string, DOMRect>>(new Map())` — armazena `getBoundingClientRect()` de cada item antes da re-renderização
- Antes de cada update de `sortedParticipants`: **snapshot das posições atuais** (First)
- Após re-render com nova ordem (no `useLayoutEffect`):
  1. Ler posições atuais (Last) via `getBoundingClientRect()`
  2. Para cada `userId`, calcular `deltaY = first.top - last.top`
  3. Aplicar `element.style.transform = translateY(${deltaY}px)` e `element.style.transition = 'none'`
  4. Forçar reflow: `element.getBoundingClientRect()`
  5. Remover o transform: `element.style.transform = ''` e restaurar `element.style.transition = 'transform 350ms ease-in-out'`
  6. Salvar posições atuais em `prevPositions` para o próximo ciclo

**Snapshot das posições antes do update:**
- Usar `useEffect` com dependência em `sortedParticipants` para chamar snapshot ANTES do próximo `useLayoutEffect`
- Alternativa mais correta: snapshot no handler de update do Realtime, antes de chamar `setParticipants`

**Abordagem recomendada (mais simples e correta):**

```typescript
// Antes de setParticipants no handler Realtime:
// 1. capturar getBoundingClientRect() de cada item visível → salvar em prevPositions ref
// 2. chamar setParticipants(...)
// No useLayoutEffect([sortedParticipants]):
// 3. executar Last + Invert + Play
```

**Duração da animação:** `350ms` — perceptível mas não excessiva (dentro do critério de ≤ 500ms).

**Easing:** `ease-in-out` — suave nas bordas, consistente com o estilo retro-funcional.

**Supressão no primeiro render:** `isFirstRender.current = true` inicialmente; setado para `false` após o primeiro `useLayoutEffect`. Enquanto `true`, o FLIP não executa.

---

### Estrutura HTML do componente (antes → depois)

**Antes (tabela nativa):**
```html
<table>
  <thead><tr><th>PARTICIPANTE</th><th>PALPITE</th><th>PTS</th></tr></thead>
  <tbody>
    <tr key={userId}>…</tr>
  </tbody>
</table>
```

**Depois (divs semânticas com role ARIA):**
```html
<div role="table" aria-label="Palpites dos participantes" style="width:100%">
  <div role="rowgroup">
    <div role="row" style="display:flex; …"> <!-- header -->
      <div role="columnheader">PARTICIPANTE</div>
      <div role="columnheader">PALPITE</div>
      <div role="columnheader">PTS</div>  <!-- condicional -->
    </div>
  </div>
  <div role="rowgroup">
    <div role="row" key={userId} ref={…} style="display:flex; transition: transform 350ms ease-in-out; …">
      <div role="cell">…nome…</div>
      <div role="cell">…palpite…</div>
      <div role="cell">…pts…</div>  <!-- condicional -->
    </div>
  </div>
</div>
```

**Estilo das cells (preservar aparência atual):**
- `display: flex` no row, com `flex` proporcional nas cells para replicar comportamento de colunas de tabela
- Coluna PARTICIPANTE: `flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Coluna PALPITE: `flex: 0 0 auto; text-align: center; min-width: 80px`
- Coluna PTS (condicional): `flex: 0 0 auto; text-align: right; min-width: 48px`
- Padding, cores e tipografia: idênticos ao `<td>` atual
- Separador entre rows: `border-bottom: 1px solid var(--color-border)` no row (não na cell, para evitar linha dupla)

---

### Indicador visual de posição (opcional, baixa prioridade)

Se o Programador considerar viável sem aumentar complexidade: exibir um indicador de posição (`#1`, `#2`, etc.) à esquerda do nome em jogos `live` e `finished`. Não é requisito obrigatório para aprovação — os critérios de aceite não incluem esse indicador explicitamente.

---

## Regras de Negócio

### Ordenação

1. **Status `pending`:** quem tem palpite (`hasPrediction=true`) vem antes; desempate por nome (pt-BR). Sem animação de reordenação neste estado (não há mudança de posição durante o jogo pendente).

2. **Status `live`:** pontuação efetiva calculada no cliente via `calculateLiveScore({ home_score: liveHomeScore, away_score: liveAwayScore }, p.prediction)`. Participantes sem palpite ficam ao final (`pontuação efetiva = -1`). Reordenação animada quando `liveHomeScore` ou `liveAwayScore` muda via Realtime de `games`.

3. **Status `finished`:** pontuação oficial de `p.points` (originada da tabela `scores`, atualizada via Realtime de `scores`). Participantes sem palpite ficam ao final. Reordenação animada quando Realtime de `scores` atualiza um participante.

4. **Desempate:** sempre por `name.localeCompare(otherName, 'pt-BR')` ascendente. Garante ordenação estável e determinística.

5. **Participantes sem palpite em live/finished:** ficam sempre abaixo dos participantes com palpite, ordenados entre si por nome.

### Animação

- Animação ocorre **somente** quando a ordem da lista muda entre dois renders consecutivos.
- Animação **não ocorre** no primeiro render (isFirstRender guard).
- Animação **não ocorre** se apenas os valores de pontuação mudam mas a ordem permanece a mesma (nenhum deltaY a aplicar).
- Se dois participantes trocam de posição simultaneamente, ambos animam em paralelo.
- Animação de saída (participante removido da lista): fora de escopo — nenhum participante é removido durante um jogo ao vivo.

---

## Proteção de Rotas

Nenhuma. A página `/jogos/[gameId]/publico` é pública e permanece pública.

---

## Integração Supabase Realtime

Dois canais já existentes em `PublicParticipantsList` devem **continuar** funcionando:

### Canal 1 — Scores (jogos finished)
- **Canal:** `public-scores-${gameId}-${groupId}`
- **Tabela:** `scores`
- **Evento:** `*` (INSERT e UPDATE)
- **Filtro:** `game_id=eq.${gameId}`
- **Ação ao receber:** capturar posições → `setParticipants(prev => ...)` → FLIP anima

### Canal 2 — Game (scores ao vivo, via prop `liveHomeScore` / `liveAwayScore`)
- O score ao vivo é **calculado no cliente** a partir de `liveHomeScore` e `liveAwayScore`, que chegam como props de `PublicGameClient` (via `useGameRealtime`).
- Quando `liveHomeScore` ou `liveAwayScore` muda (propagado por `useGameRealtime`), `sortedParticipants` (derivado por `useMemo`) recalcula automaticamente.
- **A reordenação e animação disparadas por mudança de placar ao vivo** são acionadas pelo `useMemo` que recalcula `sortedParticipants` — o `useLayoutEffect` detecta a mudança e aplica o FLIP.

**Atenção:** o snapshot de posições (FIRST) deve ser capturado **antes** de qualquer `setState` ou de qualquer re-render causado por mudança de prop. A forma correta é usar `useLayoutEffect` com `prevPositions` salvo antes de cada atualização.

---

## Critérios de Aceite

- [ ] Palpites listados em ordem decrescente de pontuação efetiva (`live`: calculada no cliente; `finished`: oficial de `scores`)
- [ ] Empates desempatados por nome ascendente (pt-BR), de forma estável
- [ ] Participantes sem palpite sempre ao final da lista em jogos `live` e `finished`
- [ ] Quando a pontuação muda e a ordem é alterada, os cards animam com `translateY` em 350ms (`ease-in-out`)
- [ ] Primeiro render sem animação (itens aparecem na posição final imediatamente)
- [ ] Jogo `pending`: ordenação mantida (quem tem palpite primeiro), sem animação de reordenação
- [ ] Layout visual preservado: mesmas colunas, mesmas cores, mesma tipografia, mesmos paddings
- [ ] Seção de cabeçalho "PALPITES DOS PARTICIPANTES" e badge "AO VIVO" inalterados
- [ ] Rodapé "* PONTUAÇÃO PROVISÓRIA — ATUALIZA EM TEMPO REAL" preservado em `live`
- [ ] Roles ARIA (`role="table"`, `role="row"`, `role="cell"`, `role="columnheader"`) corretos na estrutura de div
- [ ] Nenhuma regressão no placar do jogo (`PublicScoreCard`), status, rodada ou times
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
- [ ] Funciona em mobile (coluna única, `maxWidth: 480px`)
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta `--color-*`, dense, sem border-radius excessivo, sem sombras, dark only
