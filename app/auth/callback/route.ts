import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/jogos'

  // Valida que next é um caminho interno (evitar open redirect)
  const safeNext = next.startsWith('/') ? next : '/jogos'

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=link-invalido', request.url))
  }

  return NextResponse.redirect(new URL(safeNext, request.url))
}
