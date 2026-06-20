# Plano de Implementação: Recuperação de Senha por Email

**Slug:** password-recovery
**Branch:** feature/password-recovery
**Data:** 2026-06-19
**Spec:** .pipeline/password-recovery-spec.md

## Tarefas

- [ ] 1. Criar Route Handler PKCE em `app/auth/callback/route.ts` — troca `code` por sessão e redireciona para `next` ou `/login?error=link-invalido`
- [ ] 2. Criar página `app/(auth)/esqueci-senha/page.tsx` — formulário de solicitação de recuperação com estados idle/loading/enviado/error e chamada a `resetPasswordForEmail`
- [ ] 3. Criar página `app/(auth)/nova-senha/page.tsx` — formulário de nova senha com validação client-side, verificação de sessão no mount e chamada a `updateUser`
- [ ] 4. Modificar `app/(auth)/login/page.tsx` — adicionar link "Esqueceu a senha? RECUPERAR ACESSO" entre o botão de submit e o separador de cadastro
