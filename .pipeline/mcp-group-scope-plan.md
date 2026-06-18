# Plano de Implementação: Suporte a Múltiplos Grupos no Servidor MCP

**Slug:** mcp-group-scope
**Branch:** feature/mcp-group-scope
**Data:** 2026-06-18
**Spec:** .pipeline/mcp-group-scope-spec.md

## Tarefas

- [ ] 1. Adicionar `validateGroupMembership` em `lib/mcp/auth.ts`
- [ ] 2. Criar `lib/mcp/tools/grupos.ts` com `registerGruposTools` (tool `listar_grupos`)
- [ ] 3. Modificar `lib/mcp/tools/palpites.ts` — adicionar `group_id` em `meus_palpites` e `fazer_palpite`, remover verificação de membership redundante
- [ ] 4. Modificar `lib/mcp/tools/ranking.ts` — adicionar `group_id` em `ver_ranking`
- [ ] 5. Registrar `registerGruposTools` em `lib/mcp/server.ts`
- [ ] 6. Verificar compilação TypeScript sem erros (`tsc --noEmit`)
