import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ xid: string }> }
) {
  const { xid } = await params
  return NextResponse.json({ xid, ok: true })
}
