import { NextRequest } from 'next/server'
import { createMcpHandler } from '@/lib/mcp/server'

export async function POST(request: NextRequest) {
  return createMcpHandler(request)
}

export async function GET(request: NextRequest) {
  return createMcpHandler(request)
}

export async function DELETE(request: NextRequest) {
  return createMcpHandler(request)
}
