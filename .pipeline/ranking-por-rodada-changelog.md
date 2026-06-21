# Changelog: Ranking por Rodada

**Slug:** ranking-por-rodada
**Branch:** feature/ranking-por-rodada
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- `supabase/migrations/20260621200000_ranking_by_round.sql` — cria duas funções Postgres:
  - `get_ranking_by_round(p_group_id uuid, p_round text)` — ranking filtrado por fase, com `RANK() OVER` e LEFT JOIN em `games` para garantir que membros com 0 pontos na fase apareçam com total 0
  - `get_available_rounds(p_group_id uuid)` — retorna as fases distintas que têm ao menos um palpite no grupo (evita fases fantasma)

### Backend (Next.js Route Handlers)
- `app/api/ranking/rounds/route.ts` — novo endpoint `GET /api/ranking/rounds?group_id=`; autenticação JWT + verificação de membership; chama a RPC `get_available_rounds` e retorna `{ rounds: string[] }`
- `app/api/ranking/route.ts` — estendido para aceitar query param `round`; quando `round` está presente e não é `"GERAL"`, chama `get_ranking_by_round` em vez de `get_ranking`, omite o cálculo de scouts (retorna `scouts: []`) e `predictions_count: 0`; modo GERAL preserva comportamento original intacto

### Frontend (Next.js/React)
- `components/bolao/RoundChips.tsx` — novo componente que renderiza a faixa de chips de filtro; chip "GERAL" sempre fixo como primeiro; fases ordenadas pela sequência lógica da Copa (Grupos A–L → Oitavas → Quartas → Semi → Final); scroll horizontal em mobile sem barra visível; estilo Elifoot (sem border-radius, fonte monospace 11px uppercase); chip ativo em `color-accent` bold, inativos em `color-muted`
- `lib/hooks/useRoundRanking.ts` — novo hook que gerencia: estado `selectedRound` (padrão "GERAL"), fases disponíveis via fetch em `/api/ranking/rounds`, e o ranking correspondente; no modo GERAL, delega ao `useRankingRealtime` existente mantendo Realtime ativo; no modo por rodada, faz fetch estático sem Realtime (intencional: fases encerradas não mudam)
- `components/bolao/RankingTable.tsx` — reescrito para usar `useRoundRanking` em vez de `useRankingRealtime` diretamente; renderiza `RoundChips` acima do border da tabela; no modo por rodada: exibe subtítulo "FASE: X" no cabeçalho, oculta coluna `PALP.`, oculta legenda de scouts, ignora live points; no modo GERAL: comportamento 100% idêntico ao anterior
- `components/bolao/RankingRow.tsx` — adicionadas props opcionais `hideScouts?: boolean` e `hidePalpites?: boolean` para controlar visibilidade contextual

---

## Decisões técnicas

**Delegação ao useRankingRealtime no modo GERAL:** Em vez de replicar a lógica de Realtime dentro do `useRoundRanking`, o hook simplesmente retorna os valores do `useRankingRealtime` existente quando `selectedRound === "GERAL"`. Isso garante zero regressão no modo geral — qualquer melhoria futura no `useRankingRealtime` é aproveitada automaticamente.

**Modo por rodada sem Realtime:** A spec define explicitamente que o ranking por fase não atualiza automaticamente. O caso de uso é análise histórica de fases já concluídas. Isso simplifica a implementação e evita complexidade de subscrições filtradas por fase.

**Separação de hook interno `useRankingByRound`:** Criado como função privada dentro do módulo `useRoundRanking.ts` para encapsular o fetch por rodada com `useCallback` correto. Permite que o hook principal componha os dois modos (GERAL vs. por rodada) sem duplicação de lógica de loading/error.

**Live points no modo por rodada ignorados:** Seguindo a spec — pontuação parcial de jogos ao vivo não é somada no modo por rodada. A função `applyLivePoints` só é chamada quando `selectedRound === "GERAL"`.

**`window.setTimeout(..., 0)` para o fetch inicial:** Seguindo o padrão do `useRankingRealtime` existente, que usa `window.setTimeout` para evitar o erro de lint `react-hooks/set-state-in-effect` sobre setState síncrono dentro de efeitos.

**Chips renderizados mesmo durante loading:** Os chips `RoundChips` são exibidos assim que `roundsLoading` é falso, independentemente do estado de loading da tabela. Isso permite ao usuário trocar de fase enquanto a tabela ainda carrega.

---

## Pontos de atenção para o Revisor

1. **Predicado da função SQL `get_ranking_by_round`:** A spec originalmente mostrava dois predicados ligeiramente diferentes. A migration implementada usa `AND (s.game_id IS NULL OR g.round = p_round)` — conforme a nota de atenção da spec que corrige o predicado do código de exemplo inicial. Verificar se é o predicado correto.

2. **Hook interno `useRankingByRound` com `__noop__`:** Quando `selectedRound === "GERAL"`, o hook interno `useRankingByRound` é chamado com `round = "__noop__"` para satisfazer as regras de hooks (não podem ser condicionais). O resultado desse hook é descartado no modo GERAL. Verificar se há impacto de performance ou comportamento inesperado.

3. **`RankingTable` não usa mais `useRankingRealtime` diretamente:** O componente usa `useRoundRanking` que internamente usa `useRankingRealtime`. Verificar se o `lastUpdatedAt` continua aparecendo corretamente no rodapé da tabela no modo GERAL.

4. **Coluna APROVEIT. no modo por rodada:** A coluna `APROVEIT.` permanece visível no modo por rodada (apenas em `md:`). O aproveitamento é calculado relativamente à rodada selecionada (`games_predicted` × 9 pts máximos). Verificar se isso está alinhado com a spec.

5. **Erros de lint pré-existentes:** Os 2 erros de lint (`group-switcher.tsx` e `GroupChatWidget.tsx`) já existiam antes desta feature e não foram introduzidos por ela.

---

## Correções Fix 1

### Problema 1: `__noop__` causava fetch desnecessário no mount
**Arquivo:** `lib/hooks/useRoundRanking.ts`

Duas alterações no hook interno `useRankingByRound`:
- Estado `loading` iniciado como `false` (era `true`), pois no modo GERAL o hook nunca busca dados e não faz sentido sinalizar loading desde o início.
- Adicionado guard `if (round === '__noop__') return` no `useEffect`, impedindo que qualquer fetch seja disparado quando o hook é instanciado no modo GERAL. A dependência `round` também foi adicionada ao array de deps do efeito para consistência.

### Problema 2: Prop `selectedRound` dead code em `RankingTableProps`
**Arquivo:** `components/bolao/RankingTable.tsx`

Removida a prop `selectedRound?: string` da interface `RankingTableProps`. A prop nunca era desestruturada nem utilizada pela função `RankingTable`; o estado interno sempre inicia em `'GERAL'` via `useRoundRanking`.

---

## Commits realizados

```
257935d fix(ranking-por-rodada): elimina fetch desnecessário com __noop__ e remove prop dead code
3c3da50 feat(ranking-por-rodada): integra RoundChips e useRoundRanking no RankingTable
b6bbc01 feat(ranking-por-rodada): cria componente RoundChips
846f9be feat(ranking-por-rodada): implementa hook useRoundRanking
7a41034 feat(ranking-por-rodada): estende GET /api/ranking para suportar query param round
c37896b feat(ranking-por-rodada): implementa endpoint GET /api/ranking/rounds
730a887 feat(ranking-por-rodada): adiciona migrations get_ranking_by_round e get_available_rounds
eae45de chore(ranking-por-rodada): adiciona plano de implementação
```
