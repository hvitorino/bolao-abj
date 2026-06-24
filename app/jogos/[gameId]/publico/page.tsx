import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service-server'
import { ParticipantEntry } from '@/lib/types/participant'
import type { ScoreBreakdown } from '@/lib/types/score'
import PublicGameClient from '@/components/bolao/PublicGameClient'

export const revalidate = 0

interface PublicGamePageProps {
  params: Promise<{ gameId: string }>
  searchParams: Promise<{ grupo?: string }>
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

export default async function PublicGamePage({ params, searchParams }: PublicGamePageProps) {
  const { gameId } = await params
  const { grupo: groupId } = await searchParams

  // Header público — aparece sempre, inclusive no estado de erro
  const header = (
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
  )

  // Erro: grupo ausente na URL — nenhum dado de palpite ou perfil é consultado
  if (!groupId) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg)',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        {header}
        <main
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            padding: '1rem',
          }}
        >
          <div
            style={{
              border: '1px solid var(--color-error)',
              backgroundColor: 'var(--color-surface)',
              padding: '1.5rem',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                color: 'var(--color-error)',
                textTransform: 'uppercase',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                marginBottom: '0.75rem',
              }}
            >
              ✗ PARÂMETRO DE GRUPO AUSENTE
            </div>
            <div
              style={{
                color: 'var(--color-muted)',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              Este link está incompleto. Peça ao participante que compartilhe o link novamente
              usando o botão &quot;COPIAR LINK&quot; do jogo.
            </div>
          </div>
        </main>
      </div>
    )
  }

  const serviceClient = createServiceClient()

  // 1. Dados do jogo
  const { data: game } = await serviceClient
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle()

  if (!game) {
    notFound()
  }

  // 2. Perfis — apenas membros do grupo informado na URL
  const { data: memberRows } = await serviceClient
    .from('group_members')
    .select('user_id, profiles(id, name)')
    .eq('group_id', groupId)

  const profileList = (memberRows ?? [])
    .map((row) => {
      // O Supabase infere profiles como array em joins — normalizamos para objeto único
      const raw = row.profiles as unknown
      const profile = Array.isArray(raw) ? raw[0] : raw
      if (!profile || typeof profile !== 'object') return null
      const p = profile as { id: string; name: string }
      return { id: p.id, name: p.name }
    })
    .filter((p): p is { id: string; name: string } => p !== null)

  // 3. Palpites — visibilidade dependente do status do jogo, filtrado por group_id
  const predByUserGame: Record<string, { home_score: number; away_score: number }> = {}
  const hasPredictionSet = new Set<string>()

  if (game.status === 'pending') {
    // Apenas existência — sem valores reais para não vazar palpites
    const { data: existencePredictions } = await serviceClient
      .from('predictions')
      .select('user_id, game_id')
      .eq('game_id', gameId)
      .eq('group_id', groupId)

    for (const p of existencePredictions ?? []) {
      hasPredictionSet.add(p.user_id)
    }
  } else {
    // live ou finished — valores reais
    const { data: fullPredictions } = await serviceClient
      .from('predictions')
      .select('user_id, game_id, home_score, away_score')
      .eq('game_id', gameId)
      .eq('group_id', groupId)

    for (const p of fullPredictions ?? []) {
      hasPredictionSet.add(p.user_id)
      predByUserGame[p.user_id] = {
        home_score: p.home_score,
        away_score: p.away_score,
      }
    }
  }

  // 4. Scores (encerrados e ao vivo — ao vivo calculado no cliente), filtrado por group_id
  const scoreByUser: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}

  if (game.status === 'finished') {
    const { data: scores } = await serviceClient
      .from('scores')
      .select('user_id, game_id, points, breakdown')
      .eq('game_id', gameId)
      .eq('group_id', groupId)

    for (const s of scores ?? []) {
      scoreByUser[s.user_id] = {
        points: s.points,
        breakdown: s.breakdown,
      }
    }
  }

  // 5. Montar ParticipantEntry[] — apenas membros do grupo
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
      {header}

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
          groupId={groupId}
        />
      </main>
    </div>
  )
}
