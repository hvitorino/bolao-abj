# Spec: Alteração Direta de Senha

**Slug:** change-password
**Data:** 2026-06-23
**Status:** spec

---

## Objetivo

Substituir o fluxo de recuperação de senha por email (feature `password-recovery`) por um formulário simples de alteração direta de senha, acessível ao usuário autenticado via `/configuracoes`. O usuário informa nova senha e confirmação; a senha é atualizada via `supabase.auth.updateUser({ password })` sem nenhum envio de email ou fluxo PKCE. Os arquivos da feature `password-recovery` são removidos do repositório.

---

## Histórias de Usuário

- Como participante autenticado, quero alterar minha senha diretamente por um formulário dentro do dashboard para não precisar depender de emails de redefinição.
- Como participante, quero que o sistema valide que as duas senhas digitadas coincidem antes de submeter, para evitar erros de digitação.
- Como participante, quero ver feedback claro de sucesso ou erro após tentar alterar a senha.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma. A operação usa exclusivamente `auth.users` gerenciado pelo Supabase Auth via `supabase.auth.updateUser({ password })`.

### Migrations necessárias

Nenhuma migration SQL necessária.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. A alteração de senha é 100% client-side via Supabase Auth SDK:

```typescript
const { error } = await supabase.auth.updateUser({ password: novaSenha })
```

Esta chamada requer que o usuário tenha uma sessão ativa. Sem sessão, o Supabase retorna `Auth session missing`.

---

## Frontend — Componentes React

### ChangePasswordForm

**Arquivo:** `components/bolao/ChangePasswordForm.tsx`
**Tipo:** Client Component (`'use client'`)

**Props:**

```typescript
interface ChangePasswordFormProps {
  // sem props externas — formulário auto-contido
}
```

**Estados internos:**

```typescript
type FormState = 'idle' | 'loading' | 'sucesso' | 'error'

novaSenha: string
confirmarSenha: string
estado: FormState
mensagemErro: string
erroConfirmar: boolean   // controla borda color-error no campo confirmar
```

**Validação client-side (antes do submit):**

1. `novaSenha.length < 6` → definir `mensagemErro = "A senha deve ter pelo menos 6 caracteres"` e `estado = 'error'`; não submeter.
2. `novaSenha !== confirmarSenha` → definir `erroConfirmar = true`, `mensagemErro = "As senhas não coincidem"`, `estado = 'error'`; não submeter.

**Lógica de submit:**

```typescript
const supabase = createClient() // lib/supabase/client.ts
const { error } = await supabase.auth.updateUser({ password: novaSenha })
```

**Mapeamento de erros para português:**

- `"New password should be different from the old password"` → `"A nova senha deve ser diferente da senha atual"`
- `"Auth session missing"` → `"Sessão expirada. Faça login novamente."`
- Qualquer outro erro → `"Ocorreu um erro ao atualizar a senha. Tente novamente."`

**Estado `sucesso`:**
- Ocultar o formulário.
- Exibir:
  ```
  ✓ SENHA ATUALIZADA
  Sua senha foi alterada com sucesso.
  ```
  em `color-win`.
- Limpar os campos `novaSenha` e `confirmarSenha`.
- Não redirecionar — o usuário permanece em `/configuracoes`.

**Estado `error`:**
- Exibir `mensagemErro` em bloco com borda `color-error`.
- Se `erroConfirmar = true`, o campo "Confirmar senha" recebe `hasError={true}` via prop do `<Input>`.

**Layout visual (seguir DESIGN.md rigorosamente):**

```
┌──────────────────────────────────────────────────────┐
│  ALTERAR SENHA                                       │
│  ────────────────────────────────────────────────── │
│  NOVA SENHA                                          │
│  [ ••••••                                          ] │
│                                                      │
│  CONFIRMAR NOVA SENHA                                │
│  [ ••••••                                          ] │
│                                                      │
│  [ SALVAR NOVA SENHA ]                               │
└──────────────────────────────────────────────────────┘
```

- Seção delimitada por `border-top: 1px solid var(--color-border)` e padding consistent com o restante da página de configurações.
- Título da seção: `color-muted`, bold, uppercase, `font-size: 13px`, `letter-spacing: 0.08em` — mesmo padrão da seção INTEGRAÇÕES em `configuracoes/page.tsx`.
- `<Input type="password">` com `autoComplete="new-password"` em ambos os campos.
- `<Button type="submit">` com texto "SALVAR NOVA SENHA"; durante loading exibe "SALVANDO..."; desabilitado no estado `loading`.
- Reutilizar `<Button>` de `components/ui/Button.tsx` e `<Input>` de `components/ui/Input.tsx`.
- Sem sombras, sem `border-radius` adicional além do que os primitivos já têm.

---

### Modificação em `app/(dashboard)/configuracoes/page.tsx`

Adicionar a seção de alteração de senha **abaixo** da seção INTEGRAÇÕES existente, separada por `<div style={{ borderTop: '1px solid var(--color-border)' }} />`.

Estrutura resultante da página:

```
CONFIGURAÇÕES
─────────────────────────────

INTEGRAÇÕES
  <McpOnboarding />

─────────────────────────────

ALTERAR SENHA
  <ChangePasswordForm />
```

O componente `<ChangePasswordForm>` é um Client Component importado diretamente. A página `configuracoes/page.tsx` permanece Server Component (sem `'use client'`), pois o formulário encapsula todo o estado.

