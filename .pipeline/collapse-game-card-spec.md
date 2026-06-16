# Spec: Colapsar/Expandir Card de Jogo com Palpites dos Participantes

**Slug:** collapse-game-card
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Na tela `/jogos`, cada `GameCard` deve carregar **colapsado** por padrão, ocultando a seção "PALPITES DOS PARTICIPANTES" (`GameParticipantsList`). Um elemento clicável, acessível via teclado, alterna (toggle) a exibição dessa seção por clique — expandindo ao clicar quando colapsado, recolhendo ao clicar novamente quando expandido. O estado de expansão é local a cada card (independente entre jogos) e não deve interromper as subscriptions Realtime já existentes (`useGameRealtime`, `useScoreRealtime`), que devem continuar ativas e atualizando a UI mesmo enquanto o card está colapsado.

Esta é uma feature puramente de UI/interação no client — sem mudança de schema, sem nova migration, sem novo endpoint.

---

## Histórias de Usuário

- Como participante logado, quero ver a aba de jogos com cards compactos por padrão (sem os palpites de todos os participantes expostos de cara) para escanear rapidamente times, horários e placares de muitos jogos no dia.
- Como participante logado, quero clicar em um jogo específico para ver o palpite de cada participante e a pontuação correspondente, sem perder o contexto dos outros jogos na tela.
- Como participante logado, quero poder expandir vários jogos ao mesmo tempo para comparar palpites entre partidas diferentes, sem que abrir um jogo feche outro.
- Como participante logado, quero que, se um jogo que tenho aberto entrar "ao vivo" ou terminar, o placar e a pontuação continuem atualizando em tempo real sem precisar recolher/expandir de novo.
- Como participante usando teclado (acessibilidade), quero conseguir focar no controle de expandir/recolher e ativá-lo com Enter ou Espaço, com indicação visual clara de que é interativo.

---

## Modelo de Dados

### Nenhuma tabela nova ou modificada

Esta feature não toca em `profiles`, `games`, `predictions` ou `scores`. É exclusivamente estado de UI (`useState`) dentro do componente client `GameCard`. **Nenhuma migration é necessária.** Se durante a implementação surgir qualquer necessidade aparente de mudança de schema, isso é um red flag — o Programador deve parar e reportar em vez de seguir adiante.

### RLS

Não aplicável — nenhuma query nova é introduzida.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. A expansão/colapso é estado puramente client-side; os dados de `participants` já chegam via props do Server Component `JogosPage` exatamente como hoje (ver `game-participants-view-spec.md`).

---

## Frontend — Componentes React

### Modificações em `GameCard`

**Arquivo:** `components/games/GameCard.tsx`

**Estado novo:**
```typescript
const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false)
```

- Inicializado sempre como `false` (colapsado) — não há persistência entre re-renders além do ciclo de vida do componente (ver seção "Persistência entre navegações" abaixo).
- `useGameRealtime(game.id, game)` e `useScoreRealtime(game.id, userId ?? '', score)` continuam sendo chamados exatamente onde estão hoje (topo do componente, incondicionalmente). **Não devem ser movidos para dentro de uma renderização condicional** — isso é o que garante que as subscriptions Realtime sobrevivam ao toggle de colapso, pois o `GameCard` em si nunca desmonta; apenas a seção de participantes é condicionalmente renderizada dentro dele.

**Trecho a substituir (linhas 438-446 do arquivo atual):**

```tsx
{/* Seção de palpites de todos os participantes — sempre visível quando há dados */}
{participants.length > 0 && (
  <GameParticipantsList
    participants={participants}
    gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
    currentUserId={userId}
    liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}
  />
)}
```

**Novo comportamento:**

