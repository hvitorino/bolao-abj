# Spec: Correção do Chaveamento (Cruzamentos + Layout Simétrico)

**Slug:** fix-chaveamento
**Data:** 2026-07-01
**Status:** spec

---

## Objetivo

Corrigir dois problemas independentes na tela de chaveamento (`/chaveamento` e inline em `/palpites`):

1. **Cruzamentos incorretos nos dados**: a tabela `bracket_slots` foi seedada com pareamento sequencial (R32-01+02→R16-01, R32-03+04→R16-02…), mas o chaveamento oficial da FIFA 2026 usa pareamentos não sequenciais. Os campos `next_slot_label` e `source_home`/`source_away` dos slots R32 e R16 divergem do oficial.

2. **Layout visual errado**: a visualização atual cresce da esquerda para a direita (R32 à esq → Final à dir). O layout correto é o clássico simétrico: chave esquerda | FINAL+3º LUGAR ao centro | chave direita espelhada.

---

## Histórias de Usuário

- Como participante do bolão, quero ver o chaveamento com os cruzamentos corretos conforme o oficial da FIFA 2026, para saber quais times realmente se enfrentam em cada rodada eliminatória
- Como participante do bolão, quero ver o bracket no layout simétrico clássico (chave esquerda | Final ao centro | chave direita espelhada), para ter a mesma leitura de um chaveamento de torneio impresso
- Como usuário mobile, quero scroll horizontal no chaveamento, para ver toda a árvore sem perder informação
- Como participante do bolão, quero clicar em qualquer card do chaveamento e abrir a análise do confronto, para que a funcionalidade existente não regridir

---

## Modelo de Dados

### Tabelas modificadas

Nenhuma tabela nova. Somente UPDATE nos registros existentes de `bracket_slots`.

Campos atualizados:
- `next_slot_label text` — aponta para qual slot o vencedor deste jogo avança
- `source_home text` — descrição do time que jogará como mandante (ex: "Venc. R32-01")
- `source_away text` — descrição do time que jogará como visitante (ex: "Venc. R32-03")

### Migrations necessárias

**Arquivo:** `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql`

A migration executa UPDATEs idempotentes (por `label`) corrigindo:

**Correções de `next_slot_label` nos slots R32** (só os incorretos):

| label | next atual | next correto |
|-------|-----------|--------------|
| R32-02 | R16-01 | R16-02 |
| R32-03 | R16-02 | R16-01 |
| R32-04 | R16-02 | R16-03 |
| R32-05 | R16-03 | R16-02 |
| R32-09 | R16-05 | R16-06 |
| R32-10 | R16-05 | R16-06 |
| R32-11 | R16-06 | R16-05 |
| R32-12 | R16-06 | R16-05 |
| R32-13 | R16-07 | R16-08 |
| R32-16 | R16-08 | R16-07 |

(R32-01, R32-06, R32-07, R32-08, R32-14, R32-15 já estão corretos — não tocar.)

**Correções de `source_home`/`source_away` nos slots R16**:

| label | source_home correto | source_away correto |
|-------|---------------------|---------------------|
| R16-01 | Venc. R32-01 | Venc. R32-03 |
| R16-02 | Venc. R32-02 | Venc. R32-05 |
| R16-03 | Venc. R32-04 | Venc. R32-06 |
| R16-05 | Venc. R32-11 | Venc. R32-12 |
| R16-06 | Venc. R32-09 | Venc. R32-10 |
| R16-07 | Venc. R32-14 | Venc. R32-16 |
| R16-08 | Venc. R32-13 | Venc. R32-15 |

(R16-04 já está correto — não tocar. QF/SF/FINAL não precisam de mudança.)

**Estrutura correta após a fix:**
- Chave esquerda (→ SF-01): R32-01,03 → R16-01; R32-02,05 → R16-02; R32-04,06 → R16-03; R32-07,08 → R16-04 → QF-01,02 → SF-01
- Chave direita (→ SF-02): R32-11,12 → R16-05; R32-09,10 → R16-06; R32-14,16 → R16-07; R32-13,15 → R16-08 → QF-03,04 → SF-02

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado. A feature é puramente de dados (migration SQL) e de apresentação (componente React).

---

## Frontend — Componentes React

### BracketTree (modificação do existente)

**Arquivo:** `components/bolao/BracketTree.tsx`

