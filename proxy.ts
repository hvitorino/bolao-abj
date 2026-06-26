import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const authRoutes = ['/login', '/cadastro', '/esqueci-senha', '/nova-senha', '/auth/callback']
const publicPrefixes = ['/publico/']
// Rotas individuais de jogo (ex: /jogos/{uuid}/publico) acessíveis sem autenticação
const PUBLIC_GAME_RE = /^\/jogos\/[^/]+\/publico$/

const CRAWLER_RE =
  /whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|googlebot|bingbot/i

export async function proxy(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  const isCrawler = CRAWLER_RE.test(ua)

  // Crawlers sociais: injeta header e passa sem verificar auth (para generateMetadata funcionar)
  if (isCrawler) {
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('x-crawler', '1')
    return NextResponse.next({ request: { headers: reqHeaders } })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Renova a sessão — IMPORTANTE: não adicionar código entre createServerClient e getUser
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = authRoutes.includes(pathname)
  const isPublicRoute = isAuthRoute || publicPrefixes.some((prefix) => pathname.startsWith(prefix)) || PUBLIC_GAME_RE.test(pathname)

  // Usuário não autenticado tentando acessar rota protegida
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Usuário autenticado tentando acessar login ou cadastro
  if (user && isAuthRoute) {
    const jogosUrl = request.nextUrl.clone()
    jogosUrl.pathname = '/jogos'
    return NextResponse.redirect(jogosUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
