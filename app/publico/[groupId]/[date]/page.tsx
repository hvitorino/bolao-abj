import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service-server'
import { isValidDateString } from '@/lib/date'
import { ParticipantEntry } from '@/lib/types/participant'
import type { ScoreBreakdown } from '@/lib/types/score'
import type { PublicDateGame, ProfileEntry } from '@/lib/types/public-date'
import PublicDateClient from './public-date-client'

export const revalidate = 0

interface PublicDatePageProps {
  params: Promise<{ groupId: string; date: string }>
}

export async function generateMetadata({ params }: PublicDatePageProps): Promise<Metadata> {
  const { date } = await params

  if (!isValidDateString(date)) {
    return { title: 'Data inválida — Bolão da Copa' }
  }

  const serviceClient = createServiceClient()
  const { data: games } = await serviceClient
    .from('games')
    .select('id')
    .eq('match_day', date)

  const count = games?.length ?? 0
  const [year, month, day] = date.split('-')
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const formatted = d.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase()

  return {
    title: `${count} JOGO${count !== 1 ? 'S' : ''} · ${formatted} — Bolão da Copa`,
    description: `Palpites e pontuação dos participantes do bolão`,
  }
}

export default async function PublicDatePage({ params }: PublicDatePageProps) {
  const { groupId, date } = await params

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

  const errorContainer = (message: string, detail?: string) => (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {header}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
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
              marginBottom: detail ? '0.75rem' : 0,
            }}
          >
            {message}
          </div>
          {detail && (
            <div style={{ color: 'var(--color-muted)', fontSize: '12px', lineHeight: 1.5 }}>
              {detail}
            </div>
          )}
        </div>
      </main>
    </div>
  )

  // Validação: groupId
  if (!groupId) {
    return errorContainer(
      '✗ PARÂMETRO DE GRUPO AUSENTE',
      'Este link está incompleto. Peça ao participante que compartilhe o link novamente usando o botão "COPIAR LINK DO DIA" na aba de Palpites.'
    )
  }

  // Validação: date
  if (!isValidDateString(date)) {
    return errorContainer(
      '✗ DATA INVÁLIDA',
      'O formato de data na URL não é válido. Use o formato YYYY-MM-DD.'
    )
  }

  const serviceClient = createServiceClient()

  // 1. Buscar jogos da data
  const { data: gamesRaw } = await serviceClient
    .from('games')
    .select('id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,round,venue,match_date')
    .eq('match_day', date)
    .order('match_date', { ascending: true })

  const games: PublicDateGame[] = (gamesRaw ?? []).map((g) => ({
    id: g.id,
    home_team: g.home_team,
    away_team: g.away_team,
    home_team_code: g.home_team_code,
    away_team_code: g.away_team_code,
    home_score: g.home_score,
    away_score: g.away_score,
    status: g.status as 'pending' | 'live' | 'finished',
    round: g.round,
    venue: g.venue,
    match_date: g.match_date,
  }))

  // 2. Buscar membros do grupo
  const { data: memberRows } = await serviceClient
    .from('group_members')
    .select('user_id, profiles(id, name)')
    .eq('group_id', groupId)

  if (!memberRows || memberRows.length === 0) {
    return errorContainer(
      '✗ GRUPO NÃO ENCONTRADO',
      'O grupo informado não existe ou não possui participantes.'
    )
  }

  const profileList = (memberRows)
    .map((row) => {
      const raw = row.profiles as unknown
      const profile = Array.isArray(raw) ? raw[0] : raw
      if (!profile || typeof profile !== 'object') return null
      const p = profile as { id: string; name: string }
      return { id: p.id, name: p.name }
    })
    .filter((p): p is { id: string; name: string } => p !== null)

  const participants: ProfileEntry[] = profileList.map((p) => ({
    userId: p.id,
    name: p.name,
  }))

  // Estado vazio: nenhum jogo nesta data
  if (games.length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg)',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        {header}
        <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
          <div
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              padding: '1.5rem',
              fontSize: '12px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            NENHUM JOGO NESTA DATA
          </div>
        </main>
      </div>
    )
  }

  const gameIds = games.map((g) => g.id)
  const pendingIds = games.filter((g) => g.status === 'pending').map((g) => g.id)
  const liveOrFinishedIds = games.filter((g) => g.status !== 'pending').map((g) => g.id)
  const finishedIds = games.filter((g) => g.status === 'finished').map((g) => g.id)

  // 3. Buscar palpites com visibilidade condicional por status
  // Para jogos pending: apenas existência (user_id, game_id)
  const hasPredictionMap: Record<string, Set<string>> = {} // gameId → Set<userId>
  const predByUserGame: Record<string, Record<string, { home_score: number; away_score: number }>> = {} // gameId → userId → pred

  // Inicializar mapas para todos os jogos
  for (const gameId of gameIds) {
    hasPredictionMap[gameId] = new Set<string>()
    predByUserGame[gameId] = {}
  }

  if (pendingIds.length > 0) {
    const { data: existencePreds } = await serviceClient
      .from('predictions')
      .select('user_id, game_id')
      .eq('group_id', groupId)
      .in('game_id', pendingIds)

    for (const p of existencePreds ?? []) {
      hasPredictionMap[p.game_id]?.add(p.user_id)
    }
  }

  if (liveOrFinishedIds.length > 0) {
    const { data: fullPreds } = await serviceClient
      .from('predictions')
      .select('user_id, game_id, home_score, away_score')
      .eq('group_id', groupId)
      .in('game_id', liveOrFinishedIds)

    for (const p of fullPreds ?? []) {
      hasPredictionMap[p.game_id]?.add(p.user_id)
      if (!predByUserGame[p.game_id]) predByUserGame[p.game_id] = {}
      predByUserGame[p.game_id][p.user_id] = {
        home_score: p.home_score,
        away_score: p.away_score,
      }
    }
  }

  // 4. Buscar scores para jogos finished
  const scoreByUserGame: Record<string, Record<string, { points: number; breakdown: ScoreBreakdown }>> = {}

  if (finishedIds.length > 0) {
    const { data: scores } = await serviceClient
      .from('scores')
      .select('user_id, game_id, points, breakdown')
      .eq('group_id', groupId)
      .in('game_id', finishedIds)

    for (const s of scores ?? []) {
      if (!scoreByUserGame[s.game_id]) scoreByUserGame[s.game_id] = {}
      scoreByUserGame[s.game_id][s.user_id] = {
        points: s.points,
        breakdown: s.breakdown,
      }
    }
  }

  // 5. Montar gameParticipants: Record<gameId, ParticipantEntry[]>
  const initialGameParticipants: Record<string, ParticipantEntry[]> = {}

  for (const game of games) {
    const predMap = predByUserGame[game.id] ?? {}
    const hasPredSet = hasPredictionMap[game.id] ?? new Set<string>()
    const scoreMap = scoreByUserGame[game.id] ?? {}

    const entries: ParticipantEntry[] = profileList.map((profile): ParticipantEntry => {
      const hasPrediction = hasPredSet.has(profile.id)
      const prediction = game.status !== 'pending' ? (predMap[profile.id] ?? null) : null
      const scoreEntry = prediction !== null && game.status === 'finished'
        ? (scoreMap[profile.id] ?? null)
        : null

      return {
        userId: profile.id,
        name: profile.name,
        prediction,
        points: scoreEntry?.points ?? null,
        breakdown: scoreEntry?.breakdown ?? null,
        hasPrediction,
      }
    })

    // Ordenar: com palpite primeiro, desempate por nome
    entries.sort((a, b) => {
      if (a.hasPrediction !== b.hasPrediction) return a.hasPrediction ? -1 : 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    initialGameParticipants[game.id] = entries
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {header}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
        <PublicDateClient
          groupId={groupId}
          date={date}
          initialGames={games}
          initialParticipants={participants}
          initialGameParticipants={initialGameParticipants}
        />
      </main>
    </div>
  )
}
