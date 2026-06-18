# Spec: Servidor MCP Remoto do Bolão

**Slug:** mcp-bolao
**Data:** 2026-06-18
**Status:** spec

---

## Objetivo

Expor o Bolão ABJ como um servidor MCP remoto acessível em `/api/mcp`, permitindo que participantes autenticados consultem jogos, ranking e palpites — e façam/editem palpites — via qualquer cliente MCP compatível (Claude Desktop, Claude.ai, Cursor, etc.), sem configuração manual de tokens. A autenticação usa OAuth 2.0 Authorization Code flow com o Supabase como identity provider; o access token em circulação é o próprio JWT do Supabase.

---

## Histórias de Usuário

- Como participante, quero adicionar a URL `https://bolao-abj.vercel.app/api/mcp` no meu cliente MCP e fazer login pelo browser uma única vez, para usar o bolão via IA sem copiar tokens manualmente.
- Como participante autenticado via MCP, quero listar os jogos do dia (ou filtrados por data/status/rodada), para acompanhar a programação da Copa.
- Como participante autenticado via MCP, quero ver os detalhes completos de um jogo específico, para saber placar atual, horário, local e rodada.
- Como participante autenticado via MCP, quero consultar o ranking do meu grupo, para saber minha posição e a dos outros participantes.
- Como participante autenticado via MCP, quero ver meus palpites (com pontuação quando disponível), para acompanhar meu desempenho.
- Como participante autenticado via MCP, quero ver os palpites de todos os participantes em um jogo específico (após ele começar), para comparar com o meu.
- Como participante autenticado via MCP, quero fazer ou editar meu palpite em um jogo (antes do deadline), para participar do bolão sem abrir o site.
- Como participante, quero ver na tela de configurações a URL do servidor MCP com um botão de copiar, para configurar meu cliente MCP facilmente.

---

## Modelo de Dados

### Tabelas novas

#### `mcp_oauth_codes`

```sql
create table mcp_oauth_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  used        boolean not null default false
);

-- RLS: sem acesso direto de clientes; apenas service_role opera esta tabela
alter table mcp_oauth_codes enable row level security;
-- Nenhuma policy criada — acesso exclusivo via service_role
```

Campos:
- `code` (text, PK): token aleatório de 32 bytes (hex), gerado com `crypto.randomBytes(32).toString('hex')` no callback OAuth.
- `user_id` (uuid, NOT NULL, FK auth.users CASCADE): usuário que autorizou.
- `redirect_uri` (text, NOT NULL): URI de redirecionamento informada pelo cliente MCP, necessária para validação na troca do token.
- `expires_at` (timestamptz, default `now() + 5min`): expiração do código.
- `used` (boolean, default false): garantia de uso único (one-time use).

### Migrations necessárias

```
supabase/migrations/20260618100000_create_mcp_oauth_codes.sql
```

Conteúdo:
```sql
create table mcp_oauth_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  used        boolean not null default false
);

alter table mcp_oauth_codes enable row level security;
```

---

## Backend — Endpoints Next.js (App Router Route Handlers)

Todos os endpoints MCP ficam em `app/api/mcp/`. A autenticação usa `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` — as mesmas variáveis de ambiente já presentes no projeto.

### Padrão de autenticação reutilizado

O padrão já existente nos route handlers do projeto (ver `app/api/predictions/route.ts` e `app/api/ranking/route.ts`) deve ser replicado: validar o `Authorization: Bearer <jwt>` via `anonClient.auth.getUser(jwt)` e usar `serviceClient` para operações de escrita.

---

### GET /api/mcp/oauth/metadata

**Autenticação:** pública (sem autenticação)

**Descrição:** Discovery endpoint RFC 8414. Retorna o Authorization Server Metadata para que clientes MCP descubram os endpoints OAuth automaticamente.

