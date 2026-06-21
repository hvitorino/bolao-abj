# Fix 1: Ranking por Rodada

**Slug:** ranking-por-rodada
**Data:** 2026-06-21
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `__noop__` causa fetch desnecessário no mount
**Arquivo:** `lib/hooks/useRoundRanking.ts` (linha 102–105)
**Severidade:** importante
**Descrição:** O hook `useRoundRanking` sempre instancia `useRankingByRound` (necessário por regras de hooks), passando `'__noop__'` como `round` quando `selectedRound === 'GERAL'`. O `useEffect` interno de `useRankingByRound` dispara um fetch para `/api/ranking?group_id=...&round=__noop__` no mount. O backend verifica `if (round && round !== 'GERAL')` — a string `'__noop__'` satisfaz esse predicado — e chama `get_ranking_by_round(group_id, '__noop__')`. O resultado é descartado pelo `useRoundRanking` (pois `selectedRound === 'GERAL'`), mas o request HTTP e a execução da RPC no banco acontecem desnecessariamente toda vez que a página de ranking é carregada.
**Correção esperada:** Adicionar um guard dentro de `useRankingByRound` para não fazer fetch quando `round` for a string sentinela. A forma mais simples é verificar no início do `fetchRankingByRound` e do `useEffect`:

```typescript
// No início de fetchRankingByRound:
if (round === '__noop__') {
  setLoading(false)
  return
}
```

Alternativamente, iniciar o estado `loading` como `false` quando `round === '__noop__'` via `useState(round === '__noop__' ? false : true)` e pular o efeito com um early return no useEffect.

A solução mais limpa é usar `useState(false)` como estado inicial de `loading` em `useRankingByRound` e adicionar um early return no `useEffect` quando `round === '__noop__'`:

```typescript
// useRankingByRound:
const [loading, setLoading] = useState(false)  // começa false

useEffect(() => {
  if (round === '__noop__') return  // ← guard: não faz fetch no modo GERAL
  const timer = window.setTimeout(() => {
    void fetchRankingByRound()
  }, 0)
  return () => window.clearTimeout(timer)
}, [fetchRankingByRound, round])
```

Isso elimina o fetch desnecessário sem alterar o comportamento funcional (o resultado de `roundResult` é descartado quando `selectedRound === 'GERAL'` de qualquer forma).

---

### Problema 2: Prop `selectedRound` declarada na interface mas não utilizada
**Arquivo:** `components/bolao/RankingTable.tsx` (linhas 13 e 57)
**Severidade:** menor
**Descrição:** A interface `RankingTableProps` declara `selectedRound?: string`, mas a função `RankingTable` não desestrutura nem utiliza essa prop. A spec define que "a prop `selectedRound` inicializa o estado interno — se não for fornecida, usa `'GERAL'`". A prop é dead code e pode gerar confusão para quem tentar usá-la esperando que funcione.
**Correção esperada:** Remover a prop da interface, pois o estado interno sempre começa em `'GERAL'` e a página de ranking não precisa inicializar de outra forma. Alternativamente, se o inicializador externo for necessário no futuro, passar a prop ao `useState` do hook. Como a página atual não usa a prop e a spec não exige que seja usada externamente neste momento, a remoção é a ação mais segura:

```typescript
// Remover da interface:
interface RankingTableProps {
  currentUserId: string
  groupId: string
  // selectedRound?: string  ← remover
}
```

---

## Itens OK (não precisam ser revisados novamente)

- Migration SQL (`supabase/migrations/20260621200000_ranking_by_round.sql`): predicado `AND (s.game_id IS NULL OR g.round = p_round)` correto
- `get_available_rounds` com JOIN em `predictions.group_id` — coluna existe e é NOT NULL
- Autenticação JWT + verificação de membership em ambos os endpoints (`/api/ranking` e `/api/ranking/rounds`)
- `RoundChips.tsx`: borderRadius 0, font monospace 11px uppercase, scroll horizontal sem barra visível, `ROUND_ORDER` idêntico à spec
- Modo GERAL: delegação ao `useRankingRealtime` sem regressão
- `RoundChips` posicionado acima do border da tabela
- Subtítulo "FASE: X" exibido apenas no modo por rodada
- Coluna PALP. oculta no modo por rodada via prop `hidePalpites` em `RankingRow`
- Scouts ocultos no modo por rodada via prop `hideScouts` em `RankingRow`
- Live points ignorados no modo por rodada
- `lastUpdatedAt` no rodapé oculto no modo por rodada (`{lastUpdatedAt && !isRoundMode && ...}`)
- Design conforme DESIGN.md (paleta, tipografia monospace, sem sombras, bordas simples, PT-BR)
- `npm run build` passa sem erros novos
- `npm run lint` — 6 problemas (2 erros, 4 warnings), todos pré-existentes em `group-switcher.tsx` e `GroupChatWidget.tsx`, nenhum introduzido pela feature
- Commits em português com prefixo correto (`feat`, `chore`)
- Branch `feature/ranking-por-rodada`
