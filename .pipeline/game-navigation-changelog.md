# Changelog: Navegação de Jogos

**Slug:** game-navigation
**Branch:** feature/game-navigation
**Data:** 2026-06-13
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `app/(dashboard)/jogos/page.tsx` — Página Server Component assíncrona que substitui o placeholder. Lê `?date=YYYY-MM-DD` dos searchParams, valida a data, consulta o Supabase diretamente para buscar jogos do dia e contar palpites do usuário. Renderiza `DayNavigator` + `GameList`. Exibe mensagem de erro se o Supabase falhar.

- `components/games/GameCard.tsx` — Card de jogo individual. Exibe: cabeçalho com rodada e data, corpo com códigos de time (3 letras) + nomes + placar central, rodapé com badge de status. Status `pending` mostra "PENDENTE · HH:MM BRT"; `live` mostra "██ AO VIVO ██" com classe CSS `blink`; `finished` mostra "ENCERRADO". Placar em `color-accent` quando disponível, " - × - " em `color-muted` quando não há placar. Borda do card em `color-live` para jogos ao vivo.

- `components/games/GameList.tsx` — Lista de GameCards. Estado vazio: "NENHUM JOGO NESTE DIA". Agrupa jogos por rodada com separadores visuais (quando há mais de um grupo no dia). Layout responsivo com `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`.

- `components/games/DayNavigator.tsx` — Client Component de navegação por dia. Botões `◀` e `▶` usando componente `Button` existente. Data formatada em português (ex: "SÁBADO, 13 JUN 2026") em destaque `color-accent` quando é hoje + indicador "(HOJE)". Contadores: X JOGOS · Y PALPITES REGISTRADOS. Palpites em `color-primary` se > 0, `color-muted` se zero.

### API (Next.js Route Handler)

- `app/api/games/route.ts` — GET `/api/games?date=YYYY-MM-DD`. Verifica autenticação via `supabase.auth.getUser()`. Aceita `?date=` opcional (padrão: data atual em BRT). Valida formato da data. Filtra jogos por `match_date` entre início e fim do dia. Retorna array JSON. Erros: 401 sem auth, 400 data inválida, 500 erro Supabase.

### Tipos TypeScript

- `lib/types/game.ts` — Interface `Game` com todos os campos da tabela, type alias `GameStatus = 'pending' | 'live' | 'finished'`.

### Banco de Dados

- `db/migrations/20260613_create_games.sql` — Cria tabela `games` com todos os campos definidos no CLAUDE.md. CHECK constraint no campo `status`. Índices em `match_date`, `status` e `match_date::date`. RLS habilitado. Policy de leitura para usuários autenticados.

- `db/seeds/seed_games.rb` — Script Ruby que insere 15 jogos reais da Copa 2026 distribuídos em 6 dias (11–17 jun 2026). Times incluídos: México, Canadá, EUA (sedes), Argentina, Brasil, Espanha, França, Alemanha, Portugal, Inglaterra, Holanda, Itália, Japão, Coreia do Sul. Usa `net/http` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Idempotente com `Prefer: return=minimal`.

---

## Decisões técnicas

1. **Server Component para a página `/jogos`**: A página busca dados via Supabase server client diretamente (sem fetch HTTP interno para `/api/games`). Isso evita uma roundtrip HTTP desnecessária em SSR e é mais eficiente. O endpoint `/api/games` existe para uso futuro por client components ou integrações externas.

2. **`todayInBrasilia()` com `America/Sao_Paulo`**: A Copa 2026 acontece em países com fusos diferentes, mas o bolão é brasileiro. A data "padrão" ao acessar `/jogos` usa o horário de Brasília para que o usuário veja os jogos do seu "hoje".

3. **Filtro de data via `gte`/`lte`**: Em vez de usar `match_date::date = $date` (que exigiria RPC ou SQL raw), filtramos com `gte(startOfDay)` e `lte(endOfDay)` ambos em UTC. Isso é compatível com o cliente Supabase JS e cobre todos os horários do dia.

4. **`GameCard` como Server Component**: Não há interatividade no card (apenas exibição). O badge `██ AO VIVO ██` usa a classe CSS `blink` definida em `globals.css` — sem state ou efeitos. `DayNavigator` é Client Component por usar `useRouter` para navegação programática.

5. **Agrupamento por rodada no `GameList`**: Quando há múltiplos grupos no mesmo dia, os jogos são organizados com separadores de rodada para melhor escaneabilidade (padrão Elifoot).

6. **Grid responsivo com `auto-fill`**: `repeat(auto-fill, minmax(280px, 1fr))` garante coluna única em mobile (< 280px de largura disponível) e múltiplas colunas em telas maiores, sem breakpoints fixos.

---

## Pontos de atenção para o Revisor

1. **Tabela `predictions` pode não existir**: A query de contagem de palpites usa `supabase.from('predictions')`. Se a tabela ainda não foi criada no Supabase (feature futura), o código não quebra — o erro é silencioso e `guessCount` fica 0.

2. **Seed script não é idempotente contra duplicatas**: O script insere sem verificar duplicatas. Se rodar duas vezes, duplica os jogos. Para idempotência real, seria necessário adicionar uma UNIQUE constraint em `(home_team_code, away_team_code, match_date)` e usar `ON CONFLICT DO NOTHING`.

3. **Datas dos jogos**: Os horários dos jogos no seed são aproximações baseadas no calendário Copa 2026 publicado. Devem ser conferidos com o calendário oficial FIFA antes de usar em produção.

4. **`searchParams` como Promise**: Next.js 15 tornou `searchParams` uma Promise assíncrona. A página já usa `await searchParams` corretamente.

---

## Commits realizados

```
cb61131 feat(game-navigation): substitui placeholder de /jogos com implementação real
2ed58a2 feat(game-navigation): adiciona componentes GameCard, GameList e DayNavigator
90553e3 feat(game-navigation): adiciona API route GET /api/games com autenticação e filtro por data
9986d64 feat(game-navigation): adiciona seed script Ruby com 15 jogos reais da Copa 2026
904d00f feat(game-navigation): adiciona migration SQL para tabela games com RLS
92e2866 feat(game-navigation): adiciona tipos TypeScript Game e GameStatus
```