**Resposta de sucesso (200):**
```json
{
  "issuer": "https://bolao-abj.vercel.app",
  "authorization_endpoint": "https://bolao-abj.vercel.app/api/mcp/oauth/authorize",
  "token_endpoint": "https://bolao-abj.vercel.app/api/mcp/oauth/token",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

**Observação:** O issuer deve ser construído dinamicamente a partir do header `host` da request para funcionar tanto em preview deployments quanto em produção:
```typescript
const host = request.headers.get('host') ?? 'bolao-abj.vercel.app'
const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
const base = `${protocol}://${host}`
```

---

### GET /api/mcp/oauth/authorize

**Autenticação:** pública (sem autenticação)

**Descrição:** Inicia o fluxo OAuth. Recebe os parâmetros do cliente MCP e redireciona para o Supabase Auth (login existente do site).

**Query params esperados:**
- `client_id` (string): qualquer valor aceito sem validação (open registration)
- `redirect_uri` (string, obrigatório): URI de callback do cliente MCP
- `state` (string, obrigatório): valor opaco para CSRF protection
- `code_challenge` (string, obrigatório): PKCE challenge em base64url
- `code_challenge_method` (string, obrigatório): deve ser `"S256"`
- `response_type` (string, obrigatório): deve ser `"code"`

**Validações:**
- Se `response_type !== "code"`: retornar 400 com mensagem
- Se `code_challenge_method !== "S256"`: retornar 400 com mensagem

**Comportamento:** Redirecionar para o Supabase Auth com o callback apontando para `/api/mcp/oauth/callback`. Os parâmetros `redirect_uri`, `state` e `code_challenge` devem ser repassados via `state` ao Supabase (serializado como JSON base64url) para recuperação no callback.

**Implementação:**
```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
const statePayload = Buffer.from(JSON.stringify({ redirect_uri, state, code_challenge })).toString('base64url')
const { data } = await supabase.auth.signInWithOAuth({
  provider: 'email', // não usado — usaremos signInWithOtp ou magic link
  options: { ... }
})
```

**Atenção:** O Supabase Auth não expõe um endpoint OAuth padrão para authorization code flow com password. A abordagem correta é redirecionar o usuário para a página de login do próprio site (`/login`) com um parâmetro especial que indica que o callback deve emitir o código MCP. Implementação alternativa: usar o `signInWithOAuth` do Supabase se o projeto tiver providers sociais configurados, ou usar o PKCE flow nativo do Supabase.

**Implementação correta para este projeto (login com email/senha):**

1. Redirecionar o usuário para `/mcp/login?mcp_state=<base64url(redirect_uri+state+code_challenge)>`
2. A página `/mcp/login` exibe o formulário de login (email/senha), com estado visual diferenciado ("Faça login para conectar seu cliente MCP")
3. Após login bem-sucedido, a página redireciona para `/api/mcp/oauth/callback` com o código do Supabase e o `mcp_state`

**Alternativa mais simples (recomendada):** Usar `supabase.auth.exchangeCodeForSession` com o fluxo PKCE nativo do Supabase via `signInWithOAuth`. Como o projeto usa email/senha, a implementação deve:

1. `GET /api/mcp/oauth/authorize` redireciona para `/mcp/autorizar?redirect_uri=...&state=...&code_challenge=...` (página Next.js)
2. A página `app/mcp/autorizar/page.tsx` renderiza formulário de login email/senha
3. Submit chama `supabase.auth.signInWithPassword()`; em caso de sucesso, chama `/api/mcp/oauth/callback` via redirect

**Erros possíveis:**
- 400: `response_type` ou `code_challenge_method` inválidos

---

### GET /api/mcp/oauth/callback

**Autenticação:** pública (chamado pelo redirect do Supabase após login)

**Descrição:** Recebe o resultado do login do usuário. Troca o código Supabase por uma sessão, gera um código temporário MCP, salva em `mcp_oauth_codes` e redireciona para o `redirect_uri` do cliente com o código temporário.

**Query params esperados:**
- `access_token` (string): JWT Supabase do usuário logado
- `redirect_uri` (string): URI de callback do cliente MCP
- `state` (string): valor opaco original do cliente MCP

**Alternativa (se o access_token vier no hash fragment):** A página `app/mcp/autorizar/page.tsx` lê o token do hash do browser e faz POST para o callback. Ver implementação abaixo.

**Implementação simplificada — callback como Server Action ou API Route:**

O fluxo recomendado para este projeto é:

1. Página `app/mcp/autorizar/page.tsx` (Client Component) lida com o login
2. Após `supabase.auth.signInWithPassword()` bem-sucedido, obtém o `access_token` da sessão
3. Faz `POST /api/mcp/oauth/callback` com `{ access_token, refresh_token, redirect_uri, state }`
4. O route handler verifica o token, gera `code = crypto.randomBytes(32).toString('hex')`, salva em `mcp_oauth_codes` via service_role, e retorna `{ redirect_url: "<redirect_uri>?code=<code>&state=<state>" }`
5. A página redireciona o browser para esse URL

**Body (POST JSON):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "redirect_uri": "string",
  "state": "string"
}
```

