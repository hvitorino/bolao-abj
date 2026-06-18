# Changelog: Suporte a Múltiplos Grupos no Servidor MCP

**Slug:** mcp-group-scope
**Branch:** feature/mcp-group-scope
**Data:** 2026-06-18
**Status:** aprovado

---

## O que foi implementado

### Backend (TypeScript/MCP)

- `lib/mcp/auth.ts` — adicionada função exportada `validateGroupMembership(serviceClient, userId, groupId)` que verifica se o usuário é membro do grupo informado via consulta em `group_members`. Retorna sempre `{ valid, errorMessage }` sem lançar exceção.

- `lib/mcp/tools/grupos.ts` — arquivo novo com `registerGruposTools(server, userId)` que registra a tool `listar_grupos`. A tool consulta `group_members` com join em `groups`, ordena por `joined_at ASC` e retorna lista formatada com id, nome (maiúsculas), papel (ADMIN/MEMBRO) e data de entrada de cada grupo. Inclui nota sobre o grupo padrão (primeiro da lista) no rodapé da saída.

- `lib/mcp/tools/palpites.ts` — adicionado parâmetro `group_id` (UUID opcional) nas tools `meus_palpites` e `fazer_palpite`. Quando informado, chama `validateGroupMembership`; quando omitido, chama `resolveGroupForMcp` como fallback. Removido bloco de verificação de membership redundante em `fazer_palpite` (que duplicava lógica já coberta por `validateGroupMembership` e `resolveGroupForMcp`). Import atualizado para incluir `validateGroupMembership`.

- `lib/mcp/tools/ranking.ts` — adicionado parâmetro `group_id` (UUID opcional) na tool `ver_ranking`. Assinatura alterada de `async () =>` para `async ({ group_id }) =>`. Mesma lógica de resolução de grupo que `palpites.ts`. Import atualizado para incluir `validateGroupMembership`.

- `lib/mcp/server.ts` — adicionado import de `registerGruposTools` e chamada de registro dentro de `createMcpServer`, na posição correta (após `registerJogosTools`, antes de `registerRankingTools`).

### Banco de Dados

Nenhuma migration necessária. As tabelas `group_members`, `groups`, `predictions` e `scores` já existiam com as colunas necessárias (`group_id` em `predictions` e `scores`).

---

## Decisões técnicas

- **Tipo auxiliar `GroupRow`** em `grupos.ts`: o join Supabase `groups!inner(name)` pode retornar `groups` como objeto ou array dependendo da versão do PostgREST. Normalizamos com `Array.isArray(row.groups) ? row.groups[0] : row.groups`, seguindo o mesmo padrão já adotado em `palpites.ts` para `profiles`.

- **Remoção da verificação de membership em `fazer_palpite`**: o bloco original verificava `group_members` após `resolveGroupForMcp`, o que era redundante — `resolveGroupForMcp` só retorna grupos dos quais o usuário já é membro, e `validateGroupMembership` cobre o caso de `group_id` explícito. A remoção reduz uma query desnecessária por chamada.

- **Mensagem de erro não distingue "grupo inexistente" de "não membro"**: decisão deliberada da spec para evitar enumeração de grupos por atores maliciosos.

---

## Pontos de atenção para o Revisor

- Verificar que o tipo `GroupRow` em `grupos.ts` está correto e que a normalização `Array.isArray` funciona para ambos os formatos possíveis do PostgREST.
- Confirmar que a remoção do bloco de membership em `fazer_palpite` não introduz regressão — a cobertura agora vem do `validateGroupMembership` (path explícito) e do `resolveGroupForMcp` (path fallback).
- Verificar que `z` já estava importado em `ranking.ts` antes desta feature (sim, estava na linha 2 do arquivo original).
- Confirmar que nenhum arquivo em `supabase/migrations/` foi criado (critério de aceite explícito da spec).

---

## Commits realizados

```
1a9e7b1 feat(mcp-group-scope): registra registerGruposTools em server.ts
1b305a1 feat(mcp-group-scope): adiciona group_id em ver_ranking
d8f8dd9 feat(mcp-group-scope): adiciona group_id em meus_palpites e fazer_palpite
56863b8 feat(mcp-group-scope): cria tool listar_grupos em grupos.ts
462fdce feat(mcp-group-scope): adiciona validateGroupMembership em auth.ts
029f104 chore(mcp-group-scope): adiciona plano de implementação
```
