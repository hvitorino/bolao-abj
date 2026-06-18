import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { NextRequest } from 'next/server'
import { authenticateBearer, createServiceClient } from '@/lib/mcp/auth'
import { registerJogosTools } from '@/lib/mcp/tools/jogos'
import { registerRankingTools } from '@/lib/mcp/tools/ranking'
import { registerPalpitesTools } from '@/lib/mcp/tools/palpites'

function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'bolao-abj',
    version: '1.0.0',
  })

  registerJogosTools(server)
  registerRankingTools(server, userId)
  registerPalpitesTools(server, userId)

  return server
}

export async function createMcpHandler(request: NextRequest): Promise<Response> {
  // Autenticar Bearer token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', message: 'Autenticação requerida.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.slice(7)
  const auth = await authenticateBearer(token)

  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', message: 'Token inválido ou expirado.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { userId } = auth

  // Criar servidor MCP com tools injetadas para este usuário
  const server = createMcpServer(userId)

  // Usar transporte stateless (sem gerenciamento de sessão no servidor)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)

  try {
    const response = await transport.handleRequest(request)
    return response
  } finally {
    await server.close()
  }
}
