# Plano: Correção do Chaveamento (Cruzamentos + Layout Simétrico)

## Contexto

A tela de chaveamento (`/chaveamento`) tem dois problemas:
1. **Cruzamentos incorretos**: os slots `bracket_slots` foram seedados com pareamento sequencial (R32-01+02→R16-01, R32-03+04→R16-02…), mas o chaveamento oficial da FIFA 2026 usa pareamentos não sequenciais. O resultado é que a árvore visual mostra os jogadores errados se encontrando nas oitavas.
2. **Layout errado**: a visualização cresce da esquerda para a direita (R32 à esq → Final à dir). O usuário quer o layout clássico simétrico: chave esquerda | Final ao centro | chave direita espelhada.

## Parte 1 — Correção dos Dados (SQL Migration)

**Arquivo**: `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql`

### Correções de `next_slot_label` nos slots R32

Mapeamento real (da sincronização ESPN + dados dos jogos do banco):

| Slot | Time | next atual | next correto |
|------|------|-----------|--------------|
| R32-02 | NED×MAR | R16-01 | R16-02 |
| R32-03 | GER×PAR | R16-02 | R16-01 |
| R32-04 | FRA×SWE | R16-02 | R16-03 |
| R32-05 | BRA×JPN | R16-03 | R16-02 |
| R32-09 | POR×CRO | R16-05 | R16-06 |
| R32-10 | ESP×AUT | R16-05 | R16-06 |
| R32-11 | USA×BIH | R16-06 | R16-05 |
| R32-12 | BEL×SEN | R16-06 | R16-05 |
| R32-13 | ARG×CPV | R16-07 | R16-08 |
| R32-16 | COL×GHA | R16-08 | R16-07 |

(R32-01, 06, 07, 08, 14, 15 já estão corretos.)

### Correções de `source_home`/`source_away` nos slots R16

| Slot | source_home atual | source_away atual | source_home correto | source_away correto |
|------|------------------|-------------------|---------------------|---------------------|
| R16-01 | Venc. R32-01 | Venc. R32-02 | Venc. R32-01 | Venc. R32-03 |
| R16-02 | Venc. R32-03 | Venc. R32-04 | Venc. R32-02 | Venc. R32-05 |
| R16-03 | Venc. R32-05 | Venc. R32-06 | Venc. R32-04 | Venc. R32-06 |
| R16-05 | Venc. R32-09 | Venc. R32-10 | Venc. R32-11 | Venc. R32-12 |
| R16-06 | Venc. R32-11 | Venc. R32-12 | Venc. R32-09 | Venc. R32-10 |
| R16-07 | Venc. R32-13 | Venc. R32-14 | Venc. R32-14 | Venc. R32-16 |
| R16-08 | Venc. R32-15 | Venc. R32-16 | Venc. R32-13 | Venc. R32-15 |

(R16-04 já está correto; QF/SF/FINAL não precisam mudar.)

### Estrutura correta após a fix

Chave esquerda (→ SF-01): R32-01,03 → R16-01; R32-02,05 → R16-02; R32-04,06 → R16-03; R32-07,08 → R16-04 → QF-01,02 → SF-01  
Chave direita (→ SF-02): R32-11,12 → R16-05; R32-09,10 → R16-06; R32-14,16 → R16-07; R32-13,15 → R16-08 → QF-03,04 → SF-02

---

## Parte 2 — Layout Simétrico (`BracketTree.tsx`)

**Arquivo**: `components/bolao/BracketTree.tsx`

### Layout alvo

```
[R32][R16][QF][SF-01] | [FINAL + 3RD] | [SF-02][QF][R16][R32]
    chave esquerda     |    centro      |    chave direita (espelhada)
```

### Mudanças no componente

**1. `BracketConnector` — novo prop `reversed`**

Quando `reversed={true}`, inverte as coordenadas x do SVG:
- Child lines: `x1=12, x2=6` (em vez de `x1=0, x2=6`)
- Parent line: `x1=0` (em vez de `x1=12`)
- Vertical bar: permanece `x1=6, x2=6`

**2. Novo componente `BracketColumnRight`**

Espelho de `BracketColumn` para a chave direita:
```
[card + PhaseLabel] | [BracketConnector reversed] | [children (BracketColumnRight)]
```
Mesma lógica de `columnHeight`, `predictionColor`, etc. A única diferença é a ordem e o `BracketConnector reversed={true}`.

**3. Novo componente `SymmetricBracket` (substitui o render atual)**

Identifica `sf01 = finalRoot.children[0]` e `sf02 = finalRoot.children[1]`:
```tsx
<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
  {/* Chave esquerda: SF-01 e toda a sua subárvore (QF→R16→R32) */}
  <BracketColumn node={sf01} ... />

  {/* Conector esquerdo → Final */}
  <div style={{ width: 8, height: 1, background: 'var(--color-border)' }} />

  {/* Centro: FINAL + 3RD empilhados */}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
    <div><PhaseLabel text="FINAL" /><CompactSlotCard slot={finalRoot} /></div>
    <div><PhaseLabel text="3º LUGAR" /><CompactSlotCard slot={thirdRoot} /></div>
  </div>

  {/* Conector Final → direita */}
  <div style={{ width: 8, height: 1, background: 'var(--color-border)' }} />

  {/* Chave direita: SF-02 e toda a sua subárvore (QF→R16→R32), espelhada */}
  <BracketColumnRight node={sf02} ... />
</div>
```

**4. `BracketTree` (componente público)**

Substitui `FinalAnd3rdColumn` pelo `SymmetricBracket`. Mantém scroll horizontal, drawer de análise e sincronização de predictions.

`PHASE_ORDER` e demais helpers (`slotStatus`, `predictionColor`, `scoreStr`) permanecem inalterados.

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql` | Novo — corrige next_slot_label e source texts |
| `components/bolao/BracketTree.tsx` | Modifica — layout simétrico |
| `lib/bracket.ts` | Sem mudança (lógica de árvore continua correta) |
| `app/(dashboard)/chaveamento/page.tsx` | Sem mudança (fetch e montagem continuam iguais) |

---

## Verificação

1. Executar a migration via `supabase db push` ou interface do Supabase
2. Abrir `/chaveamento` no browser
3. Confirmar que:
   - A chave esquerda mostra RSA/CAN+GER/PAR → R16-01, NED/MAR+BRA/JPN → R16-02, etc.
   - A chave direita (espelhada) mostra SF-02 adjacente ao centro, crescendo para a direita
   - FINAL e 3º LUGAR aparecem no centro
   - Scroll horizontal funciona em mobile
   - Clique nos cards ainda abre o `GameAnaliseDrawer`
