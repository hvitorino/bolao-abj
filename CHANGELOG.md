# Changelog — Bolão do Cartola ABJ

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

## [predictions] — Palpites — 2026-06-13

- Sistema de palpites na rota `/jogos`: cada GameCard exibe formulário inline para jogos pendentes
- Formulário com dois inputs numéricos estilo LED (borda `color-accent`) para placar casa × visitante
- Deadline automático de 5 minutos antes do início: inputs bloqueados, mensagem "✗ PRAZO ENCERRADO"
- Countdown visual "⏱ FECHA EM Xh Ymin" quando faltam < 2h; muda para `color-error` quando < 30min
- Palpite enviado exibido com "✓ SEU PALPITE" em borda `color-primary`, placar `color-accent`; imutável após envio
- Jogos ao vivo e encerrados: exibe palpite (se enviado) ou "SEM PALPITE" em `color-muted`
- Feedback visual imediato: loading durante envio, mensagem de sucesso/erro após resposta da API
- **Endpoints criados:** `POST /api/predictions` (registra com validação deadline + JWT), `GET /api/predictions?game_id=UUID`
- **Componentes criados:** `PredictionForm.tsx` (Client), `PredictionDisplay.tsx`
- **Componentes modificados:** `GameCard.tsx` (Client Component + prop prediction), `GameList.tsx` (prop predictionsByGameId), `app/(dashboard)/jogos/page.tsx` (busca predictions server-side)
- **Tipos:** `lib/types/prediction.ts` — interface `Prediction`
- **Migration SQL:** `db/migrations/20260613_create_predictions.sql` — tabela `predictions`, UNIQUE(user_id, game_id), RLS (SELECT + INSERT apenas próprio usuário, sem UPDATE/DELETE)

## [game-navigation] — Navegação de Jogos — 2026-06-13

- Visualização de jogos da Copa 2026 por dia na rota `/jogos` (substituiu placeholder)
- Navegação entre dias com botões `◀` e `▶` via URL `?date=YYYY-MM-DD`
- Data padrão ao acessar `/jogos`: dia atual no horário de Brasília (UTC-3)
- Destaque visual para o dia atual ("HOJE") em `color-accent`
- Contagem de jogos por dia e palpites registrados no cabeçalho de navegação
- Jogos ao vivo com badge `██ AO VIVO ██` piscante (`blink`) e borda em `color-live`
- Placar exibido em `color-accent` (quando disponível); status "PENDENTE", "AO VIVO", "ENCERRADO"
- Estado vazio: "NENHUM JOGO NESTE DIA" quando não há jogos na data
- **Endpoints criados:** `GET /api/games?date=YYYY-MM-DD` (autenticado, 401/400/500 tratados)
- **Componentes criados:** `GameCard.tsx`, `GameList.tsx`, `DayNavigator.tsx`
- **Tipos:** `lib/types/game.ts` — interface `Game`, type `GameStatus`
- **Migration SQL:** `db/migrations/20260613_create_games.sql` — tabela `games`, RLS, índices
- **Seed script:** `db/seeds/seed_games.rb` — 15 jogos reais da Copa 2026 em 6 dias (11–17 jun)

---

## [auth] — Autenticação — 2026-06-13

- Sistema de autenticação completo via Supabase Auth (e-mail e senha)
- Cadastro de novos participantes com criação automática de perfil na tabela `profiles` via trigger `on_auth_user_created`
- Login com mapeamento de erros em português ("E-mail ou senha incorretos", "E-mail já cadastrado. Faça login.")
- Proteção de rotas via Next.js middleware: não autenticado → `/login`; autenticado em rota pública → `/jogos`
- Persistência de sessão via cookies HttpOnly gerenciados pelo `@supabase/ssr`
- Botão de logout funcional no header do dashboard
- Paleta DESIGN.md aplicada (`color-bg`, `color-surface`, `color-border`, `color-primary`, `color-accent`, `color-error`, `color-muted`, `color-text`)
- Fonte JetBrains Mono em toda a interface via `next/font/google`
- Interface 100% em português, dark mode only, mobile-first (max-width 400px)
- **Componentes criados:** `Button.tsx`, `Input.tsx`, `LogoutButton.tsx`
- **Arquivos de infraestrutura:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`
- **Páginas:** `app/(auth)/login/page.tsx`, `app/(auth)/cadastro/page.tsx`, `app/(dashboard)/jogos/page.tsx` (placeholder)
- **Layouts:** `app/layout.tsx` (root), `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`
- **Migration SQL** (execução manual no Supabase SQL Editor): tabela `profiles`, RLS policies, trigger `on_auth_user_created`
