# Spec: Tool MCP — Consultar Regras de Pontuação

**Slug:** mcp-scoring-rules
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Adicionar uma tool `consultar_regras_pontuacao` ao servidor MCP do Bolão ABJ, expondo as regras de pontuação do bolão de forma estruturada e legível por qualquer cliente MCP compatível (Claude Desktop, Claude.ai, Cursor, etc.). A tool não requer parâmetros de entrada e retorna dados estáticos hardcoded — sem acesso ao Supabase.

---

## Histórias de Usuário

- Como participante do bolão usando um cliente MCP, quero consultar as regras de pontuação diretamente no chat para entender quanto vou ganhar com cada tipo de palpite
- Como agente de IA integrado ao servidor MCP, quero acessar as regras de pontuação de forma estruturada para responder perguntas dos usuários sobre pontuação sem precisar de contexto adicional
- Como desenvolvedor do bolão, quero que as regras estejam disponíveis via MCP para que agentes possam usá-las como fonte canônica em fluxos de análise

---

## Modelo de Dados

Nenhuma tabela nova ou modificada. Nenhuma migration necessária. A tool retorna dados estáticos derivados do `CLAUDE.md`.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo necessário. A feature é puramente uma tool MCP.

---

## Frontend — Componentes React

Nenhum componente novo necessário. A feature é puramente uma tool MCP.

---

## Implementação MCP

### Arquivo novo: `lib/mcp/tools/scoring-rules.ts`

**Responsabilidade:** Registrar a tool `consultar_regras_pontuacao` no `McpServer`.

**Assinatura da função exportada:**
```typescript
export function registerScoringRulesTools(server: McpServer): void
```

Notar que a função **não recebe `userId`** como parâmetro — a tool é estateless e não depende do usuário autenticado.

**Schema de entrada (Zod):** objeto vazio `{}` — a tool não aceita parâmetros.

**Descrição da tool (string passada ao `server.tool`):**
```
Retorna as regras de pontuação do Bolão ABJ: lista de eventos com pontos, regras de cumulatividade, tratamento de empate e exemplos concretos de cálculo.
```

**Conteúdo retornado (texto formatado):**

A tool deve retornar um único bloco `content: [{ type: 'text', text: ... }]` com o seguinte texto (exato, hardcoded):

```
REGRAS DE PONTUAÇÃO — BOLÃO ABJ
════════════════════════════════════════

EVENTOS E PONTOS
────────────────────────────────────────
Acerto do vencedor                   +3 pts
Placar exato                         +5 pts
Somente placar do vencedor           +3 pts
Diferença de gols correta            +2 pts
  (acertou vencedor)
Somente placar do perdedor           +1 pt
  (acertou vencedor)
Goleada                              +1 pt
  (acertou vencedor, vencedor no
   palpite fez 4+ gols e diferença
   real >= 4 gols)

PONTUAÇÃO MÁXIMA POR JOGO: 9 pts
  (acerto do vencedor +3 / placar exato
   +5 / goleada +1)

REGRAS GERAIS
────────────────────────────────────────
1. Os bônus são CUMULATIVOS com o acerto
   do vencedor — para ganhar qualquer
   bônus além dos +3 básicos, é necessário
   ter acertado o vencedor.

2. EMPATE: acerto de empate conta como
   "acerto do vencedor" (+3). Placar exato
   no empate também aplica +5.

3. Sem acerto do vencedor: 0 pontos
   (nenhum bônus se aplica).

EXEMPLOS DE CÁLCULO
────────────────────────────────────────
Resultado: BRA 3×1 ARG

  Palpite: BRA 3×1 ARG
    ✓ Acertou o vencedor         +3
    ✓ Placar exato               +5
    TOTAL: 8 pts

  Palpite: BRA 2×0 ARG
    ✓ Acertou o vencedor         +3
    ✓ Placar do vencedor (3)     +3
      (mas não exato)
    ✓ Diferença de gols (2)      +2
    TOTAL: 8 pts

  Palpite: BRA 1×0 ARG
    ✓ Acertou o vencedor         +3
    ✓ Placar do perdedor (1)     +1
    TOTAL: 4 pts

  Palpite: ARG 2×1 BRA
    ✗ Errou o vencedor
    TOTAL: 0 pts

Resultado: BRA 4×0 ARG (goleada)

  Palpite: BRA 4×0 ARG
    ✓ Acertou o vencedor         +3
    ✓ Placar exato               +5
    ✓ Goleada (4 gols, dif. 4)  +1
    TOTAL: 9 pts (máximo)

Resultado: 0×0 (empate)

  Palpite: 0×0
    ✓ Acertou o empate           +3
    ✓ Placar exato               +5
    TOTAL: 8 pts
════════════════════════════════════════
```

