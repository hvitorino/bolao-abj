# Changelog: Tool MCP — Consultar Regras de Pontuação

**Slug:** mcp-scoring-rules
**Branch:** feature/mcp-scoring-rules
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### MCP (TypeScript)
- `lib/mcp/tools/scoring-rules.ts` — Registra a tool `consultar_regras_pontuacao` no `McpServer`. Sem parâmetros de entrada (schema Zod vazio `{}`). Retorna texto hardcoded com todas as regras de pontuação: 6 eventos com pontos, pontuação máxima (9 pts), regras de cumulatividade, tratamento de empate e 5 exemplos concretos de cálculo.
- `lib/mcp/server.ts` — Adicionados import de `registerScoringRulesTools` e chamada `registerScoringRulesTools(server)` em `createMcpServer`, sem passar `userId` (tool é stateless).

### Backend (Ruby/Sinatra)
Nenhuma alteração.

### Frontend (Next.js/React)
Nenhuma alteração.

### Banco de Dados
Nenhuma migration. A tool retorna dados estáticos.

---

## Decisões técnicas

- **Schema Zod vazio como `{}`**: A spec exige objeto vazio sem parâmetros. O SDK MCP aceita `{}` literal diretamente, sem necessidade de `z.object({})`, portanto o import do `zod` foi removido para evitar warning de lint.
- **Texto hardcoded como constante de módulo**: O texto das regras é definido como constante `SCORING_RULES_TEXT` fora da função de registro, evitando alocação a cada chamada da tool.
- **Chamada sem `userId`**: Consistente com `registerJogosTools(server)`, pois a tool não acessa o Supabase nem filtra por usuário.

---

## Pontos de atenção para o Revisor

- Verificar se o texto retornado pela tool corresponde exatamente ao conteúdo especificado na spec (caracteres de linha, símbolos Unicode como `════`, `────`, `✓`, `✗`).
- Confirmar que `registerScoringRulesTools` é chamado sem `userId` em `server.ts`.
- Confirmar que não há import de `createServiceClient` em `scoring-rules.ts`.
- Os 2 erros de lint pré-existentes (`group-switcher.tsx` e `GroupChatWidget.tsx`) não foram introduzidos por esta feature.

---

## Commits realizados

```
893fa8b fix(mcp-scoring-rules): remove import desnecessário do zod
15f8325 feat(mcp-scoring-rules): registra registerScoringRulesTools no createMcpServer
2c3e84d feat(mcp-scoring-rules): cria tool consultar_regras_pontuacao com regras hardcoded
32f2808 chore(mcp-scoring-rules): adiciona plano de implementação
```