**Resposta de sucesso (200):**
```json
{ "redirect_url": "http://localhost:3000/callback?code=abc123&state=xyz" }
```

**Erros possíveis:**
- 401: token inválido
- 422: parâmetros ausentes

---

### POST /api/mcp/oauth/token

**Autenticação:** pública (chamado pelo cliente MCP)

**Descrição:** Troca o código temporário MCP pelo access_token (JWT Supabase) e refresh_token. Implementa o endpoint de token do OAuth 2.0 Authorization Code flow.

**Body (application/x-www-form-urlencoded ou JSON):**
```
grant_type=authorization_code
&code=<código temporário>
&redirect_uri=<mesma redirect_uri usada no authorize>
&client_id=<qualquer valor>
&code_verifier=<PKCE verifier>
```

**Validações:**
1. `grant_type` deve ser `"authorization_code"`
2. Buscar `code` em `mcp_oauth_codes` via service_role
3. Verificar `used === false`
4. Verificar `expires_at > now()`
5. Verificar `redirect_uri` confere com o salvo
6. Verificar PKCE: `SHA256(code_verifier)` em base64url deve igualar o `code_challenge` guardado no `mcp_oauth_codes` — **ATENÇÃO:** o `code_challenge` deve ser salvo junto com o código no callback. Adicionar coluna `code_challenge text` na migration.
7. Marcar `used = true` atomicamente
8. Buscar o `access_token` e `refresh_token` do usuário via `supabase.auth.admin.getUserById(user_id)` ou recuperando da sessão salva

**Observação sobre tokens:** Como o `access_token` não é armazenado no banco (apenas o `user_id`), o servidor não pode reemitir o token original. A solução é salvar também o `access_token` e `refresh_token` na linha de `mcp_oauth_codes` no momento do callback, e retorná-los aqui.

**Revisão da tabela `mcp_oauth_codes` (schema atualizado):**
```sql
create table mcp_oauth_codes (
  code           text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null default (now() + interval '5 minutes'),
  used           boolean not null default false
);
```

**Resposta de sucesso (200):**
```json
{
  "access_token": "<jwt-supabase>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<supabase-refresh-token>"
}
```

**Erros possíveis:**
- 400: `grant_type` inválido, código não encontrado, código expirado, código já usado, `redirect_uri` não confere, PKCE inválido

---

### POST /api/mcp

**Autenticação:** requerida — `Authorization: Bearer <supabase_access_token>`

**Descrição:** Endpoint principal do servidor MCP. Usa o Streamable HTTP transport do MCP SDK 2025-03-26. Recebe requisições JSON-RPC do cliente MCP, roteias para as tools registradas e retorna as respostas.

**Headers obrigatórios:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Implementação:**

```typescript
// app/api/mcp/route.ts
import { NextRequest } from 'next/server'
import { createMcpHandler } from '@/lib/mcp/server'

export async function POST(request: NextRequest) {
  return createMcpHandler(request)
}
```

