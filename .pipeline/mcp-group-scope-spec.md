# Spec: Suporte a Múltiplos Grupos no Servidor MCP

**Slug:** mcp-group-scope
**Data:** 2026-06-18
**Status:** spec

---

## Objetivo

Corrigir o servidor MCP para suportar múltiplos grupos de forma explícita: adicionar a tool `listar_grupos` (que lista os grupos do usuário autenticado) e adicionar o parâmetro `group_id` opcional nas tools `fazer_palpite`, `meus_palpites` e `ver_ranking`. Quando `group_id` não é informado, o comportamento atual é mantido como fallback (primeiro grupo por `joined_at ASC`). Quando informado, o grupo é validado antes de executar a operação.

---

## Histórias de Usuário

- Como participante do bolão com acesso via MCP, quero ver quais grupos faço parte para poder informar o `group_id` correto nas outras tools.
- Como participante de múltiplos bolões, quero ver meus palpites de um grupo específico sem que o MCP escolha o grupo por mim.
- Como participante de múltiplos bolões, quero registrar um palpite em um grupo específico passando o `group_id` diretamente.
- Como participante de múltiplos bolões, quero ver o ranking de um grupo específico sem precisar ser o grupo mais antigo.

---

## Modelo de Dados

Nenhuma tabela nova ou migration necessária. As tabelas já existentes suportam tudo que esta feature precisa:

```sql
-- Já existe
group_members (group_id uuid, user_id uuid, role text, joined_at timestamptz)
groups (id uuid, name text, invite_token text, created_at timestamptz)

-- Já existe com group_id
predictions (user_id uuid, game_id uuid, group_id uuid, ...)
scores (user_id uuid, game_id uuid, group_id uuid, ...)
```

---

## Backend — Arquivos MCP a modificar

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `lib/mcp/auth.ts` | Adicionar `validateGroupMembership` |
| `lib/mcp/tools/palpites.ts` | Adicionar `group_id` em `meus_palpites` e `fazer_palpite` |
| `lib/mcp/tools/ranking.ts` | Adicionar `group_id` em `ver_ranking` |
| `lib/mcp/tools/grupos.ts` | Arquivo novo — registra `listar_grupos` |
| `lib/mcp/server.ts` | Registrar `registerGruposTools` |

---

## Detalhamento por arquivo

### `lib/mcp/auth.ts` — nova função `validateGroupMembership`

Adicionar a função exportada abaixo ao arquivo existente:

```typescript
export async function validateGroupMembership(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  groupId: string
): Promise<{ valid: boolean; errorMessage?: string }> {
  const { data } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      valid: false,
      errorMessage: 'Você não é membro deste grupo ou o grupo não existe.',
    }
  }

  return { valid: true }
}
```

**Regra:** esta função nunca lança exceção — retorna sempre `{ valid, errorMessage }`. A tool que a chama é responsável por retornar a mensagem de erro ao MCP client.

---

### `lib/mcp/tools/grupos.ts` — arquivo novo

Criar o arquivo com a função `registerGruposTools` que registra a tool `listar_grupos`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createServiceClient } from '@/lib/mcp/auth'

export function registerGruposTools(server: McpServer, userId: string) {
  server.tool(
    'listar_grupos',
    'Lista os grupos (bolões) dos quais o participante autenticado faz parte, com id, nome e papel (admin/membro).',
    {},
    async () => { ... }
  )
}
```

**Comportamento da tool `listar_grupos`:**

1. Criar `db = createServiceClient()`.
2. Query:
   ```sql
   SELECT gm.group_id, g.name, gm.role, gm.joined_at
   FROM group_members gm
   JOIN groups g ON g.id = gm.group_id
   WHERE gm.user_id = $userId
   ORDER BY gm.joined_at ASC
   ```
   Em Supabase JS:
   ```typescript
   db.from('group_members')
     .select('group_id, role, joined_at, groups!inner(name)')
     .eq('user_id', userId)
     .order('joined_at', { ascending: true })
   ```
3. Se erro ou array vazio, retornar:
   - Erro de DB: `'Erro ao buscar grupos. Tente novamente.'`
   - Array vazio: `'Você não pertence a nenhum grupo no bolão.'`
4. Formatar saída como texto:

```
Seus grupos (N):

