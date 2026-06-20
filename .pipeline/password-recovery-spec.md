# Spec: Recuperação de Senha por Email

**Slug:** password-recovery
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Adicionar o fluxo completo de recuperação de senha ao bolão, integrado ao Supabase Auth. O usuário que esqueceu a senha pode solicitar um link de redefinição informando o e-mail cadastrado; o Supabase envia o e-mail automaticamente; ao clicar no link, o usuário é redirecionado para uma tela dentro do produto onde define a nova senha.

---

## Histórias de Usuário

- Como participante que esqueceu a senha, quero informar meu e-mail e receber um link de redefinição para recuperar o acesso ao bolão sem precisar criar uma nova conta.
- Como participante, quero ser redirecionado para uma tela clara dentro do produto onde eu possa digitar e confirmar minha nova senha após clicar no link recebido por e-mail.
- Como participante, quero ver mensagens de erro claras em português caso eu informe um e-mail não cadastrado ou tente definir uma senha inválida.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma. O fluxo de recuperação de senha é gerenciado inteiramente pelo Supabase Auth — sem tabelas novas, sem migrations.

O Supabase gerencia internamente o token de recuperação (OTP/PKCE) e o `auth.users`. A tabela `profiles` existente não é afetada.

### Migrations necessárias

Nenhuma migration SQL necessária.

**Configuração obrigatória no painel Supabase (fora do código):**
- Em Authentication → URL Configuration → "Redirect URLs", adicionar `<NEXT_PUBLIC_SITE_URL>/auth/callback` à lista de URLs permitidas.
- O "Site URL" já deve estar configurado com a URL de produção (`https://<projeto>.vercel.app`) e com `http://localhost:3000` para desenvolvimento.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. Todo o fluxo usa o Supabase Auth diretamente via SDK client-side (`@supabase/supabase-js`) e um Route Handler Next.js para o callback PKCE.

---

## Frontend — Componentes React

### Rota de callback PKCE — `app/auth/callback/route.ts`

**Tipo:** Route Handler (Next.js App Router, arquivo `route.ts`)
**Método:** GET
**Path:** `/auth/callback`
**Autenticação:** pública (é o destino do link enviado pelo Supabase)

**Responsabilidade:** Receber o `code` da query string, trocá-lo por sessão via `supabase.auth.exchangeCodeForSession(code)`, e redirecionar o usuário para o destino correto.

**Comportamento:**

```
GET /auth/callback?code=<pkce_code>&next=/nova-senha
```

1. Ler `code` e `next` da query string (`searchParams`).
2. Se `code` presente: chamar `supabase.auth.exchangeCodeForSession(code)` usando o cliente server-side (`lib/supabase/server.ts`).
   - Se sucesso: redirecionar para `next` (padrão: `/jogos`). Validar que `next` começa com `/` para evitar open redirect.
   - Se erro: redirecionar para `/login?error=link-invalido`.
3. Se `code` ausente: redirecionar para `/login`.

**Nota de implementação:** O cliente server-side (`createClient` de `lib/supabase/server.ts`) já gerencia cookies corretamente para SSR — usar o mesmo padrão de todos os outros Route Handlers do projeto. O `exchangeCodeForSession` grava a sessão nos cookies HttpOnly antes do redirect, então a página `/nova-senha` terá sessão disponível ao carregar.

---

### Página de solicitação de recuperação — `app/(auth)/esqueci-senha/page.tsx`

**Arquivo:** `app/(auth)/esqueci-senha/page.tsx`
**Rota:** `/esqueci-senha`
**Grupo de rotas:** `(auth)` — público, sem autenticação obrigatória, herda o layout centralizado de `app/(auth)/layout.tsx`
**Tipo:** Client Component (`'use client'`)

**Props:** nenhuma (rota de página)

**Estados internos:**
- `email: string` — valor do campo de e-mail
- `estado: 'idle' | 'loading' | 'enviado' | 'error'`
- `mensagemErro: string`

**Comportamento:**

- Estado `idle`: exibe formulário com campo de e-mail e botão "ENVIAR LINK".
- Estado `loading`: botão desabilitado, texto "ENVIANDO...".
- Estado `enviado`: oculta o formulário; exibe mensagem de confirmação em `color-win`:
  ```
  ✓ LINK ENVIADO
  Verifique seu e-mail. O link expira em 1 hora.
  ```
  Exibe link de volta para `/login`.
- Estado `error`: exibe mensagem de erro abaixo do campo, borda `color-error` no card.

**Lógica de submit:**
```typescript
const supabase = createClient() // lib/supabase/client.ts
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
})
```

