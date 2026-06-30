import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service-server'
import { resolveActiveGroup } from '@/lib/active-group'
import MatchupStatsCard from '@/components/bolao/MatchupStatsCard'
import RecentGamesSection from '@/components/bolao/RecentGamesSection'
import GameCard from '@/components/games/GameCard'
import BackButton from '@/components/bolao/BackButton'
import NextGameLink from '@/components/bolao/NextGameLink'
import AnaliseSwipeNav from '@/components/bolao/AnaliseSwipeNav'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import type { ScoreBreakdown } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import { GameRow, calculateTeamStats, getRecentGames } from '@/lib/analytics/team-stats'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('home_team, away_team')
    .eq('id', gameId)
    .maybeSingle()
  return {
    title: data ? `${data.home_team} × ${data.away_team} — Bolão da Copa` : 'Análise — Bolão da Copa',
  }
}

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface PageProps {
  params: Promise<{ gameId: string }>
}

export default async function AnalisePage({ params }: PageProps) {
  const { gameId } = await params

  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    const isCrawler = (await headers()).get('x-crawler') === '1'
    if (!isCrawler) redirect('/login')
    // Crawler: body vazio — generateMetadata já colocou o título no <head>
    return <div />
  }

  // Verificar autorização do grupo (mesma lógica da página /jogos)
  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value

  const activeGroup = await resolveActiveGroup(
    supabase,
    authUser.id,
    undefined,
    '/jogos',
    {},
    cookieGroupId
  )

  if ('error' in activeGroup) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          border: '1px solid var(--color-error)',
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--color-error)',
          fontSize: '13px',
        }}
      >
        ✗ VOCÊ NÃO PARTICIPA DESTE GRUPO
      </div>
    )
  }

  // Query 1: buscar o jogo específico
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round'
    )
    .eq('id', gameId)
    .single()

  if (gameError || !game) {
    notFound()
  }

  // Query 2: buscar todos os jogos dos dois times na Copa 2026
  const { data: allTeamGames } = await supabase
    .from('games')
    .select(
      'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date, match_day, status, round'
    )
    .or(
      `home_team_code.eq.${game.home_team_code},away_team_code.eq.${game.home_team_code},home_team_code.eq.${game.away_team_code},away_team_code.eq.${game.away_team_code}`
    )
    .order('match_date', { ascending: true })

  const games: GameRow[] = allTeamGames ?? []

  const supabaseService = createServiceClient()
  const activeGroupId = activeGroup.groupId

  // Queries paralelas: palpite do usuário, score, membros, todos os palpites, existência, próximo jogo
  const [
    { data: existingPrediction },
    { data: myScore },
    { data: groupMembers },
    { data: allPredictions },
    { data: allScores },
    { data: predictionExistence },
    { data: nextGame },
    { data: prevGame },
  ] = await Promise.all([
    supabase
      .from('predictions')
      .select('id, user_id, game_id, home_score, away_score, submitted_at')
      .eq('game_id', gameId)
      .eq('user_id', authUser.id)
      .eq('group_id', activeGroupId)
      .maybeSingle(),

    supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', authUser.id)
      .eq('group_id', activeGroupId)
      .maybeSingle(),

    supabase
      .from('group_members')
      .select('user_id, profiles(id, name)')
      .eq('group_id', activeGroupId),

    supabase
      .from('predictions')
      .select('id, game_id, user_id, home_score, away_score, submitted_at')
      .eq('group_id', activeGroupId)
      .eq('game_id', gameId),

    supabase
      .from('scores')
      .select('*')
      .eq('group_id', activeGroupId)
      .eq('game_id', gameId),

    supabaseService
      .from('predictions')
      .select('user_id, game_id')
      .eq('group_id', activeGroupId)
      .eq('game_id', gameId),

    supabase
      .from('games')
      .select('id')
      .gt('match_date', game.match_date)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('games')
      .select('id')
      .lt('match_date', game.match_date)
      .order('match_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const initialPrediction: Prediction | null = existingPrediction ?? null
  const initialScore: Score | null = myScore ?? null

  // Montar participants
  type GroupMemberRow = {
    user_id: string
    profiles: { id: string; name: string } | { id: string; name: string }[] | null
  }
  const memberProfiles = ((groupMembers ?? []) as GroupMemberRow[])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return profile ? { id: profile.id, name: profile.name } : null
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const predByUser: Record<string, { id: string; home_score: number; away_score: number }> = {}
  for (const p of allPredictions ?? []) {
    predByUser[p.user_id] = { id: p.id, home_score: p.home_score, away_score: p.away_score }
  }
  const scoreByUser: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}
  for (const s of (allScores ?? []) as Score[]) {
    scoreByUser[s.user_id] = { points: s.points, breakdown: s.breakdown }
  }
  const hasPredictionSet = new Set<string>(
    (predictionExistence ?? []).map((r) => r.user_id)
  )

  const participants: ParticipantEntry[] = memberProfiles.map((profile) => {
    const prediction = predByUser[profile.id] ?? null
    const scoreEntry = prediction !== null ? (scoreByUser[profile.id] ?? null) : null
    return {
      userId: profile.id,
      name: profile.name,
      prediction,
      points: scoreEntry?.points ?? null,
      breakdown: scoreEntry?.breakdown ?? null,
      hasPrediction: hasPredictionSet.has(profile.id),
    }
  })

  // Calcular stats em memória
  const homeStats = calculateTeamStats(games, game.home_team_code, game.match_date)
  const awayStats = calculateTeamStats(games, game.away_team_code, game.match_date)

  // Calcular jogos anteriores por time
  const homeRecentGames = getRecentGames(games, game.home_team_code, game.match_date)
  const awayRecentGames = getRecentGames(games, game.away_team_code, game.match_date)

  // URL de volta para o dia do jogo
  const backDate = game.match_day ?? game.match_date?.slice(0, 10)
  const backUrl = backDate ? `/jogos?date=${backDate}` : '/jogos'

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* GameCard completo — palpite, edição, VER PALPITES, realtime */}
      <div style={{ marginBottom: '1rem' }}>
        <GameCard
          game={game as unknown as Game}
          prediction={initialPrediction}
          score={initialScore}
          participants={participants}
          userId={authUser.id}
          groupId={activeGroupId}
          hideAnalysisLink
        />
      </div>

      {/* Card de estatísticas comparativas */}
      <div style={{ marginBottom: '1rem' }}>
        <MatchupStatsCard
          homeTeam={game.home_team}
          awayTeam={game.away_team}
          homeTeamCode={game.home_team_code}
          awayTeamCode={game.away_team_code}
          homeStats={homeStats}
          awayStats={awayStats}
        />
      </div>

      {/* Seção de jogos anteriores */}
      <div style={{ marginBottom: '1.5rem' }}>
        <RecentGamesSection
          homeTeamCode={game.home_team_code}
          awayTeamCode={game.away_team_code}
          homeRecentGames={homeRecentGames}
          awayRecentGames={awayRecentGames}
        />
      </div>

      {/* Faixa de navegação: ← VOLTAR | PRÓXIMO JOGO ► */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
        }}
      >
        <BackButton fallbackHref={backUrl} />
        {nextGame?.id && <NextGameLink nextGameId={nextGame.id} />}
      </div>

      {/* Swipe horizontal: ← jogo anterior | próximo jogo → */}
      <AnaliseSwipeNav
        backUrl={backUrl}
        nextHref={nextGame?.id ? `/jogos/${nextGame.id}/analise` : null}
        prevHref={prevGame?.id ? `/jogos/${prevGame.id}/analise` : null}
      />

      {/* Rodapé com aviso de atualização */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--color-muted)',
          textAlign: 'center',
          paddingTop: '0.75rem',
          paddingBottom: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        ⏱ DADOS ATUALIZADOS A CADA 60S · COPA DO MUNDO FIFA 2026
      </div>
    </div>
  )
}
