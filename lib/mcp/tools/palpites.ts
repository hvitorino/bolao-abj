import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createServiceClient, resolveGroupForMcp } from '@/lib/mcp/auth'

function formatMatchDateShort(isoString: string): string {
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

function formatStatus(status: string): string {
  if (status === 'live') return 'AO VIVO'
  if (status === 'finished') return 'ENCERRADO'
  return 'PENDENTE'
}

export function registerPalpitesTools(server: McpServer, userId: string) {
  // Tool: meus_palpites
  server.tool(
    'meus_palpites',
    'Lista os palpites do participante autenticado, com pontuação quando disponível.',
    {
      status: z
        .enum(['pending', 'live', 'finished'])
        .optional()
        .describe('Filtrar por status do jogo (opcional)'),
    },
    async ({ status }) => {
      const db = createServiceClient()
      const groupId = await resolveGroupForMcp(db, userId)

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

      type PredictionRow = {
        id: string
        home_score: number
        away_score: number
        submitted_at: string
        games: {
          id: string
          home_team: string
          away_team: string
          home_team_code: string
          away_team_code: string
          match_date: string
          status: string
          round: string
          home_score: number | null
          away_score: number | null
        }
        scores: { points: number; breakdown: Record<string, number> }[]
      }

      let query = db
        .from('predictions')
        .select(
          `id, home_score, away_score, submitted_at,
          games!inner(id, home_team, away_team, home_team_code, away_team_code, match_date, status, round, home_score, away_score),
          scores(points, breakdown)`
        )
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .order('match_date', { ascending: true, referencedTable: 'games' })

      if (status) {
        query = query.eq('games.status', status)
      }

      const { data, error } = await query

      if (error) {
        return {
          content: [{ type: 'text', text: 'Erro ao buscar palpites. Tente novamente.' }],
        }
      }

      const predictions = (data ?? []) as unknown as PredictionRow[]

      if (predictions.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nenhum palpite encontrado.' }],
        }
      }

      const lines: string[] = [`Meus palpites (${predictions.length} jogos)`, '']

      for (const pred of predictions) {
        const game = pred.games
        const score = pred.scores?.[0]

        const gameStatus = formatStatus(game.status)
        const dateStr = formatMatchDateShort(game.match_date)

        lines.push(`${game.home_team_code} × ${game.away_team_code} — ${dateStr} — ${gameStatus}`)
        lines.push(`  Palpite: ${pred.home_score} × ${pred.away_score}`)

        if (game.status !== 'pending' && game.home_score != null && game.away_score != null) {
          const resultStr = `${game.home_score} × ${game.away_score}`
          const ptsStr = score ? `+${score.points} pts` : '0 pts'
          lines.push(`  Resultado: ${resultStr}   |   ${ptsStr}`)
        } else {
          lines.push(`  Aguardando início`)
        }
        lines.push('')
      }

      return {
        content: [{ type: 'text', text: lines.join('\n').trimEnd() }],
      }
    }
  )

  // Tool: ver_palpites_jogo
  server.tool(
    'ver_palpites_jogo',
    'Exibe os palpites de todos os participantes em um jogo específico. Disponível apenas após o início da partida.',
    {
      game_id: z.string().uuid().describe('ID do jogo (UUID)'),
    },
    async ({ game_id }) => {
      const db = createServiceClient()

      const { data: game, error: gameError } = await db
        .from('games')
        .select('id,status,home_team,away_team,home_score,away_score')
        .eq('id', game_id)
        .maybeSingle()

      if (gameError || !game) {
        return {
          content: [{ type: 'text', text: 'Jogo não encontrado.' }],
        }
      }

      if (game.status === 'pending') {
        return {
          content: [
            {
              type: 'text',
              text: 'Os palpites deste jogo só são revelados após o início da partida.',
            },
          ],
        }
      }

      const groupId = await resolveGroupForMcp(db, userId)

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

      type PredRow = {
        user_id: string
        home_score: number
        away_score: number
        profiles: { name: string } | { name: string }[]
        scores: { points: number }[]
      }

      const { data: predictions, error } = await db
        .from('predictions')
        .select(
          `user_id, home_score, away_score,
          profiles!inner(name),
          scores(points)`
        )
        .eq('game_id', game_id)
        .eq('group_id', groupId)

      if (error) {
        return {
          content: [{ type: 'text', text: 'Erro ao buscar palpites. Tente novamente.' }],
        }
      }

      const preds = (predictions ?? []) as PredRow[]

      if (preds.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nenhum palpite registrado para este jogo.' }],
        }
      }

      const resultStr =
        game.home_score != null && game.away_score != null
          ? `${game.home_score}×${game.away_score}`
          : 'AO VIVO'

      const lines: string[] = [
        `Palpites — ${game.home_team} × ${game.away_team} (${formatStatus(game.status)}: ${resultStr})`,
        '',
      ]

      for (const pred of preds) {
        const profile = Array.isArray(pred.profiles) ? pred.profiles[0] : pred.profiles
        const name = (profile?.name ?? 'Participante').toUpperCase().padEnd(18)
        const score = pred.scores?.[0]
        const ptsStr = score ? `+${score.points} pts` : '— pts'
        const meStr = pred.user_id === userId ? ' ◄ você' : ''
        lines.push(`${name}  ${pred.home_score} × ${pred.away_score}   ${ptsStr}${meStr}`)
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    }
  )

  // Tool: fazer_palpite
  server.tool(
    'fazer_palpite',
    'Registra ou atualiza o palpite do participante em um jogo. Só é possível até 5 minutos antes do início.',
    {
      game_id: z.string().uuid().describe('ID do jogo (UUID)'),
      home_score: z.number().int().min(0).describe('Placar do time da casa (>= 0)'),
      away_score: z.number().int().min(0).describe('Placar do time visitante (>= 0)'),
    },
    async ({ game_id, home_score, away_score }) => {
      const db = createServiceClient()
      const groupId = await resolveGroupForMcp(db, userId)

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

      // Buscar jogo
      const { data: game, error: gameError } = await db
        .from('games')
        .select('id,match_date,status,home_team,away_team,home_team_code,away_team_code')
        .eq('id', game_id)
        .maybeSingle()

      if (gameError || !game) {
        return {
          content: [{ type: 'text', text: 'Jogo não encontrado.' }],
        }
      }

      // Checar deadline (5 minutos antes do início)
      const deadline = new Date(new Date(game.match_date).getTime() - 5 * 60 * 1000)
      if (new Date() >= deadline || game.status !== 'pending') {
        return {
          content: [
            {
              type: 'text',
              text: 'Prazo encerrado — faltam menos de 5 minutos para o início do jogo.',
            },
          ],
        }
      }

      // Verificar membership
      const { data: membership } = await db
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!membership) {
        return {
          content: [
            {
              type: 'text',
              text: 'Você não pertence a nenhum grupo ativo no bolão.',
            },
          ],
        }
      }

      // Upsert do palpite
      const { error: upsertError } = await db
        .from('predictions')
        .upsert(
          {
            user_id: userId,
            game_id,
            group_id: groupId,
            home_score,
            away_score,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,game_id,group_id' }
        )
        .select()
        .single()

      if (upsertError) {
        return {
          content: [{ type: 'text', text: 'Erro ao registrar palpite. Tente novamente.' }],
        }
      }

      const deadlineStr = formatMatchDateShort(deadline.toISOString())
      const lines = [
        'Palpite registrado com sucesso!',
        '',
        `${game.home_team} × ${game.away_team} — ${formatMatchDateShort(game.match_date)}`,
        `Seu palpite: ${home_score} × ${away_score}`,
        `Deadline: ${deadlineStr}`,
        '',
        'Boa sorte!',
      ]

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    }
  )
}