**Tratamento de erros — mapear para português:**
- `"Unable to validate email address: invalid format"` → `"Formato de e-mail inválido"`
- Qualquer outro erro → `"Ocorreu um erro. Tente novamente."`

**Nota sobre e-mail não cadastrado:** O Supabase, por segurança, retorna sucesso mesmo quando o e-mail não existe na base — ele não revela se o e-mail está cadastrado ou não. O estado `enviado` deve usar linguagem genérica: "Se este e-mail estiver cadastrado, você receberá o link em instantes."

**Layout visual (seguir DESIGN.md rigorosamente):**

```
┌──────────────────────────────────────────────────────┐
│           BOLÃO DA COPA                              │
│           RECUPERAR SENHA                            │
├──────────────────────────────────────────────────────┤
│  E-MAIL                                              │
│  [ seu@email.com                                   ] │
│                                                      │
│  [ ENVIAR LINK DE RECUPERAÇÃO ]                      │
├──────────────────────────────────────────────────────┤
│  Lembrou a senha? LOGIN                              │
└──────────────────────────────────────────────────────┘
```

- Card: `maxWidth: 400px`, `backgroundColor: var(--color-surface)`, `border: 1px solid var(--color-border)`, `padding: 2rem`
- Título: `color-accent`, bold, uppercase, `letter-spacing: 0.1em`, `font-size: 16px`
- Subtítulo: `color-muted`, uppercase, `font-size: 12px`
- Usar componentes existentes `<Input>` (`components/ui/Input.tsx`) e `<Button>` (`components/ui/Button.tsx`)
- Link para login: `color-primary`, uppercase, bold

---

### Página de nova senha — `app/(auth)/nova-senha/page.tsx`

**Arquivo:** `app/(auth)/nova-senha/page.tsx`
**Rota:** `/nova-senha`
**Grupo de rotas:** `(auth)` — usa o layout público centralizado, mas requer que o usuário tenha sessão ativa (estabelecida pelo callback PKCE antes do redirect para cá)
**Tipo:** Client Component (`'use client'`)

**Props:** nenhuma (rota de página)

**Estados internos:**
- `novaSenha: string`
- `confirmarSenha: string`
- `estado: 'idle' | 'loading' | 'sucesso' | 'error' | 'sessao-invalida'`
- `mensagemErro: string`

**Comportamento ao montar (`useEffect` no mount):**
Verificar se há sessão ativa com `supabase.auth.getSession()`. Se não houver sessão (usuário acessou `/nova-senha` diretamente sem passar pelo link):
- Definir `estado = 'sessao-invalida'`
- Exibir mensagem: `"✗ LINK INVÁLIDO OU EXPIRADO — Solicite um novo link de recuperação."` com botão para `/esqueci-senha`

**Validação client-side antes do submit:**
- `novaSenha.length < 6` → erro: `"A senha deve ter pelo menos 6 caracteres"`
- `novaSenha !== confirmarSenha` → borda `color-error` no campo "confirmar", erro: `"As senhas não coincidem"`

**Lógica de submit:**
```typescript
const supabase = createClient() // lib/supabase/client.ts
const { error } = await supabase.auth.updateUser({ password: novaSenha })
```

**Tratamento de erros — mapear para português:**
- `"New password should be different from the old password"` → `"A nova senha deve ser diferente da senha atual"`
- `"Auth session missing"` → `"Sessão expirada. Solicite um novo link de recuperação."` + link para `/esqueci-senha`
- Qualquer outro erro → `"Ocorreu um erro ao atualizar a senha. Tente novamente."`

**Estado `sucesso`:**
- Ocultar formulário
- Exibir:
  ```
  ✓ SENHA ATUALIZADA
  Sua nova senha foi definida com sucesso.
  ```
- Após 2 segundos, redirecionar automaticamente para `/jogos` via `router.push('/jogos')`
- Também exibir link manual: `"IR PARA O BOLÃO →"` em `color-primary`

**Layout visual (seguir DESIGN.md rigorosamente):**

```
┌──────────────────────────────────────────────────────┐
│           BOLÃO DA COPA                              │
│           NOVA SENHA                                 │
├──────────────────────────────────────────────────────┤
│  NOVA SENHA                                          │
│  [ ••••••                                          ] │
│                                                      │
│  CONFIRMAR NOVA SENHA                                │
│  [ ••••••                                          ] │
│                                                      │
│  [ SALVAR NOVA SENHA ]                               │
└──────────────────────────────────────────────────────┘
```

- Mesma estrutura de card do `esqueci-senha`
- Usar componentes existentes `<Input type="password">` e `<Button>`
- Dois campos: `autoComplete="new-password"` em ambos

---

### Modificação em `app/(auth)/login/page.tsx`

