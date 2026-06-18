import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createServiceClient } from '@/lib/mcp/auth'
import { dayBoundsInUTC } from '@/lib/date'

function formatStatus(status: string): string {
  if (status === 'live') return 'AO VIVO'
  if (status === 'finished') return 'ENCERRADO'
  return 'PENDENTE'
}

function formatMatchDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function registerJogosTools(server: McpServer) {
  server.tool(
    'listar_jogos',
    'Lista jogos da Copa do Mundo, com filtros opcionais por data, status ou rodada.',
    {
      data: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Data no formato YYYY-MM-DD (opcional)'),
      status: z
        .enum(['pending', 'live', 'finished'])
        .optional()
        .describe('Filtro por status do jogo (opcional)'),
      rodada: z
        .string()
        .optional()
        .describe('Filtro por rodada, ex: "Grupo A", "Oitavas" (opcional)'),
    },
    async ({ data, status, rodada }) => {
      const db = createServiceClient()
      let query = db
        .from('games')
        .select(
          'id,home_team,away_team,home_team_code,away_team_code,match_date,home_score,away_score,status,round,venue'
        )
        .order('match_date', { ascending: true })

      if (data) {
        const { start, end } = dayBoundsInUTC(data)
        query = query.gte('match_date', start).lte('match_date', end)
      }
      if (status) query = query.eq('status', status)
      if (rodada) query = query.eq('round', rodada)

      const { data: games, error } = await query

      if (error) {
        return {
          content: [{ type: 'text', text: 'Erro ao buscar jogos. Tente novamente.' }],
        }
      }

      if (!games || games.length === 0) {
        return {
          content: [
            { type: 'text', text: 'Nenhum jogo encontrado com os filtros informados.' },
          ],
        }
      }

      const lines: string[] = [`Jogos encontrados: ${games.length}`, '']
      games.forEach((game, idx) => {
        const scoreStr =
          game.status !== 'pending' && game.home_score != null && game.away_score != null
            ? ` (${game.home_score}×${game.away_score})`
            : ''
        lines.push(
          `${idx + 1}. ${game.home_team_code} × ${game.away_team_code} — ${formatMatchDate(game.match_date)} (${game.round}) — ${formatStatus(game.status)}${scoreStr}`
        )
        if (game.venue) lines.push(`   Venue: ${game.venue}`)
        lines.push(`   ID: ${game.id}`)
        lines.push('')
      })

      return {
        content: [{ type: 'text', text: lines.join('\n').trimEnd() }],
      }
    }
  )

  server.tool(
    'ver_jogo',
    'Exibe detalhes completos de um jogo específico pelo ID.',
    {
      game_id: z.string().uuid().describe('ID do jogo (UUID)'),
    },
    async ({ game_id }) => {
      const db = createServiceClient()
      const { data: game, error } = await db
        .from('games')
        .select('*')
        .eq('id', game_id)
        .maybeSingle()

      if (error || !game) {
        return {
          content: [{ type: 'text', text: 'Jogo não encontrado.' }],
        }
      }

      const scoreStr =
        game.status !== 'pending' && game.home_score != null && game.away_score != null
          ? `${game.home_score} × ${game.away_score}`
          : 'Aguardando início'

      const lines = [
        `${game.home_team} × ${game.away_team}`,
        `──────────────────────────────────────`,
        `Rodada:   ${game.round}`,
        `Data:     ${formatMatchDate(game.match_date)}`,
        `Status:   ${formatStatus(game.status)}`,
        `Placar:   ${scoreStr}`,
        `Venue:    ${game.venue ?? 'N/D'}`,
        `ID:       ${game.id}`,
      ]

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    }
  )
}
