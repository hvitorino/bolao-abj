import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createServiceClient } from '@/lib/mcp/auth'

type GroupRow = {
  group_id: string
  role: string
  joined_at: string
  groups: { name: string } | { name: string }[]
}

export function registerGruposTools(server: McpServer, userId: string) {
  server.tool(
    'listar_grupos',
    'Lista os grupos (bolões) dos quais o participante autenticado faz parte, com id, nome e papel (admin/membro).',
    {},
    async () => {
      const db = createServiceClient()

      const { data, error } = await db
        .from('group_members')
        .select('group_id, role, joined_at, groups!inner(name)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })

      if (error) {
        return {
          content: [{ type: 'text', text: 'Erro ao buscar grupos. Tente novamente.' }],
        }
      }

      const rows = (data ?? []) as unknown as GroupRow[]

      if (rows.length === 0) {
        return {
          content: [{ type: 'text', text: 'Você não pertence a nenhum grupo no bolão.' }],
        }
      }

      const lines: string[] = [`Seus grupos (${rows.length}):`, '']

      rows.forEach((row, index) => {
        const groupData = Array.isArray(row.groups) ? row.groups[0] : row.groups
        const name = groupData?.name?.toUpperCase() ?? 'SEM NOME'
        const role = row.role === 'admin' ? 'ADMIN' : 'MEMBRO'
        const date = new Date(row.joined_at).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'America/Sao_Paulo',
        })

        lines.push(`${index + 1}. ${name}`)
        lines.push(`   ID: ${row.group_id}`)
        lines.push(`   Papel: ${role}`)
        lines.push(`   Desde: ${date}`)
        lines.push('')
      })

      lines.push('(* o primeiro grupo é usado como padrão quando group_id não é informado)')

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    }
  )
}