Adicionar link "Esqueceu a senha?" abaixo do botão de submit, antes do separador para cadastro:

```
[ ENTRAR ]

Esqueceu a senha? RECUPERAR ACESSO

Não tem conta? CADASTRE-SE
```

- O link aponta para `/esqueci-senha`
- Estilo: `color-muted` para o texto, `color-primary` uppercase bold para o link clicável
- Inserir entre o `<Button>` de submit e o separador `<div>` que precede o link de cadastro

---

## Regras de Negócio

1. **Não revelar existência de e-mail:** A tela `/esqueci-senha` exibe a mesma mensagem de confirmação independentemente de o e-mail existir ou não no banco — isso é comportamento do Supabase Auth e deve ser mantido na mensagem exibida ("Se este e-mail estiver cadastrado...").

2. **Validade do link:** O link de recuperação gerado pelo Supabase expira em 1 hora (configuração padrão do Supabase Auth). A tela de confirmação deve informar isso ao usuário.

3. **Sessão obrigatória em `/nova-senha`:** A rota `/nova-senha` não é protegida pelo middleware (está no grupo `(auth)`), mas a operação `supabase.auth.updateUser()` exige sessão ativa. Se não houver sessão ao montar, exibir estado `sessao-invalida` imediatamente sem tentar o submit.

4. **Senha mínima de 6 caracteres:** Consistente com o campo de senha já existente na tela de cadastro (`app/(auth)/cadastro/page.tsx`).

5. **Redirect seguro no callback:** O parâmetro `next` em `/auth/callback` deve ser validado para aceitar apenas caminhos internos (começando com `/`) — nunca redirecionar para domínios externos.

6. **Uma sessão por fluxo:** O `exchangeCodeForSession` no callback consome o código PKCE; ao recarregar `/auth/callback` com o mesmo código, o Supabase retornará erro. Redirecionar para `/login?error=link-invalido` nesses casos.

---

## Proteção de Rotas

- `/esqueci-senha` — rota **pública**, no grupo `(auth)`. Middleware não deve redirecionar usuários já autenticados para fora desta rota (diferente de `/login` e `/cadastro`, onde o middleware redireciona autenticados para `/jogos`). Se o middleware atual redireciona qualquer rota `(auth)` para `/jogos` quando autenticado, criar exceção para `/esqueci-senha` e `/nova-senha`.
- `/nova-senha` — rota **pública** no grupo `(auth)`, mas `updateUser` exige sessão. Proteção é client-side no mount, não via middleware.
- `/auth/callback` — rota pública (Route Handler), chamada pelo Supabase Auth após clicar no link de e-mail.

**Verificação necessária:** Inspecionar o middleware compilado (ou a lógica de redirecionamento no `app/(auth)/layout.tsx`) para confirmar se rotas `(auth)` redirecionam usuários autenticados. Caso o middleware redirecione `/esqueci-senha` e `/nova-senha`, adicionar exceções no matcher.

---

## Integração Supabase Realtime

Não utilizada nesta feature.

---

## Critérios de Aceite

- [ ] Existe link "Esqueceu a senha?" na tela de login (`/login`) apontando para `/esqueci-senha`
- [ ] Em `/esqueci-senha`, usuário preenche e-mail e clica em "ENVIAR LINK" — spinner durante loading, mensagem de confirmação ao sucesso
- [ ] A mensagem de confirmação usa linguagem que não revela se o e-mail existe ou não: "Se este e-mail estiver cadastrado, você receberá o link em instantes."
- [ ] O e-mail enviado pelo Supabase contém link que redireciona para `/auth/callback?code=<code>&next=/nova-senha`
- [ ] `app/auth/callback/route.ts` existe, troca o code por sessão e redireciona para `/nova-senha`
- [ ] Em `/nova-senha` com sessão ativa, usuário define nova senha (mínimo 6 caracteres) — validação de confirmação funciona
- [ ] Após sucesso, exibe confirmação `✓ SENHA ATUALIZADA` e redireciona para `/jogos` em 2 segundos
- [ ] Em `/nova-senha` sem sessão (link inválido/expirado), exibe estado de erro com link para `/esqueci-senha`
- [ ] Link de recovery expirado ou já usado redireciona para `/login?error=link-invalido`
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, cards com border 1px, sem sombra, sem border-radius excessivo, uppercase nos labels, `color-accent` no título
- [ ] Componentes reutilizáveis `<Button>` e `<Input>` de `components/ui/` são usados (sem duplicar estilos)
- [ ] Funciona em mobile (coluna única, card com `maxWidth: 400px` e `width: 100%`)
- [ ] `npm run lint` e `npm run build` passam sem erros novos
