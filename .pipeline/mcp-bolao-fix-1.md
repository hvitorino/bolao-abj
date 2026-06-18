# Fix 1: Servidor MCP Remoto do Bolão

**Slug:** mcp-bolao
**Data:** 2026-06-18
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Race condition no token endpoint — update atômico não verifica linhas afetadas
**Arquivo:** `app/api/mcp/oauth/token/route.ts` (linhas 117–137)
**Severidade:** importante
**Descrição:** O endpoint POST `/api/mcp/oauth/token` usa `.update({ used: true }).eq('code', code).eq('used', false)` como guarda atômica para one-time use do código OAuth. Porém, após o update, o código não verifica se alguma linha foi realmente modificada. No Supabase/PostgREST, um `UPDATE` que não encontra linhas correspondentes (porque outra requisição concorrente já atualizou `used = true`) não retorna erro — simplesmente não atualiza nada e retorna sucesso. O código então continua e retorna o `access_token`, tornando possível (com timing preciso) trocar o mesmo código duas vezes.

**Correção esperada:** Após o update, usar `.select('code')` encadeado para recuperar as linhas modificadas (ou equivalente). Se retornar array vazio, o código já foi usado por outra requisição concorrente — retornar 400:

```typescript
const { data: updatedRows, error: updateError } = await db
  .from('mcp_oauth_codes')
  .update({ used: true })
  .eq('code', code)
  .eq('used', false)
  .select('code')

if (updateError) {
  console.error('[mcp/oauth/token] update error:', updateError)
  return NextResponse.json(
    { error: 'server_error', message: 'Erro ao processar token.' },
    { status: 500 }
  )
}

if (!updatedRows || updatedRows.length === 0) {
  return NextResponse.json(
    { error: 'invalid_grant', message: 'Código de autorização já utilizado.' },
    { status: 400 }
  )
}
```

---

### Problema 2: `meus_palpites` ordena por `submitted_at` em vez de `games(match_date)`
**Arquivo:** `lib/mcp/tools/palpites.ts` (linha 78)
**Severidade:** menor
**Descrição:** A spec define que a listagem de palpites deve ser ordenada por data do jogo (`games(match_date)`, ascending). A implementação usa `submitted_at` (data de envio do palpite). Se um participante fizer palpites fora de ordem cronológica dos jogos, a listagem ficará desordenada do ponto de vista do usuário.

**Correção esperada:** Substituir:
```typescript
.order('submitted_at', { ascending: true })
```
Por:
```typescript
.order('match_date', { ascending: true, referencedTable: 'games' })
```

---

## Itens OK (não precisam ser revisados novamente)

- Migration `20260618100000_create_mcp_oauth_codes.sql` — criada corretamente com todos os campos da spec (incluindo `code_challenge`, `access_token`, `refresh_token`, RLS habilitado sem policies públicas)
- `lib/mcp/auth.ts` — `createAnonClient`, `createServiceClient`, `authenticateBearer`, `resolveGroupForMcp` implementados conforme spec
- `lib/mcp/server.ts` — `WebStandardStreamableHTTPServerTransport` disponível e exportado na versão `^1.29.0` do SDK; modo stateless correto para serverless; autenticação Bearer validada antes de processar qualquer tool
- `app/api/mcp/oauth/metadata/route.ts` — `authorization_endpoint` aponta para `/mcp/autorizar` conforme nota da spec; issuer construído dinamicamente a partir do header `host`
- `app/api/mcp/oauth/callback/route.ts` — valida access_token via anonClient, salva código com code_challenge, retorna redirect_url
- `app/api/mcp/oauth/token/route.ts` (validações exceto race condition) — grant_type, used, expires_at, redirect_uri, PKCE (quando fornecido) todos corretos
- `app/api/mcp/route.ts` — suporta POST, GET, DELETE conforme spec
- `lib/mcp/tools/jogos.ts` — `listar_jogos` e `ver_jogo` implementados conforme spec; `dayBoundsInUTC` importado corretamente
- `lib/mcp/tools/ranking.ts` — `ver_ranking` correto; `MAX_POINTS_PER_GAME = 9` consistente com o restante do projeto
- `lib/mcp/tools/palpites.ts` — `ver_palpites_jogo` e `fazer_palpite` implementados corretamente; deadline 5min, upsert com `onConflict: 'user_id,game_id,group_id'`, visibilidade pós-pending, validação de membership
- `app/mcp/autorizar/page.tsx` — Client Component com formulário de login, lê query params corretos, fluxo completo de callback
- `components/bolao/McpOnboarding.tsx` — URL readonly, botão "COPIAR URL" com feedback "COPIADO ✓", fallback execCommand
- `app/(dashboard)/configuracoes/page.tsx` — protegido pelo layout do dashboard, serverUrl dinâmico a partir do host
- `app/(dashboard)/nav-links.tsx` — link CONFIGURAÇÕES adicionado
- Design: JetBrains Mono, variáveis CSS de cor (color-primary, color-accent, color-surface, etc.), estilo Elifoot sem sombras
- Build TypeScript sem erros
- Dependências: `@modelcontextprotocol/sdk ^1.29.0` e `zod ^4.4.3` adicionados ao package.json
- Segurança: sem SQL injection (Supabase client), sem XSS, sem credenciais hardcoded, autenticação Bearer em todos os endpoints protegidos
