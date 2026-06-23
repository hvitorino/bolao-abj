import { NextRequest, NextResponse } from 'next/server'

const CRAWLER_RE =
  /whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|googlebot|bingbot/i

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  if (!CRAWLER_RE.test(ua)) return NextResponse.next()

  // Sinaliza para layouts e pages que é um crawler, para não redirecionar
  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-crawler', '1')
  return NextResponse.next({ request: { headers: reqHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}