### Alteração em `lib/mcp/server.ts`

Adicionar o import e o registro da nova tool seguindo o padrão existente:

1. Importar: `import { registerScoringRulesTools } from '@/lib/mcp/tools/scoring-rules'`
2. Dentro de `createMcpServer`, adicionar a chamada: `registerScoringRulesTools(server)`

A chamada **não passa `userId`** (diferente de `registerGruposTools`, `registerRankingTools` e `registerPalpitesTools`), assim como `registerJogosTools(server)` não o passa.

---

## Regras de Negócio

As regras abaixo são a fonte canônica (extraídas de `CLAUDE.md`) e devem estar refletidas fielmente no texto retornado pela tool:

| Evento | Pontos | Pré-requisito |
|--------|--------|---------------|
| Acerto do vencedor | +3 | — |
| Placar exato | +5 | acertou vencedor (implícito) |
| Somente placar do vencedor | +3 | acertou vencedor |
| Diferença de gols correta | +2 | acertou vencedor |
| Somente placar do perdedor | +1 | acertou vencedor |
| Goleada | +1 | acertou vencedor + palpite do vencedor >= 4 gols + diferença real >= 4 gols |

**Cumulatividade:** todos os bônus são cumulativos entre si, desde que o vencedor tenha sido acertado.

**Empate:** acerto de empate = acerto do vencedor (+3); placar exato no empate = +5 adicional (total: +8).

**Pontuação máxima teórica:** 9 pts (vencedor +3, placar exato +5, goleada +1).

---

## Proteção de Rotas

Não aplicável. A tool não adiciona nem remove proteção ao endpoint `/api/mcp`. O endpoint continua exigindo Bearer token JWT como já implementado em `lib/mcp/server.ts`.

A tool em si não filtra por `userId` pois retorna apenas dados estáticos públicos — qualquer usuário autenticado no servidor MCP pode consultá-la.

---

## Integração Supabase Realtime

Não aplicável. A tool é completamente estática e não acessa o Supabase.

---

## Critérios de Aceite

- [ ] Arquivo `lib/mcp/tools/scoring-rules.ts` criado com a função `registerScoringRulesTools(server: McpServer): void`
- [ ] A função registra a tool com nome exato `consultar_regras_pontuacao` via `server.tool(...)`
- [ ] Schema Zod de entrada é um objeto vazio `{}` (sem parâmetros)
- [ ] A tool retorna `content: [{ type: 'text', text: <texto das regras> }]`
- [ ] O texto retornado inclui: lista de todos os 6 eventos com pontos, pontuação máxima (9 pts), regras de cumulatividade, tratamento de empate, e pelo menos 3 exemplos concretos de cálculo
- [ ] `lib/mcp/server.ts` importa `registerScoringRulesTools` e a chama em `createMcpServer` sem passar `userId`
- [ ] A tool não importa nem chama `createServiceClient` — sem acesso ao Supabase
- [ ] `npm run lint` passa sem erros novos
- [ ] `npm run build` passa sem erros novos
