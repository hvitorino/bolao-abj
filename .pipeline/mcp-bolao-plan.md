# Plano de Implementação: Servidor MCP Remoto do Bolão

**Slug:** mcp-bolao
**Branch:** feature/mcp-bolao
**Data:** 2026-06-18
**Spec:** .pipeline/mcp-bolao-spec.md

## Tarefas

- [ ] 1. Instalar dependências: `@modelcontextprotocol/sdk` e `zod` via npm
- [ ] 2. Criar migration `supabase/migrations/20260618100000_create_mcp_oauth_codes.sql` com schema atualizado (inclui `code_challenge`, `access_token`, `refresh_token`)
- [ ] 3. Criar `lib/mcp/auth.ts` com `createAnonClient`, `createServiceClient`, `authenticateBearer` e `resolveGroupForMcp`
- [ ] 4. Criar `lib/mcp/tools/jogos.ts` com tools `listar_jogos` e `ver_jogo`
- [ ] 5. Criar `lib/mcp/tools/ranking.ts` com tool `ver_ranking`
- [ ] 6. Criar `lib/mcp/tools/palpites.ts` com tools `meus_palpites`, `ver_palpites_jogo` e `fazer_palpite`
- [ ] 7. Criar `lib/mcp/server.ts` com `createMcpServer` e `createMcpHandler` (registra todas as tools)
- [ ] 8. Criar `app/api/mcp/oauth/metadata/route.ts` — GET RFC 8414 discovery (público)
- [ ] 9. Criar `app/api/mcp/oauth/callback/route.ts` — POST que gera código temporário e salva em `mcp_oauth_codes`
- [ ] 10. Criar `app/api/mcp/oauth/token/route.ts` — POST que troca código por access_token (valida PKCE)
- [ ] 11. Criar `app/api/mcp/route.ts` — POST endpoint principal MCP com autenticação Bearer
- [ ] 12. Criar `app/mcp/autorizar/page.tsx` — Client Component com formulário de login MCP
- [ ] 13. Criar `components/bolao/McpOnboarding.tsx` — Client Component com URL e botão copiar
- [ ] 14. Criar `app/(dashboard)/configuracoes/page.tsx` — Server Component com `<McpOnboarding />`
- [ ] 15. Adicionar link "CONFIGURAÇÕES" em `app/(dashboard)/nav-links.tsx`