```tsx
{/* Toggle de expansão — só aparece quando há participantes para mostrar */}
{participants.length > 0 && (
  <button
    type="button"
    onClick={() => setIsParticipantsExpanded((prev) => !prev)}
    aria-expanded={isParticipantsExpanded}
    aria-controls={`participants-${liveGame.id}`}
    style={{
      width: '100%',
      borderTop: '1px dashed var(--color-border)',
      background: 'none',
      border: 'none',
      borderTopStyle: 'dashed',
      borderTopWidth: '1px',
      borderTopColor: 'var(--color-border)',
      padding: '0.5rem 0.75rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '0.4rem',
      cursor: 'pointer',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '10px',
      color: 'var(--color-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    }}
  >
    {isParticipantsExpanded ? 'OCULTAR PALPITES ▴' : 'VER PALPITES ▾'}
  </button>
)}

{/* Seção de palpites de todos os participantes — exibida sob demanda via toggle */}
{participants.length > 0 && isParticipantsExpanded && (
  <div id={`participants-${liveGame.id}`}>
    <GameParticipantsList
      participants={participants}
      gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
      currentUserId={userId}
      liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}
    />
  </div>
)}
```

Notas de implementação:
- Usar um elemento `<button type="button">` real (não uma `<div onClick>`) para herdar foco via Tab, ativação por Enter/Espaço e papel semântico `button` gratuitamente, sem precisar adicionar `role`/`tabIndex`/`onKeyDown` manualmente.
- `aria-expanded` reflete o estado atual; `aria-controls` referencia o `id` do container da seção expandida, para leitores de tela associarem o botão ao conteúdo que ele controla.
- O texto do botão muda conforme o estado: `VER PALPITES ▾` quando colapsado, `OCULTAR PALPITES ▴` quando expandido — usar os caracteres ASCII `▾`/`▴` (ou `▾`/`▲`, à escolha do Programador, desde que haja indicador direcional distinto entre os dois estados), consistente com os símbolos ASCII já usados no projeto (`►`, `■`, `✓`) em vez de ícones SVG.
- `cursor: pointer` já é o padrão nativo de `<button>`, mas declarar explicitamente no estilo inline é aceitável para garantir consistência visual com o restante do projeto (que usa `style` inline em vez de classes Tailwind nos componentes de jogo).
- O botão substitui a borda tracejada que hoje abre a seção de participantes (`borderTop: '1px dashed var(--color-border)'` movida do `<div>` do `GameParticipantsList` para o próprio `<button>`); quando a seção está expandida, `GameParticipantsList` mantém sua própria borda interna (`borderTop: '1px dashed var(--color-border)'`, já existente no componente) para separar visualmente o botão da tabela — não remover essa borda do `GameParticipantsList`.
- Quando `participants.length === 0`, nem o botão nem a seção são renderizados — mesmo comportamento de hoje (linha `{participants.length > 0 && (...)}`), apenas estendido com o estado de expansão.

**Nenhuma outra prop ou import precisa ser adicionado** além do `useState` (já importado em `GameCard.tsx`, linha 3).

### `GameParticipantsList` — sem alterações de lógica

**Arquivo:** `components/bolao/GameParticipantsList.tsx`

Nenhuma mudança no componente em si. Ele continua recebendo as mesmas props (`participants`, `gameStatus`, `currentUserId`, `liveGame`) e renderizando exatamente a mesma tabela. A única mudança é **quando** ele é montado/desmontado no DOM — isso é controlado inteiramente pelo `GameCard` pai. Como este componente não usa nenhum hook de Realtime próprio (recebe `liveGame` já resolvido via prop do `GameCard`), desmontá-lo ao colapsar e remontá-lo ao expandir não tem custo de subscription — ele é stateless e puramente apresentacional.

### `GameList` — sem alterações

**Arquivo:** `components/games/GameList.tsx`

Nenhuma mudança necessária. Continua repassando `participants` por jogo ao `GameCard`; o estado de expansão vive inteiramente dentro de cada `GameCard`, sem prop drilling adicional.

### `JogosPage` — sem alterações

**Arquivo:** `app/(dashboard)/jogos/page.tsx`

Nenhuma mudança necessária. A página continua buscando e montando `participantsByGameId` exatamente como hoje.

---

## Regras de Negócio