Todos os helpers existentes são preservados sem alteração: `CARD_H`, `CHILD_GAP`, `PARENT_CARD_H`, `PARENT_GAP`, `winnerCode`, `sideLabel`, `gameCode`, `scoreStr`, `slotStatus`, `columnHeight`, `predictionColor`, `CompactSlotCard`, `PhaseLabel`. A lógica de `lib/bracket.ts` e `app/(dashboard)/chaveamento/page.tsx` não muda.

**Mudanças específicas no componente:**

#### 1. Novo prop `reversed` no `BracketConnector`

Adicionar prop opcional `reversed?: boolean` ao `BracketConnector`. Quando `reversed={true}`, inverter as coordenadas x das linhas horizontais no SVG:

- Linhas para filhos (child lines): `x1=12, x2=6` (em vez de `x1=0, x2=6`)
- Linha para o pai (parent line): `x1=0` (em vez de `x1=12`)
- Barra vertical: permanece `x1=6, x2=6` (inalterada)

Interface atualizada:
```typescript
function BracketConnector({
  node,
  parentCount = 1,
  reversed = false,
}: {
  node: BracketSlotWithGame
  parentCount?: number
  reversed?: boolean
})
```

#### 2. Novo componente `BracketColumnRight`

Espelho de `BracketColumn` para a chave direita. A diferença é a ordem de renderização e o uso de `BracketConnector` com `reversed={true}`:

```
[children (BracketColumnRight recursivo)] → [BracketConnector reversed] → [card + PhaseLabel]
```

Em vez da ordem esquerda (`BracketColumn`):
```
[children] → [BracketConnector] → [card + PhaseLabel]
```

Interface idêntica à `BracketColumn`:
```typescript
function BracketColumnRight({
  node,
  predictionMap,
  onGameClick,
}: {
  node: BracketSlotWithGame
  predictionMap: Record<string, Prediction>
  onGameClick?: (gameId: string) => void
})
```

Comportamento de base (sem filhos): idêntico a `BracketColumn` — renderiza apenas o `CompactSlotCard` com `alignItems: 'center'`.

Comportamento recursivo: ordem invertida — os filhos ficam à **direita** e o card do nó fica à **esquerda**:
```tsx
<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
  {/* Current node card (left) */}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <PhaseLabel text={node.phase} />
    <CompactSlotCard ... />
  </div>

  {/* Connector lines (reversed) */}
  <BracketConnector node={node} reversed={true} />

  {/* Children column (right) */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: `${CHILD_GAP}px`, alignItems: 'stretch' }}>
    {node.children.map((child) => (
      <BracketColumnRight key={child.id} node={child} predictionMap={predictionMap} onGameClick={onGameClick} />
    ))}
  </div>
</div>
```

#### 3. Novo componente `SymmetricBracket`

Substitui `FinalAnd3rdColumn` como componente de renderização de alto nível. Recebe `finalRoot`, `thirdRoot` e os SFs como filhos diretos:

```typescript
function SymmetricBracket({
  finalRoot,
  thirdRoot,
  predictionMap,
  onGameClick,
}: {
  finalRoot: BracketSlotWithGame
  thirdRoot: BracketSlotWithGame
  predictionMap: Record<string, Prediction>
  onGameClick?: (gameId: string) => void
})
```

Lógica: identificar `sf01 = finalRoot.children[0]` e `sf02 = finalRoot.children[1]`.

Layout:
```tsx
<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
  {/* Chave esquerda: SF-01 e toda a subárvore (QF→R16→R32) */}
  <BracketColumn node={sf01} predictionMap={predictionMap} onGameClick={onGameClick} />

  {/* Conector esquerdo SF→FINAL (linha horizontal simples) */}
  <div style={{ width: 8, height: 1, flexShrink: 0, background: 'var(--color-border)' }} />

  {/* Centro: FINAL + 3º LUGAR empilhados */}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <PhaseLabel text={finalRoot.phase} />
      <CompactSlotCard slot={finalRoot} prediction={finalRoot.game ? predictionMap[finalRoot.game.id] : undefined} onGameClick={onGameClick} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <PhaseLabel text={thirdRoot.phase} />
      <CompactSlotCard slot={thirdRoot} prediction={thirdRoot.game ? predictionMap[thirdRoot.game.id] : undefined} onGameClick={onGameClick} />
    </div>
  </div>

  {/* Conector FINAL→direita (linha horizontal simples) */}
  <div style={{ width: 8, height: 1, flexShrink: 0, background: 'var(--color-border)' }} />

  {/* Chave direita: SF-02 e toda a subárvore (QF→R16→R32), espelhada */}
  <BracketColumnRight node={sf02} predictionMap={predictionMap} onGameClick={onGameClick} />
</div>
```