**Autenticação:** extrair Bearer token, validar via `anonClient.auth.getUser(token)`, extrair `user_id` e passar como contexto para todas as tools.

**Erros possíveis:**
- 401: token ausente ou inválido
- 405: método não POST

---

## Frontend — Componentes React

### Página de Login MCP

**Arquivo:** `app/mcp/autorizar/page.tsx`

**Tipo:** Client Component (`"use client"`)

**Props:** nenhuma (lê query params via `useSearchParams`)

**Query params lidos:**
- `redirect_uri` (string): URI de callback do cliente MCP
- `state` (string): estado opaco do cliente MCP
- `code_challenge` (string): PKCE challenge
- `code_challenge_method` (string): deve ser `"S256"`

**Estados:** `idle` | `loading` | `error` | `success`

**Comportamento:**
1. Exibir formulário com campos email e senha, estilo idêntico ao `app/(auth)/login/` existente
2. Texto explicativo: "Faça login para conectar seu cliente MCP ao Bolão ABJ"
3. Submit: chamar `supabase.auth.signInWithPassword({ email, password })`
4. Em sucesso: fazer `POST /api/mcp/oauth/callback` com `{ access_token, refresh_token, redirect_uri, state, code_challenge }`
5. Receber `{ redirect_url }` e redirecionar com `window.location.href = redirect_url`
6. Em erro: exibir mensagem em `color-error`

**Design:** seguir DESIGN.md — fonte JetBrains Mono, fundo `color-bg`, borda `color-border`, botão CTA com fundo `color-primary`. Adicionar um cabeçalho:
```
BOLAO ABJ — CONEXAO MCP
━━━━━━━━━━━━━━━━━━━━━━━
Faça login para autorizar o acesso do cliente MCP.
```

---

### Seção de Onboarding MCP na Tela de Configurações

**Arquivo:** `app/(dashboard)/configuracoes/page.tsx` (nova rota)

**Tipo:** Server Component (busca dados do usuário autenticado via Supabase server client)

**Conteúdo:** Renderiza `<McpOnboarding />` com a URL do servidor.

---

### McpOnboarding

**Arquivo:** `components/bolao/McpOnboarding.tsx`

**Tipo:** Client Component (`"use client"`)

**Props:**
```typescript
interface McpOnboardingProps {
  serverUrl: string // "https://bolao-abj.vercel.app/api/mcp"
}
```

**Estados:** `idle` | `copied`

**Comportamento:**
1. Exibir bloco com título "CONECTAR VIA IA (MCP)"
2. Exibir URL em campo readonly com botão "COPIAR URL"
3. Ao clicar: `navigator.clipboard.writeText(serverUrl)`, mudar estado para `copied` por 2 segundos, restaurar
4. Exibir instrução: "Compatível com Claude Desktop, Claude.ai e outros clientes MCP. Na primeira conexão, você será redirecionado para fazer login normalmente."

**Design visual (estilo Elifoot):**
```
┌──────────────────────────────────────────────────────┐
│  CONECTAR VIA IA (MCP)                               │
├──────────────────────────────────────────────────────┤
│  URL DO SERVIDOR:                                    │
│  https://bolao-abj.vercel.app/api/mcp  [COPIAR URL]  │
│                                                      │
│  Compatível com Claude Desktop, Claude.ai e outros   │
│  clientes MCP. Na primeira conexão, você será        │
│  redirecionado para fazer login normalmente.         │
└──────────────────────────────────────────────────────┘
```

- Container: `border border-[color-border] bg-[color-surface] p-4 font-mono`
- Título: uppercase, `color-primary`, letter-spacing
- URL: campo `<input readonly>` ou `<code>` com `color-accent`
- Botão copiar: borda `color-border`, hover muda para `color-primary`; após copiar, texto muda para "COPIADO ✓" em `color-win`

---

### Link de Configurações na Navegação

**Arquivo:** `app/(dashboard)/nav-links.tsx`

