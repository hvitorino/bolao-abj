# Spec: Autenticação

**Slug:** auth
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Implementar o sistema de autenticação do Bolão do Cartola ABJ usando Supabase Auth, permitindo que participantes se cadastrem com e-mail e senha e façam login, com criação automática de perfil na tabela `profiles` e proteção de todas as rotas da área logada.

---

## Histórias de Usuário

- Como participante novo, quero me cadastrar com e-mail e senha para ter acesso ao bolão
- Como participante cadastrado, quero fazer login para acessar meus palpites e o ranking
- Como participante não autenticado, quero ser redirecionado para `/login` ao tentar acessar uma rota protegida, para saber que preciso me autenticar
- Como participante logado, quero que minha sessão persista entre recarregamentos para não precisar fazer login a cada visita
- Como participante em erro, quero ver mensagens claras (ex: "E-mail já cadastrado", "Senha incorreta") para saber o que corrigir

---

## Modelo de Dados

### Tabelas novas ou modificadas

**profiles** (já definida no modelo de dados):

```sql
profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
)
```

- `id`: mesmo UUID gerado pelo Supabase Auth para o usuário
- `name`: nome de exibição do participante (extraído do e-mail no cadastro, editável futuramente)
- `avatar_url`: NULL no cadastro inicial
- `created_at`: timestamp automático de criação

### Migrations necessárias

**Migration 001 — Criar tabela profiles e trigger de auto-criação:**

```sql
-- Criar tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: usuário só vê seu próprio perfil
CREATE POLICY "Usuário pode ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Política: usuário pode atualizar seu próprio perfil
CREATE POLICY "Usuário pode atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Política: leitura pública de perfis (para ranking, etc.)
CREATE POLICY "Perfis são visíveis publicamente"
  ON public.profiles FOR SELECT
  USING (true);

-- Trigger: criar perfil automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

> **Nota:** A migration deve ser executada diretamente no Supabase SQL Editor. Não há CLI de migrations neste projeto.

---

## Backend — Endpoints Ruby/Sinatra

A feature de autenticação é inteiramente gerenciada pelo **Supabase Auth no cliente** (via SDK JavaScript). Não há endpoints Ruby/Sinatra necessários para esta feature.

O Supabase Auth expõe os métodos `signUp`, `signInWithPassword` e `signOut` diretamente no client-side SDK — não é necessário criar um intermediário Ruby para autenticação básica com e-mail/senha.

---

## Frontend — Componentes React

### Estrutura de arquivos a criar

```
app/
├── (auth)/
│   ├── layout.tsx              # Layout das rotas públicas (sem sidebar)
│   ├── login/
│   │   └── page.tsx            # Página de login
│   └── cadastro/
│       └── page.tsx            # Página de cadastro
├── (dashboard)/
│   └── layout.tsx              # Layout protegido com middleware check
├── layout.tsx                  # Root layout (providers, fonts)
└── globals.css                 # Variáveis CSS da paleta DESIGN.md

lib/
└── supabase/
    ├── client.ts               # Supabase browser client
    ├── server.ts               # Supabase server client (SSR)
    └── middleware.ts           # Helper de proteção de rotas

components/
└── ui/
    ├── Button.tsx              # Botão reutilizável
    └── Input.tsx               # Input reutilizável

