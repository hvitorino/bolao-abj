# MCP do Bolão — Design Spec

**Data:** 2026-06-18  
**Status:** Aprovado  
**Slug:** `mcp-bolao`

---

## Objetivo

Expor o Bolão ABJ como um servidor MCP remoto para que participantes autenticados possam consultar jogos, ranking e palpites — e fazer/editar palpites — via qualquer cliente MCP compatível (Claude Desktop, Claude.ai, Cursor, etc.), sem configuração manual de tokens.

---

## Escopo

- Servidor MCP remoto hospedado no Vercel (mesmo monorepo)
- Autenticação via OAuth 2.0 Authorization Code flow com Supabase como identity provider
- Acesso equivalente ao do participante comum no site: leitura geral + palpites próprios
- Sem ferramentas de admin (sync de placar, gestão de membros, etc.)

---

## Arquitetura

### Estrutura de Arquivos

```
app/api/mcp/
├── oauth/
│   ├── metadata/route.ts      # GET — RFC 8414 (discovery)
│   ├── authorize/route.ts     # GET — inicia OAuth, redireciona ao Supabase login
│   ├── callback/route.ts      # GET — recebe callback do Supabase, emite código temporário
│   └── token/route.ts         # POST — troca código por access token
└── route.ts                   # POST — endpoint MCP principal (Streamable HTTP)

lib/mcp/
├── server.ts                  # instância McpServer + tools registradas
├── auth.ts                    # valida Bearer token via supabase.auth.getUser
└── tools/
    ├── jogos.ts               # listar_jogos, ver_jogo
    ├── ranking.ts             # ver_ranking
    └── palpites.ts            # meus_palpites, fazer_palpite
```

### Dependência Nova

```
@modelcontextprotocol/sdk
```

### Banco de Dados

Nova tabela no Supabase para códigos de autorização temporários:

```sql
create table mcp_oauth_codes (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  used        boolean not null default false
);

-- RLS: sem acesso direto de clientes; só service role
alter table mcp_oauth_codes enable row level security;
```

O access token em circulação **é o próprio JWT do Supabase** — sem token extra para gerenciar. O servidor valida via `supabase.auth.getUser(bearerToken)`.

---

## Fluxo OAuth

```
1. Participante adiciona URL https://bolao-abj.vercel.app/api/mcp no cliente MCP
2. Cliente descobre endpoints via GET /api/mcp/oauth/metadata
3. Cliente abre browser → GET /api/mcp/oauth/authorize?client_id=...&redirect_uri=...&state=...&code_challenge=...
4. Servidor redireciona para Supabase Auth (login existente do site)
5. Participante faz login com email/senha que já usa no bolão
6. Supabase chama GET /api/mcp/oauth/callback?code=...
7. Servidor troca código Supabase por sessão, salva código temporário (5 min) em mcp_oauth_codes
8. Servidor redireciona para redirect_uri do cliente com o código temporário
9. Cliente faz POST /api/mcp/oauth/token — recebe access_token (JWT Supabase) + refresh_token
10. Cliente usa Bearer {access_token} em todas as chamadas subsequentes
11. Token expira em 1h; cliente faz refresh automaticamente via Supabase
```

**UX resultante:** participante faz login uma vez por dispositivo via browser. Sem copiar tokens manualmente.

---

## Resolução do Grupo Ativo no MCP

O MCP não tem acesso a cookies de sessão do browser. A resolução do grupo ativo usa o fallback do `resolveActiveGroup`: **primeiro grupo do usuário por `joined_at ASC`**. Se o usuário não pertencer a nenhum grupo, as tools retornam o erro `"Você não pertence a nenhum grupo ativo no bolão."`.

Para usuários com múltiplos grupos, o MCP sempre usa o mais antigo. Não há como trocar de grupo via MCP nesta versão.

---

## Registro de Clientes OAuth