**Modificação:** Adicionar link "CONFIGURAÇÕES" apontando para `/configuracoes` na navegação do dashboard.

---

## Regras de Negócio

### Resolução do Grupo Ativo no MCP

O MCP não tem acesso a cookies. Toda tool que precise do grupo ativo deve executar o fallback do `resolveActiveGroup`: buscar o primeiro grupo do usuário por `joined_at ASC`.

```typescript
// lib/mcp/auth.ts — resolveGroupForMcp
async function resolveGroupForMcp(serviceClient: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.group_id ?? null
}
```

Se retornar `null`, todas as tools afetadas retornam o texto: `"Você não pertence a nenhum grupo ativo no bolão."`

### Deadline de Palpite

A tool `fazer_palpite` deve recusar quando:
- `new Date() >= new Date(game.match_date) - 5 * 60 * 1000` (mesma lógica de `app/api/predictions/route.ts`)
- Mensagem: `"Prazo encerrado — faltam menos de 5 minutos para o início do jogo."`

### Visibilidade de Palpites de Terceiros

A tool `ver_palpites_jogo` só retorna palpites de outros participantes quando `game.status !== 'pending'`. Se o jogo ainda está pendente, retorna: `"Os palpites deste jogo só são revelados após o início da partida."`

### Upsert de Palpites

A tool `fazer_palpite` deve fazer upsert (INSERT OR UPDATE) na tabela `predictions` com a constraint `UNIQUE(user_id, game_id, group_id)`. Usar `.upsert({ ... }, { onConflict: 'user_id,game_id,group_id' })`.

### Validação de Placar

`home_score` e `away_score` devem ser inteiros >= 0. Se inválidos: `"Placar inválido — os valores devem ser zero ou positivos."`

### Erro de Jogo Não Encontrado

Se `game_id` não corresponder a nenhum jogo: `"Jogo não encontrado."`

---

## Proteção de Rotas

- `GET /api/mcp/oauth/metadata` — pública
- `GET /api/mcp/oauth/authorize` — pública
- `GET /api/mcp/oauth/callback` — pública (valida o access_token internamente)
- `POST /api/mcp/oauth/token` — pública (valida o código internamente)
- `POST /api/mcp` — protegida via `Authorization: Bearer` (retorna 401 se ausente/inválido)
- `app/mcp/autorizar/page.tsx` — pública (é a tela de login)
- `app/(dashboard)/configuracoes/page.tsx` — protegida pelo middleware existente do dashboard

---

## Biblioteca MCP SDK

### Instalação

```bash
npm install @modelcontextprotocol/sdk
```

### Instância do Servidor

**Arquivo:** `lib/mcp/server.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod' // já disponível indiretamente; instalar se necessário

export function createMcpServer() {
  const server = new McpServer({
    name: 'bolao-abj',
    version: '1.0.0',
  })
  // tools registradas aqui
  return server
}
```

**Observação sobre Zod:** O MCP SDK usa `zod` para definição de schemas de tools. Verificar se já está nas dependências; se não, instalar: `npm install zod`.

### Handler Principal

**Arquivo:** `lib/mcp/server.ts` — função `createMcpHandler`

```typescript
export async function createMcpHandler(request: NextRequest): Promise<Response> {
  // 1. Autenticar Bearer token → userId
  // 2. Criar instância McpServer com tools injetadas com userId e serviceClient
  // 3. Criar StreamableHTTPServerTransport
  // 4. Conectar server ao transport
  // 5. Processar request e retornar Response
}
```

O `StreamableHTTPServerTransport` do SDK aceita a Request nativa do Web API e retorna uma Response — compatível com Next.js App Router Route Handlers.

---

## Tools MCP — Especificação Detalhada

### Arquivo: `lib/mcp/tools/jogos.ts`

#### Tool: `listar_jogos`

**Descrição:** "Lista jogos da Copa do Mundo, com filtros opcionais por data, status ou rodada."

