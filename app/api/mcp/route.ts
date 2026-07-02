import { NextRequest } from 'next/server'
import { createMcpHandler } from '@/lib/mcp/server'

export async function POST(request: NextRequest) {
  return createMcpHandler(request)
}

export async function GET() {
  return new Response(null, { status: 405 })
}

export async function DELETE(request: NextRequest) {
  return createMcpHandler(request)
}
