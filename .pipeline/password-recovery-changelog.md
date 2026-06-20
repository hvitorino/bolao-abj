# Changelog: Recuperação de Senha por Email

**Slug:** password-recovery
**Branch:** feature/password-recovery
**Data:** 2026-06-19
**Status:** aprovado

---

## O que foi implementado

### Backend (Ruby/Sinatra)
- Nenhum endpoint novo — fluxo inteiramente via Supabase Auth SDK client-side e Route Handler Next.js.

### Frontend (Next.js/React)

- `app/auth/callback/route.ts` — Route Handler GET público que recebe o `code` PKCE da query string, chama `supabase.auth.exchangeCodeForSession(code)` via cliente server-side, e redireciona para o `next` fornecido (padrão: `/jogos`). Valida que `next` começa com `/` para evitar open redirect. Em caso de erro (código inválido/expirado), redireciona para `/login?error=link-invalido`.
- `app/(auth)/esqueci-senha/page.tsx` — Client Component com estados `idle | loading | enviado | error`. Chama `supabase.auth.resetPasswordForEmail` com `redirectTo` apontando para `/auth/callback?next=/nova-senha`. Mensagem de confirmação usa linguagem que não revela se o e-mail existe. Borda do card muda para `color-error` no estado de erro.
- `app/(auth)/nova-senha/page.tsx` — Client Component com estados `idle | loading | sucesso | error | sessao-invalida`. Verifica sessão no `useEffect` do mount; exibe estado `sessao-invalida` com link para `/esqueci-senha` se não houver sessão. Validações client-side: mínimo 6 caracteres, senhas coincidem. Após sucesso, exibe confirmação `✓ SENHA ATUALIZADA` e redireciona para `/jogos` em 2 segundos via `router.push`.
- `app/(auth)/login/page.tsx` (modificado) — Adicionado link "Esqueceu a senha? RECUPERAR ACESSO" entre o botão de submit e o separador de cadastro, apontando para `/esqueci-senha`. Estilo consistente com os demais links do formulário.

### Banco de Dados
- Nenhuma migration necessária. O fluxo usa exclusivamente `auth.users` gerenciado pelo Supabase Auth.

---

## Decisões técnicas

- **Sem middleware de proteção para `/esqueci-senha` e `/nova-senha`:** O projeto não tem `middleware.ts`, então não há risco de redirecionamento de usuários autenticados para fora dessas rotas. As rotas ficaram no grupo `(auth)` conforme spec, herdando o layout centralizado.
- **Sessão verificada client-side em `/nova-senha`:** `updateUser` exige sessão ativa; a verificação no `useEffect` do mount garante feedback imediato ao usuário se o link foi expirado ou já usado, sem depender de middleware.
- **`erroCampoConfirmar` separado de `estado`:** O erro de "senhas não coincidem" aplica borda `color-error` apenas no campo de confirmação (via `hasError`), enquanto o estado geral continua `error` — alinhado com o comportamento do componente `<Input>` existente.
- **Open redirect prevenido:** O parâmetro `next` no callback só é aceito se começar com `/`; qualquer valor externo é descartado e substituído por `/jogos`.
- **Erros pré-existentes de lint ignorados:** Os 2 erros de lint reportados (`group-switcher.tsx` e `GroupChatWidget.tsx`) existiam antes desta feature e não foram introduzidos pelos novos arquivos.

---

## Pontos de atenção para o Revisor

1. **Configuração obrigatória no painel Supabase** (fora do código): adicionar `<SITE_URL>/auth/callback` à lista de Redirect URLs em Authentication → URL Configuration. Sem isso, o Supabase recusará o redirect após o e-mail.
2. **Rotas `/esqueci-senha` e `/nova-senha` são estáticas no build** (`○ Static`) — verificar se isso é compatível com o comportamento esperado (sem SSR, sem cookies no mount). A verificação de sessão em `/nova-senha` é client-side, então é compatível.
3. **Mensagem de confirmação em `/esqueci-senha`:** Verificar se o texto "Se este e-mail estiver cadastrado, você receberá o link em instantes." está adequado conforme a regra de negócio #1 da spec.
4. **Fluxo de 2 segundos em `/nova-senha`:** Verificar se o `setTimeout` de 2 segundos para redirect é percebido como fluido ou lento na experiência real.

---

## Commits realizados

```
1d21c06 feat(password-recovery): adiciona link esqueci-senha na tela de login
ba8cc90 feat(password-recovery): cria página /nova-senha com validação e updateUser
656cd99 feat(password-recovery): cria página /esqueci-senha com solicitação de recuperação
fab18e6 feat(password-recovery): cria route handler PKCE em /auth/callback
abbedf4 chore(password-recovery): adiciona plano de implementação
```
