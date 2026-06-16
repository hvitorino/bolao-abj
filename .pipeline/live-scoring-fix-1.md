# Fix 1: Pontuação em Tempo Real Durante Jogos ao Vivo

**Slug:** live-scoring
**Data:** 2026-06-15
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `rank_position` recalculado no cliente não reproduz empates como o backend (`RANK()` vs numeração sequencial)

**Arquivo:** `components/bolao/RankingTable.tsx` (função `applyLivePoints`, linhas 24-42)
**Severidade:** importante
**Descrição:**
O backend (`get_ranking()` em `supabase/migrations/20260614000001_fix_ranking_all_profiles.sql`) usa `RANK() OVER (ORDER BY total_points DESC)`, ou seja, participantes com a mesma pontuação recebem a **mesma** posição (ex.: dois líderes empatados em 1º lugar recebem `rank_position = 1` ambos, e o próximo participante recebe `rank_position = 3`, pulando o 2).

A função `applyLivePoints()` recalcula `rank_position` no cliente com `adjusted.map((entry, index) => ({ ...entry, rank_position: index + 1 }))` — uma numeração estritamente sequencial (1, 2, 3, ...) que **não** reproduz empates. Com isso:

- Se dois participantes empatarem na pontuação total (oficial + parcial de jogos `live`), apenas o primeiro (pelo critério de desempate nome A-Z) recebe `rank_position === 1`.
- `RankingTable` calcula `isLeader={entry.rank_position === 1 && entry.total_points > 0}` (linha 256) e passa isso para `RankingRow`, que exibe o indicador visual `►` (cor `color-accent`, negrito) apenas para quem tem `isLeader === true`.
- Resultado: em caso de empate exato no topo — situação plausível e até comum em um bolão pequeno nas primeiras rodadas, quando os pontos totais ainda são baixos — o segundo colocado empatado deixa de ser marcado como líder (`►`) **assim que houver pelo menos um jogo `live`**, mesmo que no ranking "oficial" (sem pontos live, ex. fora do horário de jogos) ambos apareçam como líderes com `►`. Isso é uma regressão de comportamento visível e inconsistente: o mesmo conjunto de pontos é exibido de formas diferentes dependendo de haver ou não jogos `live` no momento, o que pode confundir os participantes.

A spec (`'.pipeline/live-scoring-spec.md'`, seção "Integração em RankingTable.tsx") pede para reordenar "desc (critério de empate: nome A-Z, mesmo critério do backend)" — o critério de empate para *ordenação relativa* foi respeitado, mas a *numeração de posição* (que é o que de fato controla o destaque visual de líder) diverge do padrão `RANK()` já usado pelo backend.

**Correção esperada:**
Ajustar `applyLivePoints()` em `components/bolao/RankingTable.tsx` para numerar `rank_position` reproduzindo a semântica de `RANK()` do Postgres: participantes com `total_points` (já somado com `livePoints`) idêntico devem receber o mesmo `rank_position`, e o próximo valor de posição distinto deve "pular" para `count_anteriores + 1` (não para `índice + 1`). Exemplo de implementação:

```ts
function applyLivePoints(
  ranking: RankingEntry[],
  livePoints: Record<string, number>
): RankingEntry[] {
  const adjusted = ranking.map((entry) => ({
    ...entry,
    total_points: entry.total_points + (livePoints[entry.user_id] ?? 0),
  }))

  adjusted.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return a.participant_name.localeCompare(b.participant_name, 'pt-BR')
  })

  // Reproduz RANK() do Postgres: mesma pontuação => mesma posição;
  // a próxima posição distinta usa o índice (1-based) da primeira ocorrência daquele grupo.
  return adjusted.map((entry, index) => {
    const rank_position =
      index > 0 && adjusted[index - 1].total_points === entry.total_points
        ? adjusted[index - 1].rank_position ?? index
        : index + 1
    return { ...entry, rank_position }
  })
}
```
(Ajustar a tipagem conforme necessário — o importante é o comportamento: ao iterar a lista já ordenada, se o `total_points` do item atual for igual ao do item anterior, herdar o `rank_position` do anterior; caso contrário, usar `index + 1`.)

Validar manualmente: simular `ranking` com dois usuários empatados em pontos oficiais (ex. ambos com 8 pontos) e confirmar que, com e sem `livePoints` somados (mantendo o empate), ambos aparecem com `►` em `RankingRow` (ambos `rank_position === 1`).

---

## Itens OK (não precisam ser revisados novamente)

- `calculateLiveScore()` em `lib/scoring.ts` — reaproveita `calculateScore()` corretamente, sem duplicar regras, trata placar nulo conforme spec.
- `GameParticipantsList.tsx` — header `PTS*`/`PTS`, cor `color-live`/`color-accent`, legenda `* PROVISÓRIO — RECALCULADO AO VIVO`, tratamento de "sem palpite" (`-`) — tudo conforme spec e Design.
- `GameCard.tsx` — passagem de `liveGame` para `GameParticipantsList` correta, reaproveita placar já mantido por `useGameRealtime`, sem subscription nova.
- `lib/hooks/useLivePointsByUser.ts` — fetch de jogos `live` + predictions, agregação por `user_id`, subscription Realtime `live-points-games` (tabela `games`, evento `UPDATE`, sem filtro de coluna), debounce de 1000ms, cleanup correto (`clearTimeout` + `removeChannel`) no unmount — confirmado padrão idêntico ao já usado em `useRankingRealtime`.
- Degradação por erro de rede em `useLivePointsByUser` — confirmado que em caso de erro apenas loga no console e mantém o último valor calculado (ou `{}`), sem bloquear o ranking nem exibir banner de erro adicional.
- `aproveitamento` não é recalculado com pontos live — confirmado em `RankingTable.tsx`/`applyLivePoints`, que só ajusta `total_points`, e em `RankingRow.tsx` (sem alteração, conforme changelog).
- RLS — confirmado que `games` é legível por todos autenticados (`USING (true)`) e `predictions` libera leitura de palpites para jogos não-`pending` (migration `20260614191000_fix_prediction_visibility_policy.sql`), cobrindo exatamente o caso `live` necessário pelo hook novo, sem necessidade de policy nova.
- Nenhum endpoint Ruby ou rota Next.js de backend foi criado/modificado — confirmado via `git diff main feature/live-scoring -- api/` (vazio).
- Nenhuma reimplementação paralela da lógica de pontuação fora de `lib/scoring.ts` — confirmado via grep pelos nomes dos campos do breakdown.
- Design: variável `--color-live: #ff3b30` existe em `app/globals.css` e é usada conforme especificado; fonte monospace, sem ícones SVG decorativos, mobile (`flexWrap: 'wrap'`) preservados.
- `npm run lint` e `npm run build` executados nesta revisão, ambos sem erros (build gera `/ranking`, `/jogos` e demais rotas normalmente).
- `RankingRow.tsx` de fato não precisou de alteração (confirmado via diff vazio) — recebe `total_points`/`rank_position` já ajustados via props existentes.