middleware.ts                   # Next.js middleware para proteção de rotas
```

---

### LoginForm

**Arquivo:** `app/(auth)/login/page.tsx`
**Props:** nenhuma (Server Component com Client Component interno)
**Estados:**
- `idle`: formulário vazio aguardando input
- `loading`: requisição em andamento (botão desabilitado, texto "ENTRANDO...")
- `error`: exibe mensagem de erro em `color-error`
- `success`: redireciona para `/jogos`

**Comportamento:**
- Campos: `email` (type="email", required) e `senha` (type="password", required, min 6 chars)
- Ao submeter: chama `supabase.auth.signInWithPassword({ email, password })`
- Em caso de erro `Invalid login credentials`: exibe "E-mail ou senha incorretos"
- Em caso de erro `Email not confirmed`: exibe "Confirme seu e-mail antes de fazer login"
- Em sucesso: `router.push('/jogos')`
- Link para cadastro: "Não tem conta? CADASTRE-SE" → `/cadastro`

**Design (DESIGN.md):**
- Background da página: `color-bg` (`#0a0e1a`)
- Card central com borda: `1px solid var(--color-border)`, bg `color-surface`
- Título: `BOLÃO DO CARTOLA ABJ` em uppercase, `color-accent`, fonte monospace Bold
- Subtítulo: `LOGIN` em uppercase, `color-muted`
- Inputs: bg `color-surface`, borda `color-border`, focus `color-primary`, texto `color-text`, fonte monospace
- Botão: bg `color-primary`, texto `color-bg`, uppercase, sem sombra, borda `1px solid color-primary`
- Mensagens de erro: texto `color-error`, prefixo `✗ `
- Layout: centralizado verticalmente, max-width 400px, padding 2rem

---

### CadastroForm

**Arquivo:** `app/(auth)/cadastro/page.tsx`
**Props:** nenhuma
**Estados:**
- `idle`: formulário vazio
- `loading`: "CRIANDO CONTA..."
- `error`: mensagem de erro
- `success`: exibe mensagem "Conta criada! Verifique seu e-mail." (se confirmação ativa) ou redireciona para `/jogos`

**Comportamento:**
- Campos: `nome` (text, required), `email` (type="email", required), `senha` (type="password", required, min 6 chars), `confirmar-senha` (type="password", required)
- Validação client-side: senhas devem ser iguais antes de submeter
- Ao submeter: chama `supabase.auth.signUp({ email, password, options: { data: { name } } })`
- O trigger `on_auth_user_created` cria o perfil automaticamente
- Em caso de erro `User already registered`: exibe "E-mail já cadastrado. Faça login."
- Em caso de erro de senha fraca: exibe "Senha muito fraca. Use pelo menos 6 caracteres."
- Em sucesso (sem confirmação de e-mail): redireciona para `/jogos`
- Link para login: "Já tem conta? FAÇA LOGIN" → `/login`

**Design (DESIGN.md):**
- Mesma estrutura visual do LoginForm
- Título do card: `NOVO PARTICIPANTE`
- Subtítulo: `CADASTRO`
- Validação inline de confirmação de senha: borda vermelha no campo se divergente

---

### Supabase Client — lib/supabase/client.ts

Cliente browser (singleton) usando `@supabase/ssr`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

### Supabase Server Client — lib/supabase/server.ts

Cliente server-side para uso em Server Components e middleware:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

---

### Middleware de Proteção — middleware.ts

Arquivo `middleware.ts` na raiz do projeto (Next.js middleware):

```typescript
// Rotas protegidas: qualquer rota que NÃO seja /login ou /cadastro
// Se não autenticado → redireciona para /login
// Se autenticado em /login ou /cadastro → redireciona para /jogos
```

**Lógica:**
1. Usar `@supabase/ssr` para criar client no middleware
2. Chamar `supabase.auth.getUser()` para verificar sessão
3. Se rota protegida e sem sessão → `NextResponse.redirect('/login')`
4. Se rota pública (login/cadastro) e com sessão → `NextResponse.redirect('/jogos')`
5. Sempre retornar resposta com cookies atualizados (refresh de token)

**Matcher config:**
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

### Root Layout — app/layout.tsx

**Responsabilidades:**
- Importar e aplicar fonte `JetBrains Mono` via `next/font/google`
- Aplicar classes base: `bg-[var(--color-bg)] text-[var(--color-text)] font-mono min-h-screen`
- Incluir variáveis CSS da paleta DESIGN.md no `globals.css`
- Não inclui navegação (cada grupo de rotas tem seu próprio layout)

---

### Auth Layout — app/(auth)/layout.tsx

Layout para as rotas públicas (login e cadastro):
- Sem sidebar ou header de navegação
- Centra o conteúdo verticalmente na tela completa
- Background: `color-bg`

---

### Dashboard Layout — app/(dashboard)/layout.tsx

Layout placeholder para as rotas protegidas:
- Verificação de autenticação (Server Component)
- Placeholder de header/navegação (implementado em features futuras)
- Renderiza `{children}` dentro de um container com padding

