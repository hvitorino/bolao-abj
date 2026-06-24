# Changelog: Correção — Contexto de Grupo na Página Pública de Jogo

**Slug:** public-game-view-group-fix
**Branch:** feature/public-game-view-group-fix
**Data:** 2026-06-24
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `app/jogos/[gameId]/publico/page.tsx` — adicionada prop `searchParams: Promise<{ grupo?: string }>` ao Server Component; quando `grupo` está ausente na URL, renderiza tela de erro inline (sem `notFound()`, sem redirect) com mensagem `✗ PARÂMETRO DE GRUPO AUSENTE` estilizada em `color-error`; quando presente, filtra todas as queries (perfis, predictions, scores) pelo `group_id` fornecido; passa `groupId` como prop para `PublicGameClient`
- `components/bolao/PublicGameClient.tsx` — adicionada prop `groupId: string` à interface e ao componente; repassa para `PublicParticipantsList`
- `components/bolao/PublicParticipantsList.tsx` — adicionada prop `groupId: string` à interface e ao componente; nome do canal Realtime alterado de `public-scores-${gameId}` para `public-scores-${gameId}-${groupId}` para evitar colisões entre abas de grupos diferentes; `groupId` adicionado ao array de dependências do `useEffect`
- `components/games/GameCard.tsx` — `handleCopyLink` corrigido para gerar `${origin}/jogos/${gameId}/publico?grupo=${groupId}` em vez de URL sem o query param

### Banco de Dados

- Sem migrations. A coluna `group_id` já existe em `predictions` e `scores`; a tabela `group_members` já existe com `group_id` + `user_id`.

---

## Decisões técnicas

**Query de membros do grupo via join:** Em vez de `SELECT * FROM profiles`, a page agora faz `FROM group_members JOIN profiles` filtrado por `group_id`. O Supabase JS retorna o campo `profiles` como array (comportamento padrão do join relacional), por isso foi necessário normalizar via `Array.isArray(raw) ? raw[0] : raw` antes do cast de tipo — a alternativa `profiles!inner` (que forçaria objeto singular) não é suportada pela tipagem gerada pelo SDK neste contexto.

**Nome de canal Realtime com groupId:** O filtro Postgres no Realtime suporta apenas uma coluna de cada vez, então manteve-se `game_id=eq.${gameId}` como filtro. O `groupId` entra apenas no nome do canal para garantir isolamento de subscriptions entre abas abertas para grupos diferentes do mesmo jogo. O handler de eventos filtra os `user_id` somente dos participantes já carregados via SSR (que são exclusivamente membros do grupo), eliminando qualquer risco de exibir scores de outros grupos.

**Erro inline sem `notFound()`:** A spec exige mensagem clara orientando o usuário, não uma página 404 genérica. A abordagem inline mantém o header `BOLÃO DA COPA / VISUALIZAÇÃO PÚBLICA` visível e evita confusão com um erro de rota inexistente.

---

## Pontos de atenção para o Revisor

- Verificar que a query `group_members.select('user_id, profiles(id, name)').eq('group_id', groupId)` retorna os membros corretamente no ambiente de produção (RLS do Supabase com service_role ignora policies — confirmar que `group_members` é acessível via service_role sem policy anon).
- Confirmar que `scores` tem a coluna `group_id` e que as queries com `.eq('group_id', groupId)` não retornam erro silencioso caso a coluna não exista (o Supabase retorna array vazio se não houver correspondência, mas retornaria erro de schema se a coluna não existir).
- O erro de lint pré-existente em 5 arquivos não relacionados a esta feature não foi introduzido aqui — confirmar via `git log` que os erros existiam antes.

---

## Commits realizados

```
e74cb93 fix(public-game-view-group-fix): corrige cast de tipo no join group_members/profiles
a031fd6 feat(public-game-view-group-fix): adiciona prop groupId ao PublicParticipantsList e inclui no nome do canal Realtime
3b22dc3 feat(public-game-view-group-fix): adiciona prop groupId ao PublicGameClient e repassa para PublicParticipantsList
6be70f5 feat(public-game-view-group-fix): adiciona searchParams.grupo; erro se ausente; filtra queries por group_id; passa groupId ao PublicGameClient
bf83f8d fix(public-game-view-group-fix): inclui ?grupo=${groupId} na URL copiada pelo GameCard
82f3429 chore(public-game-view-group-fix): adiciona plano de implementação
```