**Schema de input (Zod):**
```typescript
z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('Data no formato YYYY-MM-DD (opcional)'),
  status: z.enum(['pending', 'live', 'finished']).optional()
    .describe('Filtro por status do jogo (opcional)'),
  rodada: z.string().optional()
    .describe('Filtro por rodada, ex: "Grupo A", "Oitavas" (opcional)'),
})
```

**Query Supabase:**
```typescript
let query = serviceClient
  .from('games')
  .select('id,home_team,away_team,home_team_code,away_team_code,match_date,home_score,away_score,status,round,venue')
  .order('match_date', { ascending: true })

if (data) {
  // Usar dayBoundsInUTC(data) de lib/date.ts para filtrar por dia em BRT
  const { start, end } = dayBoundsInUTC(data)
  query = query.gte('match_date', start).lte('match_date', end)
}
if (status) query = query.eq('status', status)
if (rodada) query = query.eq('round', rodada)
```

**Retorno (texto formatado para o AI):**
```
Jogos encontrados: 3

1. BRA × ARG — 14/06/2026 15:00 (Grupo A) — PENDENTE
   Venue: MetLife Stadium
   ID: abc-123...

2. ...
```

Se nenhum jogo: `"Nenhum jogo encontrado com os filtros informados."`

---

#### Tool: `ver_jogo`

**Descrição:** "Exibe detalhes completos de um jogo específico pelo ID."

**Schema de input (Zod):**
```typescript
z.object({
  game_id: z.string().uuid().describe('ID do jogo (UUID)'),
})
```

**Query Supabase:**
```typescript
const { data: game } = await serviceClient
  .from('games')
  .select('*')
  .eq('id', game_id)
  .maybeSingle()
```

**Retorno:** objeto jogo formatado em texto. Se não encontrado: `"Jogo não encontrado."`

---

### Arquivo: `lib/mcp/tools/ranking.ts`

#### Tool: `ver_ranking`

**Descrição:** "Exibe o ranking completo do bolão para o grupo ativo do participante."

**Schema de input:** `z.object({})` (sem parâmetros)

**Implementação:**
1. Resolver grupo via `resolveGroupForMcp(serviceClient, userId)`
2. Se null: retornar `"Você não pertence a nenhum grupo ativo no bolão."`
3. Chamar `serviceClient.rpc('get_ranking', { p_group_id: groupId })`
4. Calcular aproveitamento: `Math.round((total_points / (games_predicted * 9)) * 100)`

**Retorno (texto formatado):**
```
RANKING — BOLÃO ABJ
──────────────────────────────────────
#1  GOLEADOR_MASTER      47 pts  73%
#2  FUTEBOL_REI          39 pts  61%
#3  TORCEDOR_FIEL        35 pts  55%
──────────────────────────────────────
(você está em #2)
```

---

### Arquivo: `lib/mcp/tools/palpites.ts`

#### Tool: `meus_palpites`

**Descrição:** "Lista os palpites do participante autenticado, com pontuação quando disponível."

**Schema de input (Zod):**
```typescript
z.object({
  status: z.enum(['pending', 'live', 'finished']).optional()
    .describe('Filtrar por status do jogo (opcional)'),
})
```

**Query Supabase:**
```typescript
let query = serviceClient
  .from('predictions')
  .select(`
    id, home_score, away_score, submitted_at,
    games!inner(id, home_team, away_team, home_team_code, away_team_code, match_date, status, round),
    scores(points, breakdown)
  `)
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .order('games(match_date)', { ascending: true })

if (status) query = query.eq('games.status', status)
```

**Retorno (texto formatado):**
```
Meus palpites (12 jogos)

BRA × ARG — 14/06 — ENCERRADO
  Palpite: 3 × 1   |   Resultado: 3 × 1   |   +8 pts ✓

ESP × FRA — 15/06 — PENDENTE
  Palpite: 2 × 0   |   Aguardando início
```

---

#### Tool: `ver_palpites_jogo`

