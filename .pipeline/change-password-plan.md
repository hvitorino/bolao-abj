# Plano de Implementação: Alteração Direta de Senha

**Slug:** change-password
**Branch:** feature/change-password
**Data:** 2026-06-23
**Spec:** .pipeline/change-password-spec.md

## Tarefas

- [ ] 1. Remover arquivos da feature `password-recovery` (`app/(auth)/esqueci-senha/page.tsx`, `app/(auth)/esqueci-senha/client.tsx`, `app/(auth)/nova-senha/page.tsx`, `app/(auth)/nova-senha/client.tsx`, `app/auth/callback/route.ts`)
- [ ] 2. Remover o link "Esqueceu a senha? RECUPERAR ACESSO" de `app/(auth)/login/client.tsx`
- [ ] 3. Criar componente `components/bolao/ChangePasswordForm.tsx` com validação, estados e chamada ao Supabase Auth
- [ ] 4. Adicionar seção "ALTERAR SENHA" em `app/(dashboard)/configuracoes/page.tsx` com `<ChangePasswordForm />`
- [ ] 5. Verificar que `npm run lint` e `npm run build` passam sem erros
