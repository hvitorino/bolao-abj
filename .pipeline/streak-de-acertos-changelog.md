# Changelog: Sequência de Acertos

**Slug:** streak-de-acertos
**Branch:** feature/streak-de-acertos
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados
- `supabase/migrations/20260621300000_create_streak_function.sql` — cria a função `get_streak_for_group(p_group_id uuid)` que retorna `(user_id, streak bigint)` para todos os membros do grupo. A lógica percorre os jogos encerrados do mais recente ao mais antigo usando `ROW_NUMBER() OVER (ORDER BY match_date DESC, id DESC)`. Para cada membro × jogo, determina se houve acerto do vencedor (`predictions` presente E `scores.breakdown->>'winner' > 0`). O streak é calculado como `miss_rn - 1` onde `miss_rn` é o `rn` do primeiro jogo sem acerto; se nunca houve falha, o streak é igual ao total de jogos encerrados. Usa `CREATE OR REPLACE` (idempotente), `STABLE`, `SECURITY DEFINER`.

### Backend (Next.js Route Handler)
- `app/api/ranking/route.ts` — estendido para:
  - Modo GERAL: chama `get_streak_for_group` em paralelo com `get_ranking` e `get_ranking_scouts` via `Promise.all`. Erro na RPC de streak não bloqueia a resposta (apenas loga e usa `streak: 0`). Campo `streak: number` incluído em cada entrada da resposta JSON.
  - Modo por rodada: `streak: 0` em todas as entradas (sem chamada adicional ao banco).

### Frontend (Next.js/React)
- `lib/types/ranking.ts` — adicionado campo `streak: number` à interface `RankingEntry`.
- `components/bolao/RankingRow.tsx` — exibe `🔥×N` (em `color-win`, bold, 11px) na célula PARTICIPANTE quando `entry.streak > 0`, posicionado após o nome e antes do sufixo `(VOCÊ)`. Tooltip nativo (`title`) com texto `"N acerto(s) consecutivo(s)"`. Participantes com streak 0 não veem nenhum indicador.
- `components/bolao/RankingTable.tsx` — adicionada entrada `🔥 SEQUÊNCIA DE ACERTOS` (em `color-win`) na seção de legenda do rodapé, exibida apenas no modo GERAL junto com a legenda de scouts já existente.

---

## Decisões técnicas

**Cálculo server-side via função SQL:** Seguindo o padrão estabelecido por `get_ranking_scouts` e `get_ranking_by_round`, o streak é calculado no banco e exposto via RPC. Isso centraliza a lógica, evita N+1 queries no frontend e mantém o contrato da API simples.

**Tratamento de erro não-bloqueante para streak:** Se `get_streak_for_group` falhar (ex: migração ainda não aplicada em produção), a resposta continua retornando ranking com `streak: 0` para todos. Isso garante que um erro na nova RPC não derrube a funcionalidade central de ranking.

**Indicador inline na célula PARTICIPANTE (sem nova coluna):** A spec avaliou adicionar uma coluna `SEQ.` (como `PALP.`) mas optou pelo indicador inline por dois motivos: (1) o ranking já tem 4+ colunas e mobile ficaria muito comprimido; (2) o streak é uma métrica "ao vivo" que completa o perfil do participante — faz sentido contextualmente junto ao nome, como os scout badges. O valor 0 simplesmente não renderiza nada, evitando poluição visual.

**Posicionamento do indicador:** `🔥×N` vem antes de `(VOCÊ)` e dos scout badges na célula. Isso coloca a informação "quente" imediatamente após o nome, na ordem: nome → sequência → identidade → perfil de longo prazo.

**Tooltip nativo:** Consistente com `ScoutBadges` — sem bibliotecas externas, sem SVGs decorativos. Funciona em desktop com hover e mobile com long press.

**Streak 0 no modo por rodada:** O streak é uma métrica da sequência atual do participante (janela temporal sem corte por fase). Exibir streak no modo por rodada seria semanticamente inconsistente — e seria necessário uma segunda RPC filtrada por fase que não existe e não foi solicitada.

---

## Pontos de atenção para o Revisor

1. **Migration não aplicada ao banco de produção:** A migration `20260621300000_create_streak_function.sql` está apenas no repositório. A função `get_streak_for_group` precisará ser aplicada via `supabase-migration` antes de entrar em produção. O endpoint lida com o erro graciosamente (streak = 0 para todos), portanto não haverá quebra se o deploy preceder a aplicação da migration.

2. **`CROSS JOIN total_finished` quando não há jogos encerrados:** Se `total_finished.cnt = 0`, o `CROSS JOIN` retorna 0 linhas para a CTE de resultados — mas a CTE `members` existirá. A query final (`FROM members m LEFT JOIN first_miss fm ... CROSS JOIN total_finished tf`) produz `streak = COALESCE(NULL - 1, 0) = 0` para todos, o que é o comportamento correto. Verificar se o `CROSS JOIN` com subquery vazia (cnt=0) se comporta como esperado no Postgres — `CROSS JOIN` com tabela de uma linha retorna 1 linha por membro; a subquery `COUNT(*)` sempre retorna 1 linha (com valor 0 se não há jogos), portanto o comportamento é correto.

3. **Erros de lint pré-existentes:** Os 2 erros de lint (`group-switcher.tsx` e `GroupChatWidget.tsx`) já existiam antes desta feature (confirmados no changelog de `ranking-por-rodada` — item 5 de pontos de atenção). Nenhum erro novo foi introduzido.

4. **Ordem dos elementos na célula PARTICIPANTE:** O elemento `🔥×N` usa `flexShrink: 0` para não ser comprimido pelo `textOverflow: ellipsis` do nome. Verificar se em nomes muito longos o comportamento de truncate está correto — o nome deve ser cortado, não o streak.

5. **`Promise.all` com três RPCs:** A latência da terceira RPC (`get_streak_for_group`) é adicionada em paralelo. Em grupos grandes com muitos jogos encerrados, a query SQL pode ser mais lenta. O `CROSS JOIN` entre membros e jogos encerrados cresce `O(members × finished_games)` — aceitável para o tamanho esperado do bolão (dezenas de membros × centenas de jogos).

---

## Commits realizados

```
ce78919 feat(streak-de-acertos): adiciona legenda de streak no rodapé do RankingTable
2e6f479 feat(streak-de-acertos): adiciona indicador visual de streak em RankingRow
0f44d72 feat(streak-de-acertos): inclui streak no retorno de GET /api/ranking
36804f8 feat(streak-de-acertos): adiciona campo streak à interface RankingEntry
b29dcbd feat(streak-de-acertos): adiciona migration com função get_streak_for_group
6917a40 chore(streak-de-acertos): adiciona plano de implementação
```
