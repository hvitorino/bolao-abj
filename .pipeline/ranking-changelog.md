# Changelog: Ranking em Tempo Real

**Slug:** ranking
**Branch:** feature/ranking
**Data:** 2026-06-13
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados

- `db/migrations/20260613_create_ranking_view.sql` — Migration completa:
  - View `ranking_view`: agrega pontuações por usuário com `SUM(points)`, `COUNT(id)` e `RANK() OVER (ORDER BY SUM(points) DESC)`, JOIN com `profiles` para nome do participante. Ordenada por total de pontos (desc) e nome (asc) em empate.
  - Função Postgres `get_ranking()` com `SECURITY DEFINER STABLE`: executa com permissões do owner, contornando o RLS da tabela `scores` (que só permite SELECT do próprio usuário). Retorna `user_id`, `participant_name`, `total_points`, `games_predicted`, `position` para todos os participantes.
  - Comentário sobre configuração Realtime (já feita na feature scoring, mas documentada aqui por completude).

### Backend (Ruby/Sinatra)

- `api/ranking.rb` — Vercel Function em Ruby/Rack com método GET:
  - **GET /api/ranking** — Retorna ranking completo do bolão
  - Autenticação JWT via `GET /auth/v1/user` do Supabase (Bearer token)
  - Chamada via RPC `get_ranking()` com `service_role` para contornar RLS da tabela `scores`
  - Cálculo do `aproveitamento` no servidor: `(total_points / (games_predicted * 9) * 100).round(0)` — máximo de 9 pts por jogo (vencedor=3 + exato=5 + goleada=1)
  - CORS configurado para `GET, OPTIONS`
  - Constantes com sufixo `_RANKING` para evitar conflito com outros handlers Ruby no mesmo processo Vercel

### Frontend (Next.js/React)

- `lib/types/ranking.ts` — Interface `RankingEntry` com todos os campos: `position`, `user_id`, `participant_name`, `total_points`, `games_predicted`, `aproveitamento`

- `lib/hooks/useRankingRealtime.ts` — Hook `'use client'` que:
  - Busca ranking via `GET /api/ranking` com JWT do `supabase.auth.getSession()`
  - Cria subscription Supabase Realtime para canal `ranking-scores` (tabela `scores`, evento `*`)
  - Ao detectar qualquer mudança em `scores`, refaz o fetch completo do ranking
  - Cleanup do `useEffect`: `supabase.removeChannel(channel)` para evitar memory leak
  - Estados: `{ ranking: RankingEntry[], loading: boolean, error: string | null }`
  - `fetchRanking` memorizado com `useCallback` para estabilidade nas dependências do `useEffect`

- `components/bolao/RankingRow.tsx` — Componente `<tr>` para cada linha do ranking:
  - Líder (`position === 1`): cor `color-accent`, bold, prefixo `► ` no nome
  - Usuário atual (`user_id === currentUserId`): cor `color-primary`, bold, fundo sutil verde com 8% opacidade, sufixo `(VOCÊ)` em `color-primary` menor
  - Aproveitamento ≥ 60%: exibido em `color-win`; < 60%: `color-muted`
  - Quando líder E usuário atual: `color-accent` tem precedência

- `components/bolao/RankingTable.tsx` — Componente `'use client'` principal:
  - Usa `useRankingRealtime()` para dados em tempo real
  - Estado loading: `"CARREGANDO RANKING..."` em `color-muted`
  - Estado error: `"✗ <mensagem>"` em `color-error`
  - Estado vazio: `"NENHUM PARTICIPANTE NO RANKING AINDA"` em `color-muted`
  - Tabela densa estilo Elifoot: cabeçalho com `"RANKING — BOLÃO DO CARTOLA ABJ"` + indicador `"● AO VIVO"` piscante (`blink`) em `color-live`
  - Colunas `<thead>`: `#` | `PARTICIPANTE` | `PONTOS` | `APROVEIT.` em `color-muted` uppercase
  - Rodapé com legenda: `► LÍDER` (accent), `■ VOCÊ` (primary), contagem de participantes (muted)
  - `overflowX: 'auto'` para responsividade mobile

- `app/(dashboard)/ranking/page.tsx` — Página Server Component:
  - Verifica autenticação via `supabase.auth.getUser()`, redireciona para `/login` se não autenticado
  - Renderiza título `"RANKING GERAL"` com separador e subtítulo `"Classificação ao vivo · atualiza em tempo real"`
  - Passa `currentUserId={user.id}` para `<RankingTable />`
  - `maxWidth: 800px` com `margin: 0 auto` para centralização

- `app/(dashboard)/nav-links.tsx` — Client Component `'use client'` para links de navegação:
  - Links: `JOGOS → /jogos`, `RANKING → /ranking`, `PALPITES → /meus-palpites`
  - Usa `usePathname()` para detectar rota ativa
  - Link ativo: `color-primary` com `border-bottom: 1px solid var(--color-primary)`
  - Links inativos: `color-muted` com borda transparente
  - `transition` suave de 0.15s para hover

