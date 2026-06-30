import type { Metadata } from 'next'
import CartolaClient from './cartola-client'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cartola ABJ — Ao Vivo — Bolão da Copa',
  description: 'Palpites e pontuação em tempo real do grupo Cartola ABJ',
}

export default function CartolaPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      <CartolaHeader />
      <main style={{ padding: '1rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <CartolaClient />
        </div>
      </main>
    </div>
  )
}

function CartolaHeader() {
  return (
    <header
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 1rem',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
          }}
        >
          CARTOLA ABJ
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          AO VIVO · BOLAODEFUTEBOL
        </span>
      </div>
    </header>
  )
}
