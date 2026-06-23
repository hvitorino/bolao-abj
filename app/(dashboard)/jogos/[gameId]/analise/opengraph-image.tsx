import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/service-server'
import { getTeamFlag } from '@/lib/flags'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Converte emoji de bandeira para URL PNG do Twemoji CDN
function flagToUrl(teamCode: string): string {
  const emoji = getTeamFlag(teamCode)
  const codePoints = [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('-')
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoints}.png`
}

export default async function Image({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  const supabase = createServiceClient()

  const { data: game } = await supabase
    .from('games')
    .select('home_team, away_team, home_team_code, away_team_code, round')
    .eq('id', gameId)
    .maybeSingle()

  const home = game?.home_team ?? '—'
  const away = game?.away_team ?? '—'
  const round = game?.round ?? 'Copa do Mundo FIFA 2026'
  const homeFlagUrl = game?.home_team_code ? flagToUrl(game.home_team_code) : null
  const awayFlagUrl = game?.away_team_code ? flagToUrl(game.away_team_code) : null

  return new ImageResponse(
    <div
      style={{
        background: '#0a0e1a',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Faixa superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: '#009c3b', display: 'flex' }} />

      {/* Fase */}
      <div style={{ color: '#5a7a6a', fontSize: '22px', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '52px', display: 'flex' }}>
        {round}
      </div>

      {/* Confronto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '72px' }}>

        {/* Time da casa */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '380px' }}>
          {homeFlagUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={homeFlagUrl} width={96} height={96} style={{ objectFit: 'contain' }} alt="" />
          )}
          <div style={{ color: '#f0f4f8', fontSize: '44px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex' }}>
            {home}
          </div>
        </div>

        {/* Separador */}
        <div style={{ color: '#FFDF00', fontSize: '72px', fontWeight: 'bold', display: 'flex' }}>×</div>

        {/* Time visitante */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '380px' }}>
          {awayFlagUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={awayFlagUrl} width={96} height={96} style={{ objectFit: 'contain' }} alt="" />
          )}
          <div style={{ color: '#f0f4f8', fontSize: '44px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex' }}>
            {away}
          </div>
        </div>

      </div>

      {/* Rodapé */}
      <div style={{ color: '#009c3b', fontSize: '22px', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '52px', display: 'flex' }}>
        BOLÃO DA COPA
      </div>

      {/* Faixa inferior */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', background: '#009c3b', display: 'flex' }} />
    </div>,
    { ...size }
  )
}