1. BOLÃO DA INGRISIA ABJ
   ID: <uuid>
   Papel: ADMIN
   Desde: DD/MM/AAAA

2. OUTRO BOLÃO
   ID: <uuid>
   Papel: MEMBRO
   Desde: DD/MM/AAAA
```

- `role === 'admin'` → `ADMIN`; `role === 'member'` → `MEMBRO`
- Data formatada com `joined_at.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })`
- O primeiro grupo da lista é o grupo padrão usado pelas outras tools quando `group_id` não é informado — incluir essa nota no texto de saída: `(* o primeiro grupo é usado como padrão quando group_id não é informado)`

**Tipo auxiliar necessário:**
```typescript
type GroupRow = {
  group_id: string
  role: string
  joined_at: string
  groups: { name: string } | { name: string }[]
}
```
O join retorna `groups` como objeto ou array dependendo da versão do PostgREST — usar o mesmo padrão de cast `as unknown as GroupRow[]` já adotado em `palpites.ts`, e normalizar com `Array.isArray(row.groups) ? row.groups[0] : row.groups`.

---

### `lib/mcp/tools/palpites.ts` — modificar `meus_palpites` e `fazer_palpite`

#### Tool `meus_palpites`

**Schema atual:**
```typescript
{ status: z.enum(['pending', 'live', 'finished']).optional() }
```

**Schema novo:**
```typescript
{
  status: z.enum(['pending', 'live', 'finished']).optional().describe('Filtrar por status do jogo (opcional)'),
  group_id: z.string().uuid().optional().describe('ID do grupo (UUID). Se omitido, usa o primeiro grupo por data de entrada.')
}
```

**Lógica de resolução do grupo** — substituir o bloco `resolveGroupForMcp` atual:

```typescript
async ({ status, group_id }) => {
  const db = createServiceClient()

  let groupId: string | null

  if (group_id) {
    const { valid, errorMessage } = await validateGroupMembership(db, userId, group_id)
    if (!valid) {
      return { content: [{ type: 'text', text: errorMessage! }] }
    }
    groupId = group_id
  } else {
    groupId = await resolveGroupForMcp(db, userId)
    if (!groupId) {
      return { content: [{ type: 'text', text: 'Você não pertence a nenhum grupo ativo no bolão.' }] }
    }
  }
  // ... resto da lógica permanece igual
}
```

#### Tool `fazer_palpite`

**Schema atual:**
```typescript
{
  game_id: z.string().uuid(),
  home_score: z.number().int().min(0),
  away_score: z.number().int().min(0),
}
```

**Schema novo:**
```typescript
{
  game_id: z.string().uuid().describe('ID do jogo (UUID)'),
  home_score: z.number().int().min(0).describe('Placar do time da casa (>= 0)'),
  away_score: z.number().int().min(0).describe('Placar do time visitante (>= 0)'),
  group_id: z.string().uuid().optional().describe('ID do grupo (UUID). Se omitido, usa o primeiro grupo por data de entrada.')
}
```

**Lógica de resolução do grupo** — substituir o bloco `resolveGroupForMcp` atual pelo mesmo padrão acima (com `validateGroupMembership` quando informado, ou `resolveGroupForMcp` como fallback).

**Atenção:** após resolver o grupo, a verificação de membership existente (`group_members`) pode ser removida — ela se torna redundante quando `group_id` é explícito (pois `validateGroupMembership` já verifica) e desnecessária no fallback (pois `resolveGroupForMcp` só retorna grupos dos quais o usuário é membro). Remover o bloco:
```typescript
// Verificar membership
const { data: membership } = await db
  .from('group_members')
  .select('id')
  .eq('group_id', groupId)
  .eq('user_id', userId)
  .maybeSingle()

