# Fix 1: Redesign da Aba de Perfil

**Slug:** `perfil-redesign`
**Data:** 2026-06-21
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Líder nunca vê "+N SOBRE O 2º"
**Arquivo:** `app/api/profile/campaign/route.ts` (linha 140)
**Severidade:** importante

**Descrição:**
Quando `is_leader = true`, o servidor retorna `next_above_points: null` (linha 140). O componente `CampaignPanel` usa esse campo para renderizar `· +{total_points - next_above_points} SOBRE O 2º` (linhas 163–166). Como `next_above_points` é sempre `null` para o líder, a condição `next_above_points !== null` é sempre `false` — o texto "+N SOBRE O 2º" nunca aparece. O líder vê apenas `LÍDER 🟡` sem o diferencial.

A spec e o design aprovado exigem: `LÍDER 🟡 · +{delta} SOBRE O 2º`.

**Correção esperada:**
No route `campaign/route.ts`, quando `isLeader = true`, buscar os pontos do participante na posição 2 (o segundo colocado) e retorná-los num campo próprio. A forma mais limpa é reutilizar `next_above_points` para conter os pontos do 2º quando o usuário é o líder — semanticamente "próximo abaixo" neste contexto — ou adicionar campo `second_place_points`.

Sugestão de implementação no route (substituir o bloco a partir da linha 100):

```typescript
let nextAbovePoints: number | null = null
if (isLeader) {
  // Para o líder, "próximo" é o 2º colocado
  const secondRow = ranking.find(
    (r: { rank_position: number }) => Number(r.rank_position) === 2
  )
  nextAbovePoints = secondRow ? Number(secondRow.total_points) : null
} else {
  const above = ranking.find(
    (r: { rank_position: number }) => Number(r.rank_position) === currentPosition - 1
  )
  nextAbovePoints = above ? Number(above.total_points) : null
}
```

E na linha 140, remover a supressão condicional:
```typescript
next_above_points: nextAbovePoints,  // nunca null exceto se só há 1 participante
```

O componente `CampaignPanel.tsx` não precisa de alteração — a lógica de exibição já está correta para quando `next_above_points !== null`.

---

### Problema 2: Progresso do troféu PROFETA pode exceder o máximo (progress > max)
**Arquivo:** `app/api/profile/trophies/route.ts` (linha 403)
**Severidade:** menor

**Descrição:**
`makeTrophy('profeta', profetaAt, cravadaCount, 5)` usa `cravadaCount` como valor de progresso para o troféu PROFETA. `cravadaCount` é o resultado de `cravadaRes`, que busca **todos** os placares exatos sem `LIMIT`. Se o usuário tiver 7 placares exatos, `cravadaCount = 7` e o troféu PROFETA exibiria `7/5 █████` — progresso maior que o máximo, o que é visualmente inválido.

O changelog menciona que "a duplicação é intencional", mas a consequência de `progress > max` não foi considerada.

**Correção esperada:**
Aplicar `Math.min` para garantir que o progress nunca exceda o max:

```typescript
makeTrophy('profeta', profetaAt, Math.min(cravadaCount, 5), 5),
```

---

## Itens OK (não precisam ser revisados novamente)

- Migrations `20260622000001` a `20260622000004`: tabela, funções, trigger e RLS corretos — idênticos à spec.
- Autenticação Bearer JWT em todos os 4 Route Handlers: correto.
- Verificação de membership (403) em todos os handlers: correto.
- TypeScript: zero erros de compilação (`npx tsc --noEmit` sem output).
- ESLint: zero warnings nos arquivos novos.
- Design: JetBrains Mono em todos os componentes, `borderRadius: 0`, `boxShadow: 'none'`, tokens CSS da bandeira, sem SVG decorativo, interface em português.
- `ProfileStats.tsx` e `/api/profile/stats` mantidos (deprecados, não deletados).
- `SectionState<T>` com loading/error por seção independente: correto.
- Fetch paralelo das 4 seções no `useEffect`: correto.
- Paginação do histórico com `handleLoadMore` e concatenação (sem substituição): correto.
- Troféus: 15 implementados, ordenação unlocked → locked → secret, accordion inline sem modal.
- SECRET_TROPHIES correto: inclui `estreia`, `abriu_o_placar`, `rei_da_goleada`, `perfeito_na_rodada`, `cartola`, `zebreiro`, `podio`. Exclui `fiel` corretamente (locked+progress).
- `get_profile_history`: SQL correto com LEFT JOIN para is_miss, paginação, ordem DESC.
- Lógica de `position_delta`: cálculo `prevPosition - currentPosition` (positivo = subiu) correto.
- Label do delta zero: `= mesma posição` correto.
- Limite de 50 items no histórico com 422 quando inválido: correto.
- Mobile first: `maxWidth: 600px` no page wrapper, `flexWrap: wrap` nos painéis: correto.
- Prop `trophies` em `HistoryPanel` declarada mas não utilizada: inofensivo (backend calcula `trophy_unlocked_id`); não precisa ser corrigido.
