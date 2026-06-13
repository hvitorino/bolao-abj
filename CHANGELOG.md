# Changelog — Bolão do Cartola ABJ

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

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
- **Seed script:** `db/seeds/seed_games.rb` — 15 jogos placeholder/fictícios da Copa 2026 em 6 dias (11–16 jun), explicitamente não oficiais e usados apenas para desenvolvimento até existir fonte verificável

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
