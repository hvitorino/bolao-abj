# Changelog — Bolão do Cartola ABJ

Histórico de implementações aprovadas pelo Revisor.

---

<!-- Entradas adicionadas pelo Revisor após cada feature aprovada -->

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