if (!membership) { ... }
```

---

### `lib/mcp/tools/ranking.ts` — modificar `ver_ranking`

**Schema atual:**
```typescript
{}
```

**Schema novo:**
```typescript
{
  group_id: z.string().uuid().optional().describe('ID do grupo (UUID). Se omitido, usa o primeiro grupo por data de entrada.')
}
```

**Assinatura da tool** — substituir `async () =>` por `async ({ group_id }) =>`.

**Lógica de resolução do grupo** — substituir o bloco `resolveGroupForMcp` atual pelo mesmo padrão:

```typescript
async ({ group_id }) => {
  const db = createServiceClient()

  let groupId: string | null

  if (group_id) {
    const { valid, errorMessage } = await validateGroupMembership(db, userId, group_id)
    if (!valid) {
      return { content: [{ type: 'text', text: errorMessage! }] }
    }
    groupId = group_id
  } else {
    groupId = await resolveGroupForMcp(db, userId)
    if (!groupId) {
      return { content: [{ type: 'text', text: 'Você não pertence a nenhum grupo ativo no bolão.' }] }
    }
  }
  // ... resto da lógica permanece igual
}
```

O import de `z` precisa ser adicionado em `ranking.ts` (atualmente não está importado pois o schema era vazio `{}`).

---

### `lib/mcp/server.ts` — registrar `registerGruposTools`

Adicionar import e chamada de registro:

```typescript
import { registerGruposTools } from '@/lib/mcp/tools/grupos'

function createMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: 'bolao-abj', version: '1.0.0' })

  registerJogosTools(server)
  registerGruposTools(server, userId)   // linha nova
  registerRankingTools(server, userId)
  registerPalpitesTools(server, userId)

  return server
}
```

---

## Regras de Negócio

### Fallback de grupo

Quando `group_id` não é fornecido em qualquer tool que aceite o parâmetro:

```
groupId = primeiro registro em group_members WHERE user_id = $userId ORDER BY joined_at ASC LIMIT 1
```

Esta lógica já existe em `resolveGroupForMcp` em `lib/mcp/auth.ts` — reutilizar sem modificar.

### Validação de membership explícita

Quando `group_id` é fornecido pelo usuário:

```
SELECT 1 FROM group_members WHERE group_id = $group_id AND user_id = $userId
```

- Se encontrar registro: prosseguir com `groupId = group_id`
- Se não encontrar: retornar mensagem `'Você não é membro deste grupo ou o grupo não existe.'`

**Não distinguir** entre "grupo não existe" e "usuário não é membro" na mensagem de erro — retornar a mesma mensagem para ambos os casos (evita enumeração de grupos).

### Ausência de grupos

Se o fallback não encontrar nenhum grupo (usuário sem memberships), retornar:
`'Você não pertence a nenhum grupo ativo no bolão.'`

Este caso já existe no código atual e não deve mudar de comportamento.

---

## Imports a adicionar

### `lib/mcp/tools/palpites.ts`

```typescript
import { createServiceClient, resolveGroupForMcp, validateGroupMembership } from '@/lib/mcp/auth'
```

### `lib/mcp/tools/ranking.ts`

```typescript
import { z } from 'zod'
import { createServiceClient, resolveGroupForMcp, validateGroupMembership } from '@/lib/mcp/auth'
```

### `lib/mcp/tools/grupos.ts` (novo)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createServiceClient } from '@/lib/mcp/auth'
```

---

## Critérios de Aceite

- [ ] `listar_grupos` retorna lista com id, nome e role de cada grupo do usuário autenticado, ordenada por `joined_at ASC`
- [ ] `listar_grupos` retorna mensagem descritiva quando o usuário não pertence a nenhum grupo
- [ ] `meus_palpites` aceita `group_id` UUID opcional — quando omitido, usa o primeiro grupo por `joined_at ASC` (comportamento anterior preservado)
- [ ] `meus_palpites` com `group_id` válido retorna palpites do grupo informado
- [ ] `meus_palpites` com `group_id` de grupo do qual o usuário não é membro retorna erro `'Você não é membro deste grupo ou o grupo não existe.'`
- [ ] `fazer_palpite` aceita `group_id` UUID opcional com o mesmo fallback e validação
- [ ] `fazer_palpite` com `group_id` explícito registra o palpite no grupo correto (coluna `group_id` da tabela `predictions`)
- [ ] `ver_ranking` aceita `group_id` UUID opcional com o mesmo fallback e validação
- [ ] `ver_ranking` com `group_id` explícito exibe o ranking do grupo informado
- [ ] Verificação de membership duplicada em `fazer_palpite` (bloco `group_members` após `resolveGroupForMcp`) é removida
- [ ] `registerGruposTools` é chamado em `createMcpServer` em `server.ts`
- [ ] TypeScript compila sem erros (`npm run build` ou `tsc --noEmit`)
- [ ] Nenhuma migration SQL necessária — nenhum arquivo em `supabase/migrations/` foi criado
