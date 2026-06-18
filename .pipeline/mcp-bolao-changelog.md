# Changelog: Servidor MCP Remoto do Bolão

**Slug:** mcp-bolao
**Branch:** feature/mcp-bolao
**Data:** 2026-06-18
**Status:** aguardando revisão (fix-1 aplicado)

---

## O que foi implementado

### Backend — Lib MCP (TypeScript)

- `lib/mcp/auth.ts` — `createAnonClient`, `createServiceClient`, `authenticateBearer` (valida JWT Supabase via Bearer token) e `resolveGroupForMcp` (busca primeiro grupo do usuário por `joined_at ASC`)
- `lib/mcp/tools/jogos.ts` — registra tools `listar_jogos` (com filtros opcionais de data, status e rodada usando `dayBoundsInUTC`) e `ver_jogo` (detalhes por UUID)
- `lib/mcp/tools/ranking.ts` — registra tool `ver_ranking` que resolve o grupo ativo via `resolveGroupForMcp` e chama `get_ranking` RPC; calcula aproveitamento percentual
- `lib/mcp/tools/palpites.ts` — registra tools `meus_palpites` (com filtro de status), `ver_palpites_jogo` (só revela após status != pending) e `fazer_palpite` (upsert com validação de deadline, grupo e status do jogo)
- `lib/mcp/server.ts` — `createMcpServer` (instancia McpServer e registra todas as tools) e `createMcpHandler` (autentica Bearer, cria servidor MCP por requisição, usa `WebStandardStreamableHTTPServerTransport` stateless com `enableJsonResponse: true`)

### Backend — Route Handlers (Next.js App Router)

- `app/api/mcp/oauth/metadata/route.ts` — `GET /api/mcp/oauth/metadata`: discovery RFC 8414 dinâmico (usa header `host` da requisição para suportar preview deployments e produção)
- `app/api/mcp/oauth/callback/route.ts` — `POST /api/mcp/oauth/callback`: valida access_token Supabase, gera código temporário (`crypto.randomBytes(32).toString('hex')`), salva em `mcp_oauth_codes` via service_role com `code_challenge`, `access_token` e `refresh_token`
- `app/api/mcp/oauth/token/route.ts` — `POST /api/mcp/oauth/token`: aceita `application/x-www-form-urlencoded` e JSON; valida `grant_type`, busca código, verifica `used`, `expires_at`, `redirect_uri` e PKCE (SHA256 do `code_verifier` em base64url); marca `used=true` atomicamente; retorna `access_token` e `refresh_token` originais
- `app/api/mcp/route.ts` — `POST/GET/DELETE /api/mcp`: delega para `createMcpHandler` (suporte a todos os métodos do protocolo Streamable HTTP)

### Frontend (Next.js/React)

- `app/mcp/autorizar/page.tsx` — Client Component com formulário de login email/senha estilo DESIGN.md; lê `redirect_uri`, `state`, `code_challenge` e `code_challenge_method` dos query params; após login, faz POST para `/api/mcp/oauth/callback` e redireciona via `window.location.href`
- `components/bolao/McpOnboarding.tsx` — Client Component com caixa de URL readonly (clicável para selecionar) e botão "COPIAR URL" com feedback visual "COPIADO ✓" por 2 segundos; hover verde no botão; fallback de clipboard via `execCommand`
- `app/(dashboard)/configuracoes/page.tsx` — Server Component protegido pelo middleware do dashboard; calcula `serverUrl` dinamicamente a partir do header `host`; renderiza `<McpOnboarding />`

### Navegação

- `app/(dashboard)/nav-links.tsx` — Adicionado link "CONFIGURAÇÕES" apontando para `/configuracoes`

### Banco de Dados

- Migration `supabase/migrations/20260618100000_create_mcp_oauth_codes.sql`: cria tabela `mcp_oauth_codes` com campos `code`, `user_id`, `redirect_uri`, `code_challenge`, `access_token`, `refresh_token`, `expires_at` (default `now() + 5min`) e `used` (default `false`); RLS habilitado sem policies públicas (acesso exclusivo via service_role)

---

## Decisões técnicas

### WebStandardStreamableHTTPServerTransport em vez de StreamableHTTPServerTransport

O SDK oferece dois transportes: `StreamableHTTPServerTransport` (wrapper para Node.js IncomingMessage/ServerResponse) e `WebStandardStreamableHTTPServerTransport` (Web Standards Request/Response). O Next.js App Router usa Web Standards, portanto o `WebStandardStreamableHTTPServerTransport` é o correto. A opção `enableJsonResponse: true` simplifica a operação stateless sem SSE de longa duração (cada request cria e fecha seu próprio servidor MCP).

### Modo stateless (sessionIdGenerator: undefined)

Cada requisição POST ao endpoint `/api/mcp` cria um servidor MCP próprio, sem estado compartilhado entre requests. Isso é necessário pois o ambiente serverless da Vercel não mantém estado entre invocações. A desvantagem é que não há suporte a SSE de longa duração (streaming parcial), mas `enableJsonResponse: true` garante respostas completas em um único response.