**Descrição:** "Exibe os palpites de todos os participantes em um jogo específico. Disponível apenas após o início da partida."

**Schema de input (Zod):**
```typescript
z.object({
  game_id: z.string().uuid().describe('ID do jogo (UUID)'),
})
```

**Implementação:**
1. Buscar jogo via `serviceClient.from('games').select('id,status,home_team,away_team').eq('id', game_id).maybeSingle()`
2. Se não encontrado: `"Jogo não encontrado."`
3. Se `game.status === 'pending'`: `"Os palpites deste jogo só são revelados após o início da partida."`
4. Resolver `groupId` via `resolveGroupForMcp`
5. Buscar palpites + perfis + scores:
```typescript
const { data } = await serviceClient
  .from('predictions')
  .select(`
    user_id, home_score, away_score,
    profiles!inner(name),
    scores(points)
  `)
  .eq('game_id', game_id)
  .eq('group_id', groupId)
```

**Retorno (texto formatado):**
```
Palpites — BRA × ARG (ENCERRADO: 3×1)

GOLEADOR_MASTER   3 × 1   +8 pts ✓
FUTEBOL_REI       2 × 1   +3 pts
TORCEDOR_FIEL     1 × 0   +3 pts
```

---

#### Tool: `fazer_palpite`

**Descrição:** "Registra ou atualiza o palpite do participante em um jogo. Só é possível até 5 minutos antes do início."

**Schema de input (Zod):**
```typescript
z.object({
  game_id: z.string().uuid().describe('ID do jogo (UUID)'),
  home_score: z.number().int().min(0).describe('Placar do time da casa (>= 0)'),
  away_score: z.number().int().min(0).describe('Placar do time visitante (>= 0)'),
})
```

**Implementação:**
1. Resolver `groupId`; se null: retornar erro de grupo
2. Buscar jogo: `serviceClient.from('games').select('id,match_date,status,home_team,away_team').eq('id', game_id).maybeSingle()`
3. Se não encontrado: `"Jogo não encontrado."`
4. Checar deadline: `new Date() >= new Date(game.match_date).getTime() - 5 * 60 * 1000`; se vencido: `"Prazo encerrado — faltam menos de 5 minutos para o início do jogo."`
5. Checar status: se `game.status !== 'pending'`: `"Prazo encerrado — faltam menos de 5 minutos para o início do jogo."`
6. Verificar membership: `serviceClient.from('group_members').select('id').eq('group_id', groupId).eq('user_id', userId).maybeSingle()`; se null: retornar erro de grupo
7. Upsert:
```typescript
await serviceClient
  .from('predictions')
  .upsert({
    user_id: userId,
    game_id,
    group_id: groupId,
    home_score,
    away_score,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_id,group_id' })
  .select()
  .single()
```

**Retorno de sucesso:**
```
Palpite registrado com sucesso!

BRA × ARG — 14/06/2026
Seu palpite: 2 × 1
Deadline: 14/06/2026 14:55

Boa sorte!
```

---

## Lib de Autenticação MCP

**Arquivo:** `lib/mcp/auth.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
}

export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
}

export async function authenticateBearer(token: string): Promise<{ userId: string } | null> {
  const { data: { user }, error } = await createAnonClient().auth.getUser(token)
  if (error || !user) return null
  return { userId: user.id }
}

export async function resolveGroupForMcp(serviceClient: ReturnType<typeof createServiceClient>, userId: string): Promise<string | null> {
  const { data } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.group_id ?? null
}
```

---

## Variáveis de Ambiente

Não são necessárias novas variáveis de ambiente. As existentes cobrem tudo:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Estrutura de Arquivos a Criar

