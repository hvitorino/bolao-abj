# Changelog: Alteração Direta de Senha

**Slug:** change-password
**Branch:** feature/change-password
**Data:** 2026-06-23
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/ChangePasswordForm.tsx` — Client Component com formulário de alteração direta de senha. Gerencia estados `idle | loading | sucesso | error`, validação client-side (comprimento mínimo 6 e coincidência de senhas), chamada a `supabase.auth.updateUser({ password })`, mapeamento de erros do Supabase para português e exibição de feedback visual de sucesso (`✓ SENHA ATUALIZADA` em `color-win`) ou erro (bloco com borda `color-error`). Reutiliza `<Button>` e `<Input>` de `components/ui/`.

- `app/(dashboard)/configuracoes/page.tsx` — Adicionada seção "ALTERAR SENHA" abaixo da seção INTEGRAÇÕES, separada por `borderTop: '1px solid var(--color-border)'`. Importa e renderiza `<ChangePasswordForm />`. A página permanece Server Component.

- `app/(auth)/login/client.tsx` — Removido o bloco completo do link "Esqueceu a senha? RECUPERAR ACESSO" que apontava para `/esqueci-senha`. O link de cadastro (`/cadastro`) foi preservado.

### Arquivos removidos (feature `password-recovery`)

| Arquivo | Motivo |
|---------|--------|
| `app/(auth)/esqueci-senha/page.tsx` | Fluxo de email desativado |
| `app/(auth)/esqueci-senha/client.tsx` | Fluxo de email desativado |
| `app/(auth)/nova-senha/page.tsx` | Substituído por formulário em `/configuracoes` |
| `app/(auth)/nova-senha/client.tsx` | Substituído por formulário em `/configuracoes` |
| `app/auth/callback/route.ts` | Exclusivo do fluxo PKCE de reset por email; removido junto com o fluxo |

O arquivo `app/api/mcp/oauth/callback/route.ts` foi **preservado** — é o callback OAuth do MCP, sem relação com reset de senha.

### Banco de Dados

Nenhuma migration SQL necessária. A operação usa exclusivamente `auth.users` via Supabase Auth SDK.

---

## Decisões técnicas

- **Estado `sucesso` oculta o formulário:** A spec define que ao sucesso o formulário é ocultado e exibe a mensagem de confirmação. Isso evita dupla submissão acidental e dá feedback claro sem necessidade de redirect.

- **`erroConfirmar` separado do `estado`:** O estado `erroConfirmar: boolean` é independente do `estado: FormState` para permitir reset granular — ao novo submit, `setErroConfirmar(false)` é chamado antes da revalidação, evitando que bordas de erro persistam entre tentativas.

- **`alignSelf: 'flex-start'` no botão:** O botão não usa `fullWidth` para manter o layout compacto e consistente com os demais formulários do dashboard. Em mobile a coluna única já ocupa a largura total disponível.

- **Input com `hasError` em vez de `error`:** O prop `hasError` aplica apenas a borda vermelha no campo de confirmação sem exibir um texto de erro duplicado abaixo do input (a mensagem de erro já está no bloco dedicado do formulário).

---

## Pontos de atenção para o Revisor

1. **Verificar que `app/auth/callback/route.ts` foi removido** e que `app/api/mcp/oauth/callback/route.ts` permanece intocado — ambos existiam, eram caminhos diferentes.
2. **Verificar que o link "Esqueceu a senha?"** foi removido completamente de `login/client.tsx` sem afetar o link de cadastro.
3. **Verificar que o build passa** — confirmado localmente: `npm run build` concluiu sem erros, todas as 51 rotas geraram corretamente, sem rotas `/esqueci-senha` ou `/nova-senha` no output.
4. **Lint:** Os 5 erros de lint pré-existentes (em `group-switcher.tsx`, `ChatPanelContent.tsx`, `GroupChatWidget.tsx`, `SidePanelContainer.tsx`, `HistoryPanel.tsx`) não foram introduzidos por esta feature. Os arquivos novos/modificados (`ChangePasswordForm.tsx`, `configuracoes/page.tsx`, `login/client.tsx`) passam lint sem erros.
5. **Critério de aceite mobile:** O formulário usa `flexDirection: 'column'` e inputs com `width: '100%'` (via `<Input>`), funcionando em coluna única em mobile sem media queries adicionais.

---

## Commits realizados

```
e984bb4 feat(change-password): adiciona seção ALTERAR SENHA em /configuracoes
dd6acab feat(change-password): cria componente ChangePasswordForm
ad33308 feat(change-password): remove link 'Esqueceu a senha?' da tela de login
d9bb267 feat(change-password): remove arquivos da feature password-recovery
c86b3f3 chore(change-password): adiciona plano de implementação
```
