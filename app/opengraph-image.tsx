import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
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
        gap: '0',
        border: '12px solid #1a4a2e',
      }}
    >
      {/* Faixa superior verde */}
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

      <div
        style={{
          color: '#FFDF00',
          fontSize: '88px',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'flex',
        }}
      >
        BOLÃO DA COPA
      </div>

      <div
        style={{
          color: '#009c3b',
          fontSize: '36px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '16px',
          display: 'flex',
        }}
      >
        COPA DO MUNDO FIFA 2026
      </div>

      {/* Faixa inferior verde */}
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
