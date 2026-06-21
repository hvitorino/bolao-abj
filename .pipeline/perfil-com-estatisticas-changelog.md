# Changelog: Perfil com Estatísticas

**Slug:** perfil-com-estatisticas
**Branch:** feature/perfil-com-estatisticas
**Data:** 2026-06-21
**Status:** aguardando revisão

---

## O que foi implementado

### Banco de Dados
- Migration `supabase/migrations/20260621400000_create_profile_stats_function.sql` — cria a função `get_profile_stats(p_group_id uuid, p_user_id uuid)` que retorna 6 métricas pessoais do usuário em uma linha (`predictions_made`, `finished_games`, `winner_correct`, `exact_correct`, `total_points`, `best_streak`). A lógica de `best_streak` usa a técnica de gaps-and-islands com dois `ROW_NUMBER()`, consistente com `get_streak_for_group`. Função marcada com `SECURITY DEFINER` e `STABLE`.

### Backend (Next.js Route Handler)
- `app/api/profile/stats/route.ts` — `GET /api/profile/stats`: autenticação via Bearer JWT (mesmo padrão de `/api/ranking/route.ts`), resolução de `group_id` com fallback para cookie `bolao_active_group` e depois primeiro grupo do usuário, verificação de membership via `group_members`, chamadas paralelas (`Promise.all`) para `get_profile_stats`, `get_streak_for_group`, `profiles` e `group_members JOIN groups`. Calcula `winner_rate`, `exact_rate`, `avg_points` no JavaScript. O `user_id` é sempre extraído do JWT (nunca de query param externo).

### Frontend (Next.js/React)
- `app/(dashboard)/perfil/page.tsx` — Server Component da rota `/perfil`: autenticação via `createClient()` + `supabase.auth.getUser()`, redirect para `/login` se não autenticado, `resolveActiveGroup()` com cookie e fallback, tratamento de erro de grupo (exibe `✗ VOCÊ NÃO PARTICIPA DESTE GRUPO`), e renderiza `<ProfileStats>` passando `groupId` e `userId`.
- `components/bolao/ProfileStats.tsx` — Client Component com estados `loading | error | populated`. No mount, faz fetch para `/api/profile/stats` com Bearer JWT obtido via `supabase.auth.getSession()`. Layout estilo terminal Elifoot: painel com `border: 1px solid var(--color-border)`, `border-radius: 0`, `box-shadow: none`, fonte JetBrains Mono exclusivamente. Cabeçalho em `color-accent`, subheader em `color-muted`, labels uppercase com `min-width: 11rem`. Percentuais em `color-win` se >= 50%, `color-muted` se < 50%. Streaks zero em `color-muted`. Exibe `—` em vez de `0.0%` quando `predictions_made = 0`.
- `app/(dashboard)/nav-links.tsx` — adicionada entrada `{ href: '/perfil', label: 'PERFIL' }` ao array `NAV_ITEMS` (7º item).

---

## Decisões técnicas

- **Resolução de `group_id` no endpoint**: o endpoint lê `group_id` da query string, depois do cookie `bolao_active_group` lido do header `Cookie`, e por último faz fallback para o primeiro grupo do usuário via `joined_at ASC`. Essa tripla prioridade espelha o comportamento de `resolveActiveGroup()` nas páginas do dashboard.
- **`best_streak` no Postgres, `current_streak` via RPC existente**: a spec define que `best_streak` usa gaps-and-islands em SQL (dentro de `get_profile_stats`) e `current_streak` é extraído de `get_streak_for_group` (já existente), filtrando pelo `user_id` no array retornado. Isso evita duplicação de lógica.
- **Sem Realtime**: a página de perfil não usa Supabase Realtime — os dados são carregados uma vez no mount. Isso é coerente com a natureza retrospectiva das estatísticas.
- **Lint pré-existente**: os 2 erros de lint (`GroupChatWidget.tsx` e um arquivo de cookies) são pré-existentes e não relacionados a esta feature. O build compila sem erros novos introduzidos.

---

## Pontos de atenção para o Revisor

1. **Critério de `finished_games`**: conforme spec, a contagem inclui todos os jogos `status = 'finished'` no banco global (sem filtro de grupo), pois `games` é uma tabela global. A função SQL está correta neste ponto.
2. **Divisão por zero**: quando `predictions_made = 0`, a UI exibe `—` nos percentuais e na média de pontos. Verificar se o comportamento está coerente com o critério de aceite da spec (item 11).
3. **Label do menu**: o 7º item `PERFIL` usa `overflowX: auto` já existente no nav — verificar em viewport 375px que os 7 itens ficam acessíveis via scroll horizontal sem sumir.
4. **`userId` em ProfileStats**: o prop `userId` é passado mas não é usado diretamente no fetch (o endpoint usa o JWT para extrair o user_id). Ele serve como chave de estabilidade e para possível futuro uso (ex: exibir perfil de outro usuário).

---

## Commits realizados

```
4cab3f4 feat(perfil-com-estatisticas): adiciona link PERFIL na navegação
dfeb539 feat(perfil-com-estatisticas): cria página /perfil (Server Component)
ecf0ed0 feat(perfil-com-estatisticas): cria componente ProfileStats
fe4464d feat(perfil-com-estatisticas): implementa GET /api/profile/stats
c70416e feat(perfil-com-estatisticas): cria migration com função get_profile_stats
337c461 chore(perfil-com-estatisticas): adiciona plano de implementação
```
