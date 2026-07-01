# Changelog: Correção do Chaveamento (Cruzamentos + Layout Simétrico)

**Slug:** fix-chaveamento
**Branch:** feature/fix-chaveamento
**Data:** 2026-07-01
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql` — UPDATEs idempotentes que corrigem:
  - `next_slot_label` de 10 slots R32 incorretos (R32-02, R32-03, R32-04, R32-05, R32-09, R32-10, R32-11, R32-12, R32-13, R32-16)
  - `source_home`/`source_away` de 7 slots R16 incorretos (R16-01, R16-02, R16-03, R16-05, R16-06, R16-07, R16-08)
  - Resultado: chaveamento reflete o oficial FIFA 2026 com cruzamentos não-sequenciais

### Frontend (Next.js/React)
- `components/bolao/BracketTree.tsx` — três adições ao componente:

  **1. `BracketConnector` — prop `reversed?: boolean`**
  - Quando `reversed={true}`, inverte as coordenadas x do SVG: linhas para filhos vão de `x=12` até `x=6` (em vez de `x=0` a `x=6`) e linha para o pai vai de `x=6` até `x=0` (em vez de `x=12`). Barra vertical permanece inalterada (`x=6`).

  **2. Novo `BracketColumnRight`**
  - Espelho de `BracketColumn` para a chave direita do bracket. Renderiza: card do nó à esquerda → `BracketConnector reversed` → filhos à direita (recursão com `BracketColumnRight`). Base sem filhos: idêntico a `BracketColumn`.

  **3. Novo `SymmetricBracket` (substitui `FinalAnd3rdColumn`)**
  - Recebe `finalRoot` e `thirdRoot`. Identifica `sf01 = finalRoot.children[0]` e `sf02 = finalRoot.children[1]`.
  - Layout: `BracketColumn(sf01)` | conector 8px | FINAL+3RD ao centro (empilhados) | conector 8px | `BracketColumnRight(sf02)`.
  - Fallback de segurança: se `finalRoot.children.length < 2`, renderiza o layout anterior (equivalente ao `FinalAnd3rdColumn` antigo).

---

## Decisões técnicas

- **Migration idempotente**: os UPDATEs usam `WHERE label = '...'` que é unique na tabela — podem ser re-executados sem efeito colateral.
- **`FinalAnd3rdColumn` removido**: substituído completamente por `SymmetricBracket`. O componente não era usado em nenhum outro lugar além do render de `BracketTree`.
- **Fallback no `SymmetricBracket`**: protege contra estado intermediário do banco onde `FINAL` ainda não tem 2 filhos (ex: durante seeding parcial ou erro de dados).
- **Sem alteração em `lib/bracket.ts`**: a lógica de `buildBracketTree` usa `next_slot_label` para montar a hierarquia — após a migration corrigir os dados, a árvore refletirá automaticamente o chaveamento correto.
- **Sem alteração em `app/(dashboard)/chaveamento/page.tsx`**: fetch e montagem permanecem inalterados.
- **Scroll horizontal, drawer e predictionMap**: todos preservados sem modificação.

---

## Pontos de atenção para o Revisor

1. **Migration**: verificar se os 10 R32 e 7 R16 UPDATE statements cobrem exatamente os slots listados na spec (tabelas de correção).
2. **`BracketConnector reversed`**: confirmar que `parentX = 0` e `childX = 12` estão corretos para o lado direito espelhado (parent à esquerda, filhos à direita).
3. **`SymmetricBracket`**: confirmar que `sf01 = finalRoot.children[0]` e `sf02 = finalRoot.children[1]` está alinhado com a ordem que `buildBracketTree` retorna (SF-01 primeiro, SF-02 segundo).
4. **Clique em cards**: `onGameClick` é delegado corretamente para `BracketColumnRight` e `SymmetricBracket` — não houve quebra de prop drilling.
5. **Build**: `npm run build` passa sem erros novos. Os 10 erros de lint são pré-existentes em outros arquivos.

---

## Commits realizados

```
ef16df6 feat(fix-chaveamento): adiciona BracketColumnRight, SymmetricBracket e substitui FinalAnd3rdColumn pelo layout simetrico
45fc860 feat(fix-chaveamento): migration SQL corrige pareamentos R32/R16 para chaveamento oficial FIFA 2026
eae3c6b chore(fix-chaveamento): adiciona plano de implementação
```
