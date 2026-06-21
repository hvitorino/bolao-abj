# Changelog: Scouts no Ranking

**Slug:** ranking-scouts
**Branch:** feature/ranking-scouts
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- Migration `supabase/migrations/20260621100000_create_ranking_scouts_function.sql` — cria a função `get_ranking_scouts(p_group_id uuid)` que retorna por participante: `exact_count`, `winner_count`, `miss_count`, `pred_active` e `pred_total`, cruzando `group_members`, `profiles`, `scores`, `predictions` e `games`. Usa `CREATE OR REPLACE` (idempotente), `SECURITY DEFINER`, `STABLE`.

### Backend (Next.js API Route)
- `app/api/ranking/route.ts` — estendido para chamar `get_ranking` e `get_ranking_scouts` em paralelo via `Promise.all`. Após receber os dados, calcula os badges server-side seguindo o algoritmo da spec (thresholds máx/mín, exclusão mútua wally/sumido, `minActive > 0` para sumido ser elegível) e inclui campo `scouts: string[]` em cada entrada do JSON de resposta.

### Frontend (Next.js/React)
- `lib/types/ranking.ts` — adicionado campo `scouts: string[]` à interface `RankingEntry`.
- `components/bolao/ScoutBadges.tsx` — novo componente que renderiza um `<span>` por scout com `title` (tooltip nativo do browser, sem biblioteca externa). Retorna `null` para arrays vazios ou `undefined`. Layout `inline-flex` com `flexShrink: 0` para ter prioridade sobre o texto no espaço disponível.
- `components/bolao/RankingRow.tsx` — importa `ScoutBadges` e o insere na célula PARTICIPANTE após o nome e o sufixo "(VOCÊ)", usando `entry.scouts ?? []` como prop.

---

## Decisões técnicas

- **Cálculo de badges no servidor:** mantém o contrato do frontend simples (apenas consume `scouts: string[]`) e centraliza a lógica de negócio no backend, onde os dados já estão disponíveis após as duas RPCs.
- **`Promise.all` para as duas RPCs:** evita N+1 e adiciona latência mínima (~0ms extra vs. chamada serial).
- **`min_active > 0` para "sumido":** impede que o scout seja atribuído quando nenhum jogo está live/finished ainda (todos teriam `pred_active = 0`, o que não configura comportamento de "sumido").
- **Tooltip nativo (`title`):** consistente com DESIGN.md (sem bibliotecas externas, sem SVGs decorativos). Funciona em desktop com hover e em mobile com long press (comportamento padrão do browser).
- **`flexShrink: 0` nos badges:** garante que os emojis não sejam comprimidos pelo `whiteSpace: nowrap` + `textOverflow: ellipsis` da célula — o nome é que será truncado, não os badges.

---

## Pontos de atenção para o Revisor

1. **Casos extremos do cálculo de scouts:** verificar que `min_active = 0` não atribui "sumido" a ninguém, e que todos com `pred_total = 0` recebem apenas "onde_esta_wally".
2. **`breakdown` nulo em scores:** a função SQL usa `(s.breakdown->>'winner')::int > 0` — se `breakdown` for `NULL` em algum score legado, a expressão avalia como `NULL` (não entra no `LEFT JOIN`), o que é o comportamento correto.
3. **Layout mobile (375px):** `whiteSpace: nowrap` na célula PARTICIPANTE pode cortar badges em nomes muito longos — aceitável conforme spec (tooltip garante acesso ao significado).
4. **Realtime:** nenhuma mudança necessária — `useRankingRealtime` já refaz fetch do endpoint ao detectar mudanças em `scores`, o que inclui os scouts recalculados.

---

## Commits realizados

```
5efb2db feat(ranking-scouts): integra ScoutBadges na célula PARTICIPANTE do RankingRow
695b013 feat(ranking-scouts): cria componente ScoutBadges com tooltip nativo
aa07f05 feat(ranking-scouts): atualiza endpoint /api/ranking para calcular e retornar scouts
7927f67 feat(ranking-scouts): adiciona campo scouts à interface RankingEntry
928bd8b feat(ranking-scouts): adiciona migration com função get_ranking_scouts
f3145e7 chore(ranking-scouts): adiciona plano de implementação
```