- `app/(dashboard)/layout.tsx` — Atualizado para integrar `NavLinks`:
  - Importa e renderiza `<NavLinks />` entre o título do bolão e o email do usuário
  - Header refatorado em dois grupos: `[logo + nav]` e `[email + logout]`
  - `flexWrap: 'wrap'` no header para responsividade mobile

---

## Decisões técnicas

1. **`get_ranking()` com `SECURITY DEFINER` em vez de service_role direto no Ruby:** A tabela `scores` tem RLS que só permite SELECT do próprio usuário. Para o ranking funcionar, precisamos contornar o RLS. A opção escolhida foi uma função Postgres `SECURITY DEFINER` que executa com permissões do owner. Isso é mais seguro do que fazer query direta com `service_role` sem controle, pois a função encapsula exatamente o que pode ser acessado.

2. **Refetch completo ao invés de atualização incremental no Realtime:** Ao detectar mudança em `scores`, o hook refaz o fetch completo de `/api/ranking` em vez de tentar calcular o delta. Isso simplifica a lógica (sem ordenação client-side, sem recálculo de posições) e garante consistência com o banco. O volume de dados é pequeno (ranking de um bolão de amigos).

3. **`useCallback` para `fetchRanking`:** O callback de fetch é memorizado com `useCallback` para ser incluído nas dependências do `useEffect` sem causar loop infinito. Sem isso, uma nova função seria criada a cada render, re-disparando o `useEffect` continuamente.

4. **NavLinks como Client Component separado:** O `app/(dashboard)/layout.tsx` é um Server Component necessário (verifica sessão com `auth.getUser()`). O `usePathname()` exige `'use client'`. A extração para `nav-links.tsx` segue o padrão já usado pelo `logout-button.tsx` na mesma feature `auth`.

5. **Aproveitamento calculado no Ruby, não no frontend:** O cálculo de `total_points / (games_predicted * 9) * 100` é feito no endpoint Ruby antes de retornar o JSON. Isso garante que o cálculo é consistente e não vaza lógica de negócio para o cliente.

6. **Constante `MAX_POINTS_PER_GAME = 9`:** O denominador para aproveitamento é 9 (vencedor=3 + exato=5 + goleada=1). Bônus `winner_score`, `diff` e `loser_score` são excludentes com `exact`, então o máximo real é 9. Essa constante está documentada no código Ruby.

---

## Pontos de atenção para o Revisor

1. **RLS da view `ranking_view`:** A view herda as políticas RLS das tabelas subjacentes. Consultar a view diretamente via Supabase JS com o JWT do usuário retornaria apenas os próprios dados do usuário (devido ao RLS de `scores`). O ranking completo é obtido exclusivamente via RPC `get_ranking()` com `SECURITY DEFINER`. Verificar que o endpoint Ruby chama a RPC corretamente.

2. **Realtime em `scores` já configurado (feature scoring):** A configuração `ALTER TABLE scores REPLICA IDENTITY FULL` e `ALTER PUBLICATION supabase_realtime ADD TABLE scores` foi descrita na feature scoring. O hook `useRankingRealtime` depende dessa configuração para receber eventos. Se não foi aplicada, o Realtime não funciona, mas o ranking ainda carrega corretamente (apenas sem atualização automática).

3. **Cleanup do Realtime:** Verificar que `supabase.removeChannel(channel)` é chamado no retorno do `useEffect`. O canal `ranking-scores` é um singleton por instância do componente — se o usuário navegar para outra página e voltar, o canal é recriado corretamente.

4. **NavLinks e Server Component:** O layout do dashboard é um Server Component. A `NavLinks` é um Client Component. Verificar que o import está correto e que não há erro de hidratação.

5. **Coluna PARTICIPANTE em mobile:** A coluna usa `maxWidth: 200px` com `overflow: hidden` e `textOverflow: ellipsis`. Em telas muito estreitas (< 360px), verificar se o nome é truncado adequadamente sem quebrar o layout da tabela.

6. **Concorrência de `fetchRanking`:** Se dois eventos Realtime chegarem em rápida sucessão, duas chamadas a `fetchRanking` ocorrerão paralelamente. A última a completar sobrescreve o estado com `setRanking(data)`. Isso é seguro (idempotente), mas pode causar um estado intermediário brevemente desatualizado se a segunda chamada completar antes da primeira. O volume do bolão torna isso improvável de ser perceptível.

---

## Commits realizados

```
6ecc1cc feat(ranking): adiciona NavLinks com destaque de rota ativa e atualiza layout do dashboard
ba0eff4 feat(ranking): adiciona página /ranking com Server Component e RankingTable
5a41574 feat(ranking): adiciona componentes RankingRow e RankingTable com design Elifoot
8a0f3b1 feat(ranking): adiciona hook useRankingRealtime com subscription Supabase Realtime
1f7a052 feat(ranking): adiciona endpoint Ruby GET /api/ranking com aproveitamento calculado
e5cd443 feat(ranking): adiciona tipo TypeScript RankingEntry
7b93e42 feat(ranking): adiciona migration SQL para view ranking_view e função get_ranking()
5460abf chore(ranking): adiciona plano de implementação
```