### `authorization_endpoint` apontando para página Next.js

Em vez de um route handler separado em `/api/mcp/oauth/authorize`, o `authorization_endpoint` no metadata aponta diretamente para `/mcp/autorizar` (página Next.js). Isso simplifica o fluxo para projetos com autenticação por email/senha, sem necessidade de formulário externo ou redirect intermediário adicional.

### `resolveGroupForMcp` — grupo por `joined_at ASC`

Como o MCP não tem acesso a cookies (onde o grupo ativo fica salvo no dashboard), usa-se o primeiro grupo em que o usuário entrou. Isso é consistente com o fallback já usado em outras partes do sistema.

### PKCE como opcional no token endpoint

A spec RFC 7636 indica que o servidor DEVE verificar o PKCE se o cliente o enviou durante a autorização. A implementação verifica somente se `code_verifier` está presente no corpo da requisição de token, mantendo compatibilidade com clientes que não enviam o verifier (embora sejam raros).

---

## Pontos de atenção para o Revisor

1. **WebStandardStreamableHTTPServerTransport**: verificar se a versão `^1.29.0` do SDK já exporta esta classe no caminho `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`
2. **`server.close()` no finally**: após `handleRequest`, o servidor é fechado. Verificar se isso causa problemas com respostas SSE em stream (improvável no modo stateless com `enableJsonResponse`)
3. **`games` como objeto vs array**: na query de `meus_palpites` (palpites.ts), o join `games!inner(...)` pode retornar objeto ou array dependendo da versão do Supabase PostgREST. O cast via `unknown` contorna o erro TypeScript mas o código presume que `pred.games` é um objeto. Verificar comportamento em runtime
4. **`refresh_token` vazio**: no callback, se `refresh_token` não for string (ex: null), salva string vazia. No token endpoint, retorna `undefined` se a string for vazia. Verificar se clientes MCP lidam bem com `refresh_token` ausente
5. **Sem rate limiting no token endpoint**: qualquer um pode tentar códigos em brute force (embora sejam 64 chars hex). Considerar adicionar rate limiting via middleware no futuro
6. **`app/mcp/autorizar`** está fora do grupo `(auth)` e `(dashboard)` — não tem layout especial. Isso é intencional (página standalone), mas verificar se o middleware de auth do projeto protege inadvertidamente esta rota

---

## Correções Fix 1 (2026-06-18)

### Problema 1 — Race condition no token endpoint
**Arquivo:** `app/api/mcp/oauth/token/route.ts`
- Encadeado `.select('code')` ao update atômico (`.update({ used: true }).eq('code', code).eq('used', false).select('code')`).
- Após o update, verifica se `updatedRows` é não-vazio; caso contrário, retorna `400 invalid_grant` com mensagem "Código de autorização já utilizado." — detecta concorrência sem janela de race condition.

### Problema 2 — Ordenação de palpites por data do jogo
**Arquivo:** `lib/mcp/tools/palpites.ts` (linha 78)
- Substituído `.order('submitted_at', { ascending: true })` por `.order('match_date', { ascending: true, referencedTable: 'games' })`.
- Palpites agora listados em ordem cronológica dos jogos, independentemente da ordem de submissão.

---

## Commits realizados

```
1ace9db fix(mcp-bolao): corrige type cast em palpites.ts para evitar erro TS2352
bcae6ad feat(mcp-bolao): adiciona link CONFIGURAÇÕES na navegação do dashboard
e95c8c4 feat(mcp-bolao): cria página /configuracoes com onboarding MCP
68d089a feat(mcp-bolao): cria componente McpOnboarding com URL e botão copiar
adf7882 feat(mcp-bolao): cria página app/mcp/autorizar com formulário de login OAuth MCP
4c9d5b8 feat(mcp-bolao): cria POST /api/mcp endpoint principal do servidor MCP
d6cc851 feat(mcp-bolao): cria POST /api/mcp/oauth/token com validação PKCE e troca de código
4d277a4 feat(mcp-bolao): cria POST /api/mcp/oauth/callback que gera código temporário MCP
72a024a feat(mcp-bolao): cria GET /api/mcp/oauth/metadata com discovery RFC 8414
bf55981 feat(mcp-bolao): cria lib/mcp/server.ts com createMcpServer e createMcpHandler
f6a7033 feat(mcp-bolao): cria lib/mcp/tools/palpites.ts com tools meus_palpites, ver_palpites_jogo e fazer_palpite
f205aaf feat(mcp-bolao): cria lib/mcp/tools/ranking.ts com tool ver_ranking
97736ea feat(mcp-bolao): cria lib/mcp/tools/jogos.ts com tools listar_jogos e ver_jogo
c866ab5 feat(mcp-bolao): cria lib/mcp/auth.ts com autenticação Bearer e resolveGroupForMcp
209ce61 feat(mcp-bolao): cria migration mcp_oauth_codes
a9c23fa feat(mcp-bolao): instala @modelcontextprotocol/sdk e zod
d85eeb7 chore(mcp-bolao): adiciona plano de implementação
```