O servidor aceita qualquer `client_id` sem registro prévio (open registration). Cada cliente MCP usa o `client_id` que quiser; o servidor não valida nem armazena. Isso simplifica a implementação e é seguro porque a identidade do usuário é garantida pelo fluxo Supabase Auth.

---

## Endpoint MCP Principal

- **Rota:** `POST /api/mcp`
- **Transport:** Streamable HTTP (padrão MCP 2025-03-26)
- **Auth:** valida `Authorization: Bearer <supabase_access_token>` em cada requisição
- **Contexto:** extrai `user_id` do token e passa para todas as tools

---

## Tools MCP

### Leitura

#### `listar_jogos`
Lista jogos filtrados opcionalmente por data, status ou rodada.

**Parâmetros:**
- `data` (string, opcional) — formato `YYYY-MM-DD`
- `status` (string, opcional) — `"pending"` | `"live"` | `"finished"`
- `rodada` (string, opcional) — ex: `"Grupo A"`, `"Oitavas"`

**Retorno:** array de jogos com id, times, data, placar, status, rodada, venue.

---

#### `ver_jogo`
Detalhes completos de um jogo.

**Parâmetros:**
- `game_id` (string, obrigatório)

**Retorno:** objeto jogo completo.

---

#### `ver_ranking`
Ranking completo do grupo ativo do usuário autenticado.

**Parâmetros:** nenhum.

**Retorno:** array de entradas com posição, nome, pontos totais, jogos apostados, aproveitamento.

---

#### `meus_palpites`
Palpites do usuário autenticado, opcionalmente filtrados por status do jogo.

**Parâmetros:**
- `status` (string, opcional) — `"pending"` | `"live"` | `"finished"`

**Retorno:** array de palpites com dados do jogo, placar apostado e pontuação obtida (quando disponível).

---

#### `ver_palpites_jogo`
Palpites de todos os participantes em um jogo específico.

**Parâmetros:**
- `game_id` (string, obrigatório)

**Regra:** só retorna palpites de outros participantes quando `status !== 'pending'` (mesmo comportamento do site). Retorna erro descritivo se o jogo ainda não começou.

**Retorno:** array com nome do participante, placar apostado e pontuação obtida.

---

### Escrita

#### `fazer_palpite`
Cria ou edita o palpite do usuário autenticado em um jogo (upsert).

**Parâmetros:**
- `game_id` (string, obrigatório)
- `home_score` (integer, obrigatório, >= 0)
- `away_score` (integer, obrigatório, >= 0)

**Validações (mesmas do site):**
- Recusa se `match_date - now() < 5 minutos`
- Recusa se jogo não está com status `"pending"`
- Recusa se placar negativo

**Retorno:** palpite salvo com confirmação.

---

## Tratamento de Erros

Todas as tools retornam erros em português para o AI comunicar ao participante:

| Situação | Mensagem |
|----------|----------|
| Prazo encerrado | `"Prazo encerrado — faltam menos de 5 minutos para o início do jogo."` |
| Jogo não encontrado | `"Jogo não encontrado."` |
| Placar inválido | `"Placar inválido — os valores devem ser zero ou positivos."` |
| Palpites não revelados ainda | `"Os palpites deste jogo só são revelados após o início da partida."` |
| Sem grupo ativo | `"Você não pertence a nenhum grupo ativo no bolão."` |
| Token expirado | HTTP 401 — cliente faz re-autenticação automaticamente |

---

## Onboarding do Participante

A tela de perfil/configurações da web app exibe:

```
Conectar via IA (MCP)
URL do servidor: https://bolao-abj.vercel.app/api/mcp
[Copiar URL]

Compatível com Claude Desktop, Claude.ai e outros clientes MCP.
Na primeira conexão, você será redirecionado para fazer login normalmente.
```

---

## Fora do Escopo

- Tools de admin (sync de placar ESPN, gestão de membros, criação de grupos)
- Resources MCP (apenas tools, por ora)
- Notificações push ou subscriptions em tempo real via MCP
- Suporte a múltiplos grupos simultaneamente (usa o grupo ativo do usuário)