---

### Remoção de arquivos da feature `password-recovery`

Os seguintes arquivos devem ser **deletados** do repositório:

| Arquivo | Motivo |
|---------|--------|
| `app/(auth)/esqueci-senha/page.tsx` | Removido junto com o fluxo de email |
| `app/(auth)/esqueci-senha/client.tsx` | Removido junto com o fluxo de email |
| `app/(auth)/nova-senha/page.tsx` | Substituído pelo formulário em `/configuracoes` |
| `app/(auth)/nova-senha/client.tsx` | Substituído pelo formulário em `/configuracoes` |
| `app/auth/callback/route.ts` | Sem uso após remoção do fluxo PKCE |

**Atenção:** Verificar se `app/auth/callback/route.ts` é referenciado em outros contextos antes de deletar (ex: OAuth MCP em `/api/mcp/oauth/callback/route.ts` é distinto e **não** deve ser afetado). A inspeção do arquivo confirma que é exclusivo do fluxo de reset por email.

---

### Modificação em `app/(auth)/login/client.tsx`

Remover o link "Esqueceu a senha?" que aponta para `/esqueci-senha`:

**Trecho a remover** (linhas 155–177 do arquivo atual):

```tsx
{/* Link para recuperar senha */}
<p
  style={{
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '12px',
    textAlign: 'center',
    color: 'var(--color-muted)',
    margin: '1rem 0 0',
  }}
>
  Esqueceu a senha?{' '}
  <Link
    href="/esqueci-senha"
    style={{
      color: 'var(--color-primary)',
      textDecoration: 'none',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }}
  >
    RECUPERAR ACESSO
  </Link>
</p>
```

Este bloco é removido inteiramente. O link de cadastro (`/cadastro`) é preservado sem alteração.

---

## Regras de Negócio

1. **Sessão ativa obrigatória:** `supabase.auth.updateUser({ password })` exige sessão ativa. A rota `/configuracoes` já está no grupo `(dashboard)`, protegida pelo mecanismo de autenticação existente — não há risco de usuário não autenticado acessar o formulário.

2. **Senha mínima de 6 caracteres:** Consistente com o campo de senha do cadastro (`app/(auth)/cadastro/`) e com a validação já implementada em `app/(auth)/nova-senha/`.

3. **Confirmação antes de submeter:** A validação de coincidência das senhas é client-side, no handler `handleSubmit`, antes de chamar o Supabase. O erro `erroConfirmar` é visual e afeta apenas a borda do campo de confirmação via `hasError`.

4. **Sem fluxo de email:** Não há chamada a `supabase.auth.resetPasswordForEmail` nesta feature. O fluxo de email da feature `password-recovery` é inteiramente desativado pela remoção dos arquivos listados acima.

5. **Nova senha igual à atual:** O Supabase retorna erro `"New password should be different from the old password"` nesse caso. Esse erro deve ser traduzido conforme mapeamento acima e exibido no bloco de erro do formulário.

---

## Proteção de Rotas

- `/configuracoes` — rota **protegida**, no grupo `(dashboard)`. O mecanismo de autenticação existente (cookie de sessão Supabase verificado pelo layout/middleware do dashboard) garante que apenas usuários autenticados acessam a página. Nenhum ajuste de middleware necessário.
- As rotas `/esqueci-senha`, `/nova-senha` e `/auth/callback` são removidas. Não há necessidade de criar redirects para elas, pois o fluxo de email não será mais anunciado em nenhuma superfície do produto após a remoção do link na tela de login.

---

## Integração Supabase Realtime

Não utilizada nesta feature.

---

## Critérios de Aceite

- [ ] Existe seção "ALTERAR SENHA" na página `/configuracoes`, visível apenas para usuário autenticado
- [ ] O formulário contém dois campos: "Nova senha" e "Confirmar nova senha", ambos do tipo `password`
- [ ] Submeter com senhas diferentes exibe erro `"As senhas não coincidem"` e campo de confirmação com borda `color-error`
- [ ] Submeter com senha menor que 6 caracteres exibe erro `"A senha deve ter pelo menos 6 caracteres"`
- [ ] Submeter com senhas válidas e idênticas chama `supabase.auth.updateUser({ password })` e exibe `✓ SENHA ATUALIZADA` em `color-win` ao sucesso
- [ ] Erro do Supabase é traduzido e exibido em português com borda `color-error`
- [ ] O link "Esqueceu a senha? RECUPERAR ACESSO" foi removido da tela de login
- [ ] Os arquivos `app/(auth)/esqueci-senha/page.tsx`, `app/(auth)/esqueci-senha/client.tsx`, `app/(auth)/nova-senha/page.tsx`, `app/(auth)/nova-senha/client.tsx` e `app/auth/callback/route.ts` não existem mais no repositório
- [ ] O arquivo `app/api/mcp/oauth/callback/route.ts` permanece intocado (é distinto do callback de reset de senha)
- [ ] `<Button>` e `<Input>` de `components/ui/` são reutilizados (sem duplicar estilos)
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta verde/amarelo/azul, dense, dark only, `border: 1px solid var(--color-border)` nas seções, sem sombras
- [ ] Funciona em mobile (coluna única)
- [ ] `npm run lint` e `npm run build` passam sem erros novos
