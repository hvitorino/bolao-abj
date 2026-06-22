# Changelog: Análise de Confronto

**Slug:** analise-confronto
**Branch:** feature/analise-confronto
**Data:** 2026-06-22
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — Server Component SSR com `revalidate: 60`. Resolve o `gameId` da rota, verifica autenticação/autorização via `createClient` + `resolveActiveGroup`, executa duas queries Supabase em sequência (jogo específico + todos os jogos dos dois times), calcula stats e últimos jogos em memória, e renderiza o layout completo com header de confronto, `MatchupStatsCard` e `RecentGamesSection`. Retorna `notFound()` para gameId inexistente e redirect para `/login` quando não autenticado.

- `components/bolao/MatchupStatsCard.tsx` — Client Component que exibe stats comparativas lado a lado dos dois times. Exibe 6 linhas de estatísticas: Jogos (V/E/D), Gols Marcados, Gols Sofridos, Saldo de Gols, Clean Sheets e Jogos com Gol. Destaca em `color-win` o time com vantagem em cada métrica (lógica invertida em "Gols Sofridos" — menor é melhor). Visual: background `color-surface`, bordas `color-border`, header em `color-secondary`, fonte `JetBrains Mono`.

- `components/bolao/RecentGamesSection.tsx` — Client Component com duas colunas (uma por time), cada uma exibindo até 3 jogos recentes com resultado (V/E/D colorido), placar em `color-accent`, adversário e data formatada. Filtra apenas jogos com placar definido, ordena por data descrescente e exibe "— sem jogos anteriores —" quando array vazio. Layout responsivo via `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` — colapsa para coluna única em mobile.

- `components/games/GameCard.tsx` — Adicionado link `► VER ANÁLISE` no rodapé de cada card, visível para todos os status (pending, live, finished). Link navega para `/jogos/[gameId]/analise`. Estilo: texto muted, uppercase, lettering 0.08em, sem sublinhado.

---

## Decisões técnicas

- **Query combinada com OR**: usada uma única query para buscar todos os jogos dos dois times, com `or(home_team_code.eq.X,away_team_code.eq.X,home_team_code.eq.Y,away_team_code.eq.Y)`. Isso cobre mandante e visitante de ambos os times em uma só roundtrip ao Supabase.

- **Cálculo em memória**: todas as agregações (stats + últimos jogos) são feitas em TypeScript, sem SQL agregado. Decisão alinhada à spec — Copa 2026 terá ~100-150 jogos totais, bem dentro do custo de computação aceitável em um Server Component.

- **Jogos sem placar excluídos do cálculo**: jogos com `home_score === null || away_score === null` são ignorados tanto nas stats quanto nos últimos jogos. Exibe "-" não é necessário na lista pois esses jogos simplesmente não aparecem nos últimos 3.

- **`resolveActiveGroup` sem `groupParam`**: a página de análise não tem parâmetro `?group=` na URL, então passa `undefined` para o groupParam. O cookie de grupo ativo é suficiente para validar que o usuário é membro de algum grupo.

- **`notFound()` para gameId inválido**: seguindo convenção Next.js App Router — retorna 404 limpo em vez de erro genérico.

- **Tipos exportados dos componentes**: `TeamStats` e `RecentGame` são exportados dos seus respectivos componentes (em vez de um arquivo `lib/types/` separado) por serem tipos exclusivos da feature de análise, sem reuso esperado.

- **Estilo inline**: manteve a convenção do projeto (sem Tailwind classes, usando `style={}` com `var(--color-*)` tokens), compatível com todos os outros componentes existentes.

---

## Pontos de atenção para o Revisor

- A query OR do Supabase com 4 condições (`home_team_code.eq.X,away_team_code.eq.X,...`) — verificar se a sintaxe funciona corretamente com o cliente JS do Supabase em produção.
- O link `► VER ANÁLISE` no `GameCard.tsx` usa `liveGame.id` (do Realtime hook) em vez de `game.id` (prop original) — isso é intencional pois `liveGame` já é inicializado com `game` como fallback no hook.
- `revalidate = 60` no Server Component é declarado como variável de módulo exportada, conforme convenção do Next.js 15 App Router.
- Os tipos `TeamStats` e `RecentGame` são exportados dos componentes `MatchupStatsCard.tsx` e `RecentGamesSection.tsx` respectivamente para reusar na `page.tsx` sem duplicação.

---

## Commits realizados

```
fbe58df chore(analise-confronto): adiciona plano de implementação
7e08b24 feat(analise-confronto): cria componente MatchupStatsCard com estatísticas comparativas
dc2e9f1 feat(analise-confronto): cria componente RecentGamesSection com últimos 3 jogos por time
a1c480f feat(analise-confronto): cria rota /jogos/[gameId]/analise com SSR e cálculo de stats em memória
4f534a7 feat(analise-confronto): adiciona botão VER ANÁLISE no GameCard
```
