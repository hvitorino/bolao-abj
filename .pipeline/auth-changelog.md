# Changelog: Autenticação

**Slug:** auth
**Branch:** feature/auth
**Data:** 2026-06-13
**Status:** aguardando revisão

---

## O que foi implementado

### Configuração do Projeto
- Projeto Next.js 15 inicializado com Tailwind CSS 4, TypeScript e ESLint
- Dependências Supabase instaladas: `@supabase/supabase-js@^2.108.1` e `@supabase/ssr@^0.12.0`
- `.gitignore` configurado para excluir `node_modules`, `.next/`, `.env.local`, etc.
- `.env.local` com placeholders para `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Frontend (Next.js/React)
- `app/globals.css` — Variáveis CSS da paleta completa de DESIGN.md (`color-primary`, `color-accent`, `color-secondary`, `color-bg`, `color-surface`, `color-border`, `color-text`, `color-muted`, `color-live`, `color-win`, `color-error`). Import da fonte JetBrains Mono via Google Fonts. Animação `blink` para indicadores ao vivo.
- `app/layout.tsx` — Root layout com `JetBrains_Mono` via `next/font/google`, metadata em português, aplica `font-mono min-h-screen` e `var(--color-bg)` no body.
- `app/page.tsx` — Rota raiz que redireciona para `/jogos` (se autenticado) ou `/login` (se não autenticado).
- `app/(auth)/layout.tsx` — Layout público sem navegação, centraliza o conteúdo verticalmente na tela completa com `display: flex; align-items: center; justify-content: center`.
- `app/(auth)/login/page.tsx` — Formulário de login com estados `idle/loading/error/success`. Campos: e-mail e senha. Mapeamento de erros do Supabase Auth para português. Redireciona para `/jogos` em caso de sucesso. Link para `/cadastro`.
- `app/(auth)/cadastro/page.tsx` — Formulário de cadastro com campos: nome, e-mail, senha e confirmar senha. Validação client-side de senhas divergentes (borda vermelha no campo). Mapeamento de erros para português. Trata ambos os casos: com e sem confirmação de e-mail ativa no Supabase. Link para `/login`.
- `app/(dashboard)/layout.tsx` — Layout protegido (Server Component) que verifica `supabase.auth.getUser()` e redireciona para `/login` se sem sessão. Header com e-mail do usuário e botão de logout. Container com padding para o conteúdo.
- `app/(dashboard)/logout-button.tsx` — Client Component com botão de logout que chama `supabase.auth.signOut()` e redireciona para `/login`.
- `app/(dashboard)/jogos/page.tsx` — Página placeholder para a rota `/jogos` (implementação completa na feature `game-navigation`).
- `components/ui/Button.tsx` — Botão reutilizável com variantes `primary`, `secondary` e `danger`. Uppercase, sem sombra, borda simples, fonte monospace, estado `disabled` com opacidade reduzida.
- `components/ui/Input.tsx` — Input reutilizável com suporte a `label`, `error`, `hasError`. Estilos: `bg: color-surface`, borda `color-border` (erro: `color-error`), focus `color-primary`. Label em uppercase/muted.

### Infraestrutura Auth (Supabase)
- `lib/supabase/client.ts` — `createBrowserClient` via `@supabase/ssr` (singleton factory, usa variáveis `NEXT_PUBLIC_*`)
- `lib/supabase/server.ts` — `createServerClient` assíncrono via `@supabase/ssr` com `cookies()` do `next/headers` para SSR correto
- `middleware.ts` — Next.js middleware que: renova sessão automaticamente via `@supabase/ssr`, redireciona usuário não autenticado para `/login`, redireciona usuário autenticado em rotas públicas para `/jogos`. Matcher configurado para ignorar arquivos estáticos.

### Banco de Dados
- Migration SQL definida na spec (`auth-spec.md`) para ser executada manualmente no Supabase SQL Editor. Cria tabela `profiles`, habilita RLS, define políticas de acesso e trigger `on_auth_user_created` para criação automática de perfil.
- Nenhuma migration foi aplicada automaticamente (projeto não usa CLI de migrations).

---

## Decisões técnicas

1. **`@supabase/ssr` em vez de `@supabase/auth-helpers-nextjs`**: O pacote `@supabase/ssr` é o recomendado atual pela Supabase para Next.js 15 com App Router, substituindo o legado `auth-helpers-nextjs`. Ele gerencia cookies HttpOnly de forma compatível com Server Components e middleware.

2. **`next/font/google` para JetBrains Mono**: A spec indica o uso de `next/font/google` para carregar a fonte. Isso foi implementado no root layout. O `globals.css` também mantém o `@import` do Google Fonts como fallback, garantindo que a fonte esteja disponível mesmo se o `next/font` falhar.

3. **`logout-button.tsx` como arquivo separado**: O layout do dashboard é um Server Component (necessário para verificar a sessão com `auth.getUser()`). O botão de logout precisa de interatividade (`onClick`), então foi extraído para um Client Component separado — padrão recomendado pelo App Router.

4. **Rota `/jogos` placeholder**: A spec lista `/jogos` como destino do redirect pós-login, mas a feature `game-navigation` ainda não foi implementada. Uma página placeholder foi criada para que o redirect não resulte em 404.

5. **Tratamento duplo de erro de e-mail já cadastrado**: O Supabase pode retornar `User already registered` ou `already been registered` dependendo da versão. O mapeamento cobre ambas as variantes.

6. **Variável `senhasDiv`**: Nome intencional da variável booleana de divergência de senhas (não é um typo de `senha` — é uma variável de verificação de divergência, abreviação de "senhas divergem").

---

## Pontos de atenção para o Revisor

1. **Variáveis de ambiente**: O arquivo `.env.local` contém apenas placeholders. O projeto não vai funcionar sem as variáveis reais do Supabase preenchidas. Isso é esperado — a configuração é responsabilidade do ambiente de deploy.

2. **Migration SQL**: A tabela `profiles` e o trigger `on_auth_user_created` precisam ser criados manualmente no Supabase SQL Editor antes de o cadastro funcionar end-to-end.

3. **Confirmação de e-mail**: A spec recomenda desativar a confirmação de e-mail no painel Supabase (Authentication → Settings → "Enable email confirmations"). O código trata ambos os casos, mas o fluxo "feliz" assume confirmação desativada.

4. **Tailwind CSS 4**: Esta versão do Tailwind usa `@import "tailwindcss"` em vez de `@tailwind base/components/utilities`. O `globals.css` usa a sintaxe correta para v4.

5. **Fonte monospace no `body`**: A fonte JetBrains Mono é aplicada via variável CSS `--font-mono` (gerada pelo `next/font`) e via `font-family` inline no body. Verificar se o Tailwind está reconhecendo `font-mono` nos componentes.

---

## Commits realizados

```
6e6b1c3 feat(auth): adiciona layout protegido do dashboard com botão de logout e rotas placeholder
63031d0 feat(auth): implementa páginas de login e cadastro com formulários e validação
10316fb feat(auth): adiciona componentes UI reutilizáveis Button e Input com estilo DESIGN.md
10549e5 feat(auth): adiciona middleware Next.js com proteção de rotas e refresh de sessão
58e054f feat(auth): adiciona clientes Supabase browser e server (SSR)
e6ada6c feat(auth): adiciona globals.css com paleta DESIGN.md e root layout com JetBrains Mono
4bb3ad6 chore(auth): inicializa projeto Next.js 15 com Tailwind CSS 4 e TypeScript
d4b4e96 chore(auth): adiciona plano de implementação da feature de autenticação
```
