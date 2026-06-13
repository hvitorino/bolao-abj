import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RankingTable } from '@/components/bolao/RankingTable'

export const metadata = {
  title: 'Ranking — Bolão do Cartola ABJ',
}

export default async function RankingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Título da página */}
      <div>
        <h1
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '18px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          RANKING GERAL
        </h1>
        <div
          style={{
            borderBottom: '1px solid var(--color-border)',
            marginTop: '0.5rem',
            marginBottom: '0.25rem',
          }}
        />
        <p
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '12px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          Classificação ao vivo · atualiza em tempo real
        </p>
      </div>

      {/* Tabela de ranking */}
      <RankingTable currentUserId={user.id} />
    </div>
  )
}
