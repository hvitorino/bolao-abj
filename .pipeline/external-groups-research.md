# Research: Integração Externa de Grupos

**Data:** 2026-07-01
**Status:** Exploração inicial — não priorizado

## Ideia

Permitir que apps externos criem grupos no bolão via API, com suporte a `redirectUrl` para devolver o usuário ao app de origem após entrar no grupo.

## Fluxo Proposto

1. App externo faz `POST /api/external/groups` com `{ name, redirectUrl }` + API key no header
2. Backend cria o grupo via `service_role` e retorna `{ inviteUrl: "/convite/[invite_token]?redirect=[redirectUrl]" }`
3. App externo redireciona o usuário para a `inviteUrl`
4. Usuário faz login/cadastro no bolão e aceita o convite normalmente
5. Após entrar no grupo, `/convite/[token]` redireciona para o `redirectUrl` original

## O que Precisaria Mudar

- **Endpoint novo** — `POST /api/external/groups` com autenticação por API key; o mecanismo `mcp_access_tokens` existente pode ser reutilizado ou um similar criado
- **Página `/convite/[token]`** — passar o `redirect` como query param e redirecionar após o join bem-sucedido
- **`created_by`** — `groups.created_by` é FK obrigatória para `profiles`; criação sem usuário autenticado exige ou um perfil de serviço dedicado, ou tornar a coluna nullable

## Principal Decisão em Aberto

Como lidar com `groups.created_by` em criações externas:

| Opção | Prós | Contras |
|-------|------|---------|
| Perfil de serviço dedicado no banco | Sem mudança de schema | Perfil "fantasma" misturado com usuários reais |
| Tornar `created_by` nullable | Limpo semanticamente | Migration + ajuste de RLS e queries que assumem NOT NULL |

## Schema Relevante (já existe)

```sql
groups (id, name, invite_token, created_by FK profiles, created_at)
group_members (group_id, user_id, role, joined_at)
group_invites (group_id, invited_user_id, invited_by, status, ...)
mcp_access_tokens -- mecanismo de API key existente, potencialmente reutilizável
```
