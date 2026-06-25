import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service-server'
import { isValidDateString } from '@/lib/date'
import { calculateLiveScore } from '@/lib/scoring'
import type { LiveGameWithPrediction, RankingParticipantDetail, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import type { ScoreBreakdown } from '@/lib/types/score'
import PublicDateClient, { type PublicMember } from './public-date-client'

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
  const formatted = d
    .toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase()

  return {
    title: `${count} JOGO${count !== 1 ? 'S' : ''} · ${formatted} — Bolão da Copa`,
    description: 'Palpites e pontuação dos participantes do bolão',
  }
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

function ErrorPage({ message, detail }: { message: string; detail?: string }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', ...MONO }}>
      <PublicHeader />
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
}

function PublicHeader() {
  return (
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
          ...MONO,
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
          ...MONO,
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
}

export default async function PublicDatePage({ params }: PublicDatePageProps) {
  const { groupId, date } = await params

  if (!groupId) {
    return (
      <ErrorPage
        message="✗ PARÂMETRO DE GRUPO AUSENTE"
        detail='Este link está incompleto. Peça ao participante que compartilhe o link usando o botão "COPIAR LINK DO DIA" na aba de Palpites.'
      />
    )
  }

  if (!isValidDateString(date)) {
    return (
      <ErrorPage
        message="✗ DATA INVÁLIDA"
        detail="O formato de data na URL não é válido. Use o formato YYYY-MM-DD."
      />
    )
  }

  const serviceClient = createServiceClient()

  // 1. Jogos da data
  const { data: gamesData } = await serviceClient
    .from('games')
    .select(
      'id,home_team,away_team,home_team_code,away_team_code,home_score,away_score,status,match_date'
    )
    .eq('match_day', date)
    .order('match_date', { ascending: true })

  const gamesRaw = gamesData ?? []

  // 2. Membros do grupo
  const { data: memberRows } = await serviceClient
    .from('group_members')
    .select('user_id, profiles(id, name)')
    .eq('group_id', groupId)

  if (!memberRows || memberRows.length === 0) {
    return (
      <ErrorPage
        message="✗ GRUPO NÃO ENCONTRADO"
        detail="O grupo informado não existe ou não possui participantes."
      />
    )
  }

  const members: PublicMember[] = (memberRows)
    .map((row) => {
      const raw = row.profiles as unknown
      const profile = Array.isArray(raw) ? raw[0] : raw
      if (!profile || typeof profile !== 'object') return null
      const p = profile as { id: string; name: string }
      return { id: p.id, name: p.name }
    })
    .filter((m): m is PublicMember => m !== null)

  if (gamesRaw.length === 0) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', ...MONO }}>
        <PublicHeader />
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

  const liveOrFinishedIds = gamesRaw.filter((g) => g.status !== 'pending').map((g) => g.id)
  const finishedIds = gamesRaw.filter((g) => g.status === 'finished').map((g) => g.id)

  // 3. Palpites (apenas jogos não-pending para não revelar antes do início)
  const predByUserGame: Record<
    string,
    Record<string, { home_score: number; away_score: number }>
  > = {}
  if (liveOrFinishedIds.length > 0) {
    const { data: predsData } = await serviceClient
      .from('predictions')
      .select('user_id,game_id,home_score,away_score')
      .eq('group_id', groupId)
      .in('game_id', liveOrFinishedIds)
    for (const p of predsData ?? []) {
      if (!predByUserGame[p.user_id]) predByUserGame[p.user_id] = {}
      predByUserGame[p.user_id][p.game_id] = {
        home_score: p.home_score,
        away_score: p.away_score,
      }
    }
  }

  // 4. Scores (jogos finalizados)
  const scoreByUserGame: Record<
    string,
    Record<string, { points: number; breakdown: ScoreBreakdown }>
  > = {}
  if (finishedIds.length > 0) {
    const { data: scoresData } = await serviceClient
      .from('scores')
      .select('user_id,game_id,points,breakdown')
      .eq('group_id', groupId)
      .in('game_id', finishedIds)
    for (const s of scoresData ?? []) {
      if (!scoreByUserGame[s.user_id]) scoreByUserGame[s.user_id] = {}
      scoreByUserGame[s.user_id][s.game_id] = {
        points: s.points,
        breakdown: s.breakdown as ScoreBreakdown,
      }
    }
  }

  // 5. Construir initialGames (sem myPrediction — página pública não tem usuário logado)
  const initialGames: LiveGameWithPrediction[] = gamesRaw.map((g) => ({
    id: g.id,
    home_team: g.home_team,
    away_team: g.away_team,
    home_team_code: g.home_team_code,
    away_team_code: g.away_team_code,
    home_score: g.home_score,
    away_score: g.away_score,
    status: g.status as 'pending' | 'live' | 'finished',
    match_date: g.match_date,
    myPrediction: null,
  }))

  // 6. Construir initialRanking com pontos do dia
  const todayPointsByUser: Record<string, number> = {}
  const hasLiveByUser: Record<string, boolean> = {}

  for (const userId of members.map((m) => m.id)) {
    const userScores = scoreByUserGame[userId] ?? {}
    for (const s of Object.values(userScores)) {
      todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + s.points
    }
  }

  const liveGames = gamesRaw.filter((g) => g.status === 'live')
  for (const userId of members.map((m) => m.id)) {
    const userPreds = predByUserGame[userId] ?? {}
    for (const game of liveGames) {
      const pred = userPreds[game.id]
      if (!pred) continue
      const result = calculateLiveScore(
        { home_score: game.home_score, away_score: game.away_score },
        { home_score: pred.home_score, away_score: pred.away_score }
      )
      if (result && result.points > 0) {
        todayPointsByUser[userId] = (todayPointsByUser[userId] ?? 0) + result.points
        hasLiveByUser[userId] = true
      }
    }
  }

  const ranked = members
    .map((m) => ({
      ...m,
      total_points: todayPointsByUser[m.id] ?? 0,
      hasLivePoints: hasLiveByUser[m.id] ?? false,
    }))
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return a.name.localeCompare(b.name, 'pt-BR')
    })

  let prevPoints: number | null = null
  let prevRank = 0

  const initialRanking: RankingParticipantDetail[] = ranked.map((item, index) => {
    const rank_position =
      prevPoints !== null && item.total_points === prevPoints ? prevRank : index + 1
    prevRank = rank_position
    prevPoints = item.total_points

    const userPreds = predByUserGame[item.id] ?? {}
    const userScores = scoreByUserGame[item.id] ?? {}

    const userGames: GameScoreEntry[] = gamesRaw.map((g) => {
      const pred = g.status !== 'pending' ? (userPreds[g.id] ?? null) : null
      const score = userScores[g.id] ?? null

      let livePoints: number | null = null
      if (g.status === 'live' && pred) {
        const result = calculateLiveScore(
          { home_score: g.home_score, away_score: g.away_score },
          { home_score: pred.home_score, away_score: pred.away_score }
        )
        livePoints = result?.points ?? null
      }

      return {
        gameId: g.id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_team_code: g.home_team_code,
        away_team_code: g.away_team_code,
        home_score: g.home_score,
        away_score: g.away_score,
        status: g.status as 'pending' | 'live' | 'finished',
        match_date: g.match_date,
        userPrediction: pred,
        officialPoints: score?.points ?? null,
        officialBreakdown: score?.breakdown ?? null,
        livePoints,
      }
    })

    return {
      userId: item.id,
      name: item.name,
      rank_position,
      total_points: item.total_points,
      hasLivePoints: item.hasLivePoints,
      games: userGames,
    }
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', ...MONO }}>
      <PublicHeader />
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
        <PublicDateClient
          groupId={groupId}
          date={date}
          initialGames={initialGames}
          initialRanking={initialRanking}
          members={members}
        />
      </main>
    </div>
  )
}
