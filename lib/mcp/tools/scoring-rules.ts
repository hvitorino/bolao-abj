import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const SCORING_RULES_TEXT = `REGRAS DE PONTUAÇÃO — BOLÃO ABJ
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
════════════════════════════════════════`

export function registerScoringRulesTools(server: McpServer): void {
  server.tool(
    'consultar_regras_pontuacao',
    'Retorna as regras de pontuação do Bolão ABJ: lista de eventos com pontos, regras de cumulatividade, tratamento de empate e exemplos concretos de cálculo.',
    {},
    async () => {
      return {
        content: [{ type: 'text', text: SCORING_RULES_TEXT }],
      }
    }
  )
}