1. **Estado inicial colapsado:** todo `GameCard` monta com `isParticipantsExpanded = false`. A seção de participantes nunca aparece automaticamente no carregamento da página, independente do status do jogo (`pending`, `live` ou `finished`).

2. **Toggle independente por card:** cada `GameCard` mantém seu próprio estado local de expansão via `useState`. Não existe estado compartilhado/global de "qual jogo está expandido" — múltiplos cards podem estar expandidos simultaneamente, e expandir um não afeta o estado de nenhum outro.
   - **Decisão de UX (Analista):** segue a expectativa padrão do PM — não há necessidade de exclusividade. A tela `/jogos` já lista vários jogos do dia lado a lado em grid (`GameList.tsx`); forçar um "accordion" exclusivo (só um aberto por vez) prejudicaria o caso de uso de comparar palpites entre múltiplos jogos do mesmo dia, que é justamente o motivo de existir o `GameParticipantsList`. Portanto, **toggle 100% independente por card**, sem exceção.

3. **Persistência entre navegações de dia:** ao trocar de dia na navegação (`game-navigation`, setas `◀ ▶`) e eventualmente voltar ao dia anterior, todos os cards devem renderizar novamente colapsados.
   - **Decisão de UX (Analista):** não persistir o estado de expansão entre navegações de dia, nem em `localStorage`/cookie/query param. Justificativa: `GameList`/`JogosPage` é uma Server Component tree que busca os jogos do dia selecionado a cada navegação; trocar de dia desmonta a árvore de `GameCard`s do dia anterior e monta uma nova árvore para o novo dia (chaveada por `game.id`, que é diferente por dia). Como o estado `isParticipantsExpanded` vive dentro do próprio `GameCard` (que desmonta ao trocar de dia), ele naturalmente volta a `false` ao remontar — **nenhum código extra é necessário para garantir isso**; é o comportamento padrão do React ao desmontar/remontar componentes com state local. Não introduzir nenhum mecanismo de persistência (isso seria trabalho adicional não solicitado e contraria a expectativa padrão documentada pelo PM).

4. **Realtime não pode ser interrompido pelo toggle:** `useGameRealtime` e `useScoreRealtime` são chamados no topo do `GameCard`, fora de qualquer bloco condicional ligado a `isParticipantsExpanded`. Colapsar a seção de participantes **não** deve desmontar esses hooks nem encerrar os canais Realtime associados — apenas a renderização de `GameParticipantsList` (puramente apresentacional, sem hooks próprios) é condicionada ao estado de expansão. Resultado prático: mesmo com o card colapsado, se o jogo virar `live` ou tiver o placar atualizado, isso já reflete no header/corpo/footer do card (que são sempre renderizados) — e, se o usuário expandir a seção de participantes a qualquer momento depois, ela já nasce com o `liveGame`/pontuação mais atual, pois lê o mesmo estado (`liveGame`, `liveScore`) que o resto do card já mantém atualizado.

5. **Texto do toggle reflete o estado atual:**
   - Colapsado → `VER PALPITES ▾`
   - Expandido → `OCULTAR PALPITES ▴`

6. **Acessibilidade do toggle:**
   - Elemento real `<button>` (focável nativamente via Tab, ativável via Enter/Espaço sem código adicional).
   - `aria-expanded={isParticipantsExpanded}` atualizado dinamicamente.
   - `aria-controls` apontando para o `id` do container da seção expandida.
   - `cursor: pointer` no estilo (reforço visual, já nativo do `<button>`).

7. **Sem regressão em funcionalidades existentes do card:** header (rodada/data), corpo (bandeiras/times/placar), footer (status badge + sede), área de palpite do usuário (`PredictionForm`/`PredictionDisplay`/`ScoreDisplay`) permanecem exatamente como estão, fora do escopo desta mudança — nenhum desses blocos é tocado.

---

## Proteção de Rotas

Nenhuma mudança. A funcionalidade vive dentro de `/jogos`, já protegida pelo middleware existente (rota do grupo `(dashboard)`).

---

## Integração Supabase Realtime

