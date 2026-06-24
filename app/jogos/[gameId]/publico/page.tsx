import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service-server'
import { ParticipantEntry } from '@/lib/types/participant'
import type { ScoreBreakdown } from '@/lib/types/score'
import PublicGameClient from '@/components/bolao/PublicGameClient'

export const revalidate = 0

interface PublicGamePageProps {
  params: Promise<{ gameId: string }>
}

export async function generateMetadata({ params }: PublicGamePageProps): Promise<Metadata> {
  const { gameId } = await params
  const serviceClient = createServiceClient()

  const { data: game } = await serviceClient
    .from('games')
    .select('home_team, away_team')
    .eq('id', gameId)
    .maybeSingle()

  if (!game) {
    return { title: 'Jogo não encontrado — Bolão da Copa' }
  }

  return {
    title: `${game.home_team} × ${game.away_team} — Bolão da Copa`,
    description: `Palpites e pontuação ao vivo`,
  }
}

export default async function PublicGamePage({ params }: PublicGamePageProps) {
  const { gameId } = await params
  const serviceClient = createServiceClient()

  // 1. Dados do jogo
  const { data: game } = await serviceClient
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, status, round, match_date, venue'
    )
    .eq('id', gameId)
    .maybeSingle()

  if (!game) {
    notFound()
  }

  // 2. Todos os perfis do sistema (página pública não tem grupo)
  const { data: profiles } = await serviceClient.from('profiles').select('id, name')

  const profileList = (profiles ?? []) as { id: string; name: string }[]

  // 3. Palpites — visibilidade dependente do status do jogo
  let predByUserGame: Record<string, { home_score: number; away_score: number }> = {}
  const hasPredictionSet = new Set<string>()

  if (game.status === 'pending') {
    // Apenas existência — sem valores reais para não vazar palpites
    const { data: existencePredictions } = await serviceClient
      .from('predictions')
      .select('user_id, game_id')
      .eq('game_id', gameId)

    for (const p of existencePredictions ?? []) {
      hasPredictionSet.add(p.user_id)
    }
  } else {
    // live ou finished — valores reais
    const { data: fullPredictions } = await serviceClient
      .from('predictions')
      .select('user_id, game_id, home_score, away_score')
      .eq('game_id', gameId)

    for (const p of fullPredictions ?? []) {
      hasPredictionSet.add(p.user_id)
      predByUserGame[p.user_id] = {
        home_score: p.home_score,
        away_score: p.away_score,
      }
    }
  }

  // 4. Scores (encerrados e ao vivo — ao vivo calculado no cliente)
  const scoreByUser: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}

  if (game.status === 'finished') {
    const { data: scores } = await serviceClient
      .from('scores')
      .select('user_id, game_id, points, breakdown')
      .eq('game_id', gameId)

    for (const s of scores ?? []) {
      scoreByUser[s.user_id] = {
        points: s.points,
        breakdown: s.breakdown,
      }
    }
  }

  // 5. Montar ParticipantEntry[] — apenas perfis que têm alguma interação com o jogo
  //    (hasPrediction=true) ou todos os perfis do sistema (para listar quem não palpitou)
  const participants: ParticipantEntry[] = profileList
    .map((profile): ParticipantEntry => {
      const key = profile.id
      const hasPrediction = hasPredictionSet.has(key)
      const prediction = predByUserGame[key] ?? null
      const scoreEntry = prediction !== null ? (scoreByUser[key] ?? null) : null

      return {
        userId: profile.id,
        name: profile.name,
        prediction: game.status === 'pending' ? null : prediction,
        points: scoreEntry?.points ?? null,
        breakdown: scoreEntry?.breakdown ?? null,
        hasPrediction,
      }
    })
    .sort((a, b) => {
      // Quem tem palpite vem antes de quem não tem
      if (a.hasPrediction !== b.hasPrediction) return a.hasPrediction ? -1 : 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Header público — sem o header do dashboard */}
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
          }}
        >
          BOLÃO DA COPA
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          VISUALIZAÇÃO PÚBLICA
        </span>
      </header>

      {/* Conteúdo principal */}
      <main
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          padding: '1rem',
        }}
      >
        <PublicGameClient
          initialGame={game}
          initialParticipants={participants}
          gameStatus={game.status as 'pending' | 'live' | 'finished'}
        />
      </main>
    </div>
  )
}
