import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createServiceClient, resolveGroupForMcp, validateGroupMembership } from '@/lib/mcp/auth'

const MAX_POINTS_PER_GAME = 9

function calcAproveitamento(totalPoints: number, gamesPredicted: number): number {
  if (!gamesPredicted) return 0
  return Math.round((totalPoints / (gamesPredicted * MAX_POINTS_PER_GAME)) * 100)
}

export function registerRankingTools(server: McpServer, userId: string) {
  server.tool(
    'ver_ranking',
    'Exibe o ranking completo do bolão para o grupo ativo do participante.',
    {
      group_id: z
        .string()
        .uuid()
        .optional()
        .describe('ID do grupo (UUID). Se omitido, usa o primeiro grupo por data de entrada.'),
    },
    async ({ group_id }) => {
      const db = createServiceClient()

      let groupId: string | null

      if (group_id) {
        const { valid, errorMessage } = await validateGroupMembership(db, userId, group_id)
        if (!valid) {
          return { content: [{ type: 'text', text: errorMessage! }] }
        }
        groupId = group_id
      } else {
        groupId = await resolveGroupForMcp(db, userId)
        if (!groupId) {
          return {
            content: [
              {
                type: 'text',
                text: 'Você não pertence a nenhum grupo ativo no bolão.',
              },
            ],
          }
        }
      }

      const { data, error } = await db.rpc('get_ranking', { p_group_id: groupId })

      if (error) {
        return {
          content: [{ type: 'text', text: 'Erro ao buscar ranking. Tente novamente.' }],
        }
      }

      if (!data || data.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nenhum participante encontrado no ranking.' }],
        }
      }

      type RankEntry = {
        rank_position: number
        user_id: string
        participant_name: string
        total_points: number
        games_predicted: number
      }

      const entries = (data as RankEntry[]).map((entry) => ({
        rank: entry.rank_position,
        userId: entry.user_id,
        name: entry.participant_name,
        points: Number(entry.total_points),
        gamesPredicted: Number(entry.games_predicted),
        aproveitamento: calcAproveitamento(
          Number(entry.total_points),
          Number(entry.games_predicted)
        ),
      }))

      const lines: string[] = [
        'RANKING — BOLÃO ABJ',
        '──────────────────────────────────────',
      ]

      entries.forEach((entry) => {
        const isMe = entry.userId === userId
        const meStr = isMe ? ' ◄ você' : ''
        const nameCol = entry.name.toUpperCase().padEnd(20)
        const ptsCol = String(entry.points).padStart(3)
        const aprovCol = String(entry.aproveitamento).padStart(3)
        lines.push(`#${entry.rank}  ${nameCol}  ${ptsCol} pts  ${aprovCol}%${meStr}`)
      })

      lines.push('──────────────────────────────────────')

      const myEntry = entries.find((e) => e.userId === userId)
      if (myEntry) {
        lines.push(`(você está em #${myEntry.rank})`)
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    }
  )
}