**Fallback de segurança**: se `finalRoot.children.length < 2`, renderizar o layout antigo (`FinalAnd3rdColumn`) sem quebrar.

#### 4. `BracketTree` (componente público) — substituição de `FinalAnd3rdColumn`

No render do componente público `BracketTree`, substituir a chamada de `FinalAnd3rdColumn` por `SymmetricBracket`:

```tsx
{/* Antes: */}
{finalRoot && thirdRoot && (
  <FinalAnd3rdColumn final={finalRoot} third={thirdRoot} ... />
)}

{/* Depois: */}
{finalRoot && thirdRoot && (
  <SymmetricBracket finalRoot={finalRoot} thirdRoot={thirdRoot} ... />
)}
```

Manter os fallbacks para `finalRoot && !thirdRoot` e `thirdRoot && !finalRoot` com `BracketColumn` — sem alteração.

O scroll horizontal (`bracket-scroll`, `overflowX: 'auto'`, `scrollbarWidth: 'none'`), o `GameAnaliseDrawer` e o `handlePredictionSubmitted` permanecem inalterados.

**Estados:**
- `empty`: mensagem "NENHUM SLOT DE CHAVEAMENTO ENCONTRADO" (inalterado)
- `populated`: layout simétrico descrito acima
- `loading`/`error`: gerenciados pela `page.tsx` (sem mudança neste componente)

**Supabase Realtime:** não aplicável a este componente.

---

## Regras de Negócio

Nenhuma regra de negócio nova. As regras de pontuação, deadline de palpites e visibilidade temporal permanecem inalteradas. A correção é estritamente de dados (SQL) e de apresentação (layout visual).

A lógica de construção da árvore em `lib/bracket.ts` (`buildBracketTree`) usa `next_slot_label` para montar a hierarquia. Após a migration corrigir os `next_slot_label` dos R32s e os `source_home`/`source_away` dos R16s, a árvore montada por `buildBracketTree` refletirá automaticamente o chaveamento correto — sem alteração em `lib/bracket.ts`.

---

## Proteção de Rotas

Nenhuma mudança. `/chaveamento` já está protegida via `(dashboard)` route group. `/palpites` (que usa `BracketTree` inline via `inline-bracket-expand`) também está protegida.

---

## Integração Supabase Realtime

Não aplicável a esta feature. Nenhum canal novo ou modificado.

---

## Arquivos a modificar

| Arquivo | Tipo de mudança |
|---------|----------------|
| `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql` | Novo — corrige `next_slot_label` e `source_home`/`source_away` |
| `components/bolao/BracketTree.tsx` | Modifica — adiciona `reversed` em `BracketConnector`, adiciona `BracketColumnRight`, adiciona `SymmetricBracket`, substitui `FinalAnd3rdColumn` no render de `BracketTree` |

**Arquivos que NÃO devem ser alterados:**
- `lib/bracket.ts` — lógica de árvore continua correta
- `app/(dashboard)/chaveamento/page.tsx` — fetch e montagem continuam iguais
- `lib/types/game.ts` — nenhum tipo novo necessário

---

## Critérios de Aceite

- [ ] Migration `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql` criada com UPDATEs corretos para `next_slot_label` dos 10 slots R32 incorretos e `source_home`/`source_away` dos 7 slots R16 incorretos
- [ ] `BracketConnector` aceita prop `reversed?: boolean` e inverte coordenadas x quando `true`
- [ ] `BracketColumnRight` renderiza nós em ordem invertida (card à esquerda, filhos à direita, conector `reversed`)
- [ ] `SymmetricBracket` identifica `sf01`/`sf02` como filhos do `finalRoot` e renderiza: chave esquerda (`BracketColumn(sf01)`) | FINAL+3RD ao centro | chave direita espelhada (`BracketColumnRight(sf02)`)
- [ ] `FinalAnd3rdColumn` substituído por `SymmetricBracket` no render de `BracketTree`
- [ ] Scroll horizontal funciona em mobile (viewport 375px) — o `bracket-scroll` existente não é alterado
- [ ] Clique em qualquer card com jogo continua abrindo o `GameAnaliseDrawer` sem regressão
- [ ] `BracketTree` embutido em `/palpites` via `inline-bracket-expand` continua funcionando (prop `onGameClick` delegada ao drawer do pai)
- [ ] Design segue DESIGN.md: JetBrains Mono, tokens `var(--color-*)`, dense, dark only, sem border-radius excessivo
- [ ] `npm run lint` e `npm run build` passam sem erros novos
