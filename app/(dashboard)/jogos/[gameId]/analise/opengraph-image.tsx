import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/service-server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  const supabase = createServiceClient()

  const { data: game } = await supabase
    .from('games')
    .select('home_team, away_team, round')
    .eq('id', gameId)
    .maybeSingle()

  const home = game?.home_team ?? '—'
  const away = game?.away_team ?? '—'
  const round = game?.round ?? 'Copa do Mundo FIFA 2026'

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
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: '#009c3b',
          display: 'flex',
        }}
      />

      {/* Fase / rodada */}
      <div
        style={{
          color: '#5a7a6a',
          fontSize: '24px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          marginBottom: '48px',
          display: 'flex',
        }}
      >
        {round}
      </div>

      {/* Confronto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '64px',
        }}
      >
        <div
          style={{
            color: '#f0f4f8',
            fontSize: '72px',
            fontWeight: 'bold',
            textAlign: 'right',
            maxWidth: '420px',
            display: 'flex',
          }}
        >
          {home}
        </div>

        <div
          style={{
            color: '#FFDF00',
            fontSize: '80px',
            fontWeight: 'bold',
            display: 'flex',
          }}
        >
          ×
        </div>

        <div
          style={{
            color: '#f0f4f8',
            fontSize: '72px',
            fontWeight: 'bold',
            maxWidth: '420px',
            display: 'flex',
          }}
        >
          {away}
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          color: '#009c3b',
          fontSize: '24px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '56px',
          display: 'flex',
        }}
      >
        BOLÃO DA COPA
      </div>

      {/* Faixa inferior */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: '#009c3b',
          display: 'flex',
        }}
      />
    </div>,
    { ...size }
  )
}
