# Fix 1: game-navigation

**Slug:** game-navigation
**Data:** 2026-06-13
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `formatMatchDate` usa `.replace()` não-global para remover pontos
**Arquivo:** `components/games/GameCard.tsx` (linha 26)
**Severidade:** menor
**Descrição:** `.replace('.', '')` remove apenas o primeiro ponto encontrado na string. Abreviações de meses em pt-BR incluem ponto (ex: "jun.", "ago.", "set."). Se a string tiver mais de um ponto, apenas o primeiro é removido.
**Correção esperada:** Substituir por `.replace(/\./g, '')` (regex global).

### Problema 2: `formatDateDisplay` usa `.replace(' DE ', ' ')` não-global
**Arquivo:** `components/games/DayNavigator.tsx` (linha 22)
**Severidade:** importante
**Descrição:** O formato pt-BR para data longa com `weekday + day + month + year` produz: "sábado, 13 de jun. de 2026". Após uppercase e remoção de pontos, fica: "SÁBADO, 13 DE JUN DE 2026". O `.replace(' DE ', ' ')` sem flag global substitui apenas a primeira ocorrência, resultando em "SÁBADO, 13 JUN DE 2026" em vez de "SÁBADO, 13 JUN 2026".
**Correção esperada:** Substituir por `.replace(/ DE /g, ' ')` (regex global).

---

## Itens OK (não precisam ser revisados novamente)

- Tipos TypeScript (`lib/types/game.ts`): corretos, completos
- Migration SQL (`db/migrations/20260613_create_games.sql`): correta, RLS habilitado, políticas adequadas
- Seed script (`db/seeds/seed_games.rb`): 15 jogos em 6 dias, dados realistas, sem credenciais hardcoded
- API route (`app/api/games/route.ts`): autenticação obrigatória, validação de data, error handling completo
- `app/(dashboard)/jogos/page.tsx`: Server Component correto, Next.js 15 `searchParams` como Promise, contagem de palpites funcional
- `components/games/GameList.tsx`: estado vazio, agrupamento por rodada, layout responsivo
- `components/games/GameCard.tsx`: layout Elifoot correto, status correto, live badge com classe `blink`
- `components/games/DayNavigator.tsx`: Client Component, `useRouter`, botões com `Button` existente, hoje em destaque
- Design: paleta de cores correta, tipografia monospace, sem sombras, sem ícones decorativos
- Segurança: sem credenciais hardcoded, sem SQL injection (usa Supabase client)
- Branch: `feature/game-navigation` correta
- Commits em português com prefixos corretos