---

## Regras de Negócio

1. **Criação automática de perfil:** O trigger `on_auth_user_created` deve criar o registro em `profiles` imediatamente após o `signUp`. O campo `name` é extraído de `raw_user_meta_data.name` (passado no `signUp`) ou derivado do e-mail (parte antes do `@`).

2. **Confirmação de e-mail:** Para simplificar o fluxo do bolão (grupo pequeno de amigos), configurar o Supabase para **não exigir confirmação de e-mail**. Isso é feito no painel do Supabase: Authentication → Settings → desativar "Enable email confirmations". A spec assume esse estado, mas o código deve tratar ambos os casos graciosamente.

3. **Proteção de rotas:** Toda rota fora do grupo `(auth)` é protegida. O middleware Next.js é a camada principal de proteção. Os layouts de Server Components fazem verificação secundária com `supabase.auth.getUser()`.

4. **Persistência de sessão:** O `@supabase/ssr` gerencia a sessão via cookies HttpOnly, garantindo persistência entre recarregamentos e SSR correto. O `createBrowserClient` em componentes cliente escuta mudanças de sessão via `onAuthStateChange`.

5. **Senhas:** Mínimo 6 caracteres (validação client-side e política do Supabase Auth). Não há regras adicionais de complexidade para este bolão informal.

6. **Logout:** Implementar botão de logout (placeholder no Dashboard Layout) que chama `supabase.auth.signOut()` e redireciona para `/login`.

---

## Proteção de Rotas

| Rota | Tipo | Comportamento |
|------|------|---------------|
| `/login` | Pública | Se autenticado, redireciona para `/jogos` |
| `/cadastro` | Pública | Se autenticado, redireciona para `/jogos` |
| `/` (root) | Protegida | Redireciona para `/login` se não autenticado, `/jogos` se autenticado |
| `/jogos` | Protegida | Redireciona para `/login` se não autenticado |
| `/ranking` | Protegida | Redireciona para `/login` se não autenticado |
| `/meus-palpites` | Protegida | Redireciona para `/login` se não autenticado |

**Implementação do middleware:**
- Arquivo: `middleware.ts` na raiz do projeto
- Usa `updateSession` helper do `@supabase/ssr` para renovar tokens automaticamente
- Rotas públicas definidas na lista `publicRoutes = ['/login', '/cadastro']`

---

## Integração Supabase Realtime

Não aplicável para esta feature. Auth não usa Realtime.

---

## Variáveis de Ambiente

As seguintes variáveis devem estar configuradas no `.env.local` e no Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Dependências npm a instalar

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Critérios de Aceite

- [ ] Usuário consegue se cadastrar com e-mail e senha e ter perfil criado automaticamente na tabela `profiles`
- [ ] Usuário consegue fazer login com e-mail e senha válidos e ser redirecionado para `/jogos`
- [ ] Usuário não autenticado é redirecionado para `/login` ao tentar acessar `/jogos`, `/ranking` ou `/meus-palpites`
- [ ] Usuário autenticado que acessa `/login` ou `/cadastro` é redirecionado para `/jogos`
- [ ] Sessão persiste entre recarregamentos de página (fechar e reabrir o browser não desloga)
- [ ] Erro "E-mail já cadastrado. Faça login." exibido ao tentar cadastrar e-mail existente
- [ ] Erro "E-mail ou senha incorretos" exibido ao tentar login com credenciais inválidas
- [ ] Erro de senhas divergentes exibido client-side antes de submeter o formulário de cadastro
- [ ] Interface 100% em português
- [ ] Fonte monospace (JetBrains Mono) em toda a interface
- [ ] Paleta de cores DESIGN.md aplicada: `color-bg`, `color-surface`, `color-border`, `color-primary`, `color-accent`, `color-error`, `color-muted`, `color-text`
- [ ] Botões em uppercase sem sombra, borda simples
- [ ] Formulários funcionam em mobile (coluna única, max-width 400px centralizado)
- [ ] Dark mode only (nenhum estilo claro)
- [ ] Botão de logout funcional no layout do dashboard
