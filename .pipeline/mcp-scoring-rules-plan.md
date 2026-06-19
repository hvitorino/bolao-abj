# Plano de Implementação: Tool MCP — Consultar Regras de Pontuação

**Slug:** mcp-scoring-rules
**Branch:** feature/mcp-scoring-rules
**Data:** 2026-06-19
**Spec:** .pipeline/mcp-scoring-rules-spec.md

## Tarefas

- [ ] 1. Criar `lib/mcp/tools/scoring-rules.ts` com a função `registerScoringRulesTools(server: McpServer): void` registrando a tool `consultar_regras_pontuacao` com schema Zod vazio e texto hardcoded das regras
- [ ] 2. Atualizar `lib/mcp/server.ts` para importar e registrar `registerScoringRulesTools(server)` em `createMcpServer` sem passar `userId`
- [ ] 3. Verificar `npm run lint` e `npm run build` sem erros