```
app/
├── api/mcp/
│   ├── oauth/
│   │   ├── metadata/route.ts      # GET — RFC 8414 discovery
│   │   ├── callback/route.ts      # POST — emite código temporário
│   │   └── token/route.ts         # POST — troca código por access_token
│   └── route.ts                   # POST — endpoint MCP principal
├── mcp/
│   └── autorizar/
│       └── page.tsx               # Página de login para fluxo OAuth MCP
└── (dashboard)/
    └── configuracoes/
        └── page.tsx               # Tela de configurações com onboarding MCP

components/bolao/
└── McpOnboarding.tsx              # Componente de onboarding MCP

lib/mcp/
├── server.ts                      # instância McpServer + createMcpHandler
├── auth.ts                        # authenticateBearer + resolveGroupForMcp
└── tools/
    ├── jogos.ts                   # listar_jogos, ver_jogo
    ├── ranking.ts                 # ver_ranking
    └── palpites.ts                # meus_palpites, ver_palpites_jogo, fazer_palpite

supabase/migrations/
└── 20260618100000_create_mcp_oauth_codes.sql
```

**Nota:** O endpoint `GET /api/mcp/oauth/authorize` que antes seria em `app/api/mcp/oauth/authorize/route.ts` é substituído pela página Next.js `app/mcp/autorizar/page.tsx`. O cliente MCP vai apontar `authorization_endpoint` para esta página no metadata. Isso simplifica a implementação para o projeto que usa email/senha.

---

## Critérios de Aceite

- [ ] `GET /api/mcp/oauth/metadata` retorna JSON válido RFC 8414 com todos os endpoints corretos
- [ ] Adicionar URL `https://bolao-abj.vercel.app/api/mcp` no Claude Desktop abre browser para login
- [ ] Login com email/senha na página `/mcp/autorizar` redireciona de volta ao cliente MCP com código
- [ ] `POST /api/mcp/oauth/token` retorna `access_token` e `refresh_token` válidos
- [ ] `POST /api/mcp/oauth/token` com código já usado retorna erro 400
- [ ] `POST /api/mcp/oauth/token` com código expirado retorna erro 400
- [ ] `POST /api/mcp` sem Bearer retorna 401
- [ ] `POST /api/mcp` com Bearer válido aceita chamada de tool
- [ ] Tool `listar_jogos` sem filtros retorna lista de jogos
- [ ] Tool `listar_jogos` com `data: "2026-06-14"` retorna apenas jogos daquele dia
- [ ] Tool `ver_jogo` com UUID válido retorna detalhes do jogo
- [ ] Tool `ver_jogo` com UUID inválido/inexistente retorna `"Jogo não encontrado."`
- [ ] Tool `ver_ranking` retorna ranking do primeiro grupo do usuário
- [ ] Tool `ver_ranking` para usuário sem grupo retorna `"Você não pertence a nenhum grupo ativo no bolão."`
- [ ] Tool `meus_palpites` retorna lista de palpites do usuário autenticado
- [ ] Tool `ver_palpites_jogo` em jogo `pending` retorna mensagem de palpites não revelados
- [ ] Tool `ver_palpites_jogo` em jogo `live`/`finished` retorna palpites de todos os participantes
- [ ] Tool `fazer_palpite` registra palpite com sucesso antes do deadline
- [ ] Tool `fazer_palpite` recusa com mensagem de deadline quando faltam menos de 5min
- [ ] Tool `fazer_palpite` com placar negativo retorna mensagem de placar inválido
- [ ] Tool `fazer_palpite` faz upsert (editar palpite existente funciona)
- [ ] Tabela `mcp_oauth_codes` criada via migration com RLS habilitado e sem policies públicas
- [ ] Componente `McpOnboarding` exibe URL e botão "COPIAR URL" funcional
- [ ] Rota `/configuracoes` protegida (redireciona para login se não autenticado)
- [ ] Link "CONFIGURAÇÕES" aparece na navegação do dashboard
- [ ] Design segue DESIGN.md (paleta, tipografia monospace JetBrains Mono, estilo Elifoot)
- [ ] Funciona em mobile (coluna única)
- [ ] `npm install @modelcontextprotocol/sdk` (e `zod` se necessário) adicionado ao `package.json`