Nenhum canal novo é criado. Os dois canais já existentes continuam funcionando exatamente como hoje:

- **Canal `game-${gameId}`** (via `useGameRealtime`): evento `UPDATE` em `games`, filtrado por `id=eq.${gameId}`. Atualiza `liveGame` no `GameCard`, que é sempre montado independente do estado de colapso.
- **Canal `score-${gameId}-${userId}`** (via `useScoreRealtime`): evento `*` (INSERT/UPDATE) em `scores`, filtrado por `game_id=eq.${gameId}`. Atualiza `liveScore` no `GameCard`, igualmente sempre montado.

**Garantia desta spec:** nenhum desses dois `useEffect`/canais deve ser colocado atrás de uma condição que dependa de `isParticipantsExpanded`. O Programador deve verificar, após a implementação, que as chamadas a `useGameRealtime` e `useScoreRealtime` no `GameCard` permanecem no mesmo nível (topo do componente, antes do `return`), sem mudança de posição ou condicionamento.

`GameParticipantsList` não usa Realtime — ele é uma função pura de props (`participants`, `gameStatus`, `currentUserId`, `liveGame`), recalculando `livePoints` via `calculateLiveScore()` a cada render. Montar/desmontar esse componente ao expandir/colapsar não tem efeito colateral algum sobre dados ou subscriptions.

---

## Critérios de Aceite

- [ ] Ao carregar `/jogos`, nenhum card exibe a seção "PALPITES DOS PARTICIPANTES" por padrão — apenas header, corpo (times/placar), footer (status/sede) e área de palpite do usuário logado
- [ ] Cada card com `participants.length > 0` exibe um controle clicável com texto `VER PALPITES ▾` abaixo da área de palpite
- [ ] Clicar no controle expande o card, exibindo a tabela de `GameParticipantsList` com palpites e pontuação (ou pontuação provisória, se `live`) de todos os participantes
- [ ] O texto do controle muda para `OCULTAR PALPITES ▴` quando expandido
- [ ] Clicar novamente no controle expandido recolhe a seção, voltando ao estado colapsado, e o texto volta a `VER PALPITES ▾`
- [ ] Expandir um card não afeta o estado de expansão de nenhum outro card na mesma listagem (múltiplos cards podem estar expandidos ao mesmo tempo)
- [ ] O controle é um elemento `<button>` focável via Tab, com `aria-expanded` correto, e ativável via Enter/Espaço
- [ ] Com um card expandido em um jogo `live`, uma atualização de placar via Supabase Realtime (`useGameRealtime`) continua refletindo no placar central do card e na pontuação provisória dentro de `GameParticipantsList`, sem precisar recolher/expandir
- [ ] Colapsar um card não encerra nem reinicia as subscriptions Realtime do jogo (`useGameRealtime`/`useScoreRealtime` continuam no topo do `GameCard`, fora de blocos condicionados ao estado de expansão)
- [ ] Ao trocar de dia na navegação e voltar, todos os cards do dia revisitado aparecem novamente colapsados (nenhum estado de expansão é persistido entre navegações de dia)
- [ ] Nenhuma migration de banco foi criada; nenhum endpoint novo foi criado; nenhuma query nova foi adicionada
- [ ] Funcionalidades existentes do card (navegação dia a dia, placar, `PredictionForm`/`PredictionDisplay`, badge de status AO VIVO/PENDENTE/ENCERRADO, sede, rodada) continuam funcionando sem regressão
- [ ] Quando `participants.length === 0`, nem o botão de toggle nem a seção de participantes são renderizados (mesmo comportamento atual, sem o controle "fantasma")
- [ ] Design segue DESIGN.md: fonte monospace JetBrains Mono, paleta de tokens `color-*`, símbolos ASCII (`▾`/`▴`) em vez de ícones SVG decorativos, bordas simples (`1px dashed var(--color-border)`), sem sombras
- [ ] Funciona em mobile (coluna única, botão de toggle com área de toque adequada, sem overflow horizontal)
- [ ] `npm run lint` e `npm run build` executam sem erros
