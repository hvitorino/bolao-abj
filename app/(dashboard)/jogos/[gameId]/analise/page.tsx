import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import MatchupStatsCard, { TeamStats } from '@/components/bolao/MatchupStatsCard'
import RecentGamesSection, { RecentGame } from '@/components/bolao/RecentGamesSection'

export const revalidate = 60

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface PageProps {
  params: Promise<{ gameId: string }>
}

type GameRow = {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number | null
  away_score: number | null
  match_date: string
  match_day: string | null
  status: string
  round: string | null
}

function calculateTeamStats(games: GameRow[], teamCode: string): TeamStats {
  let wins = 0,
    draws = 0,
    losses = 0
  let goalsFor = 0,
    goalsAgainst = 0
  let cleanSheets = 0,
    gamesScored = 0

  for (const game of games) {
    const isHome = game.home_team_code === teamCode
    const isAway = game.away_team_code === teamCode

    if (!isHome && !isAway) continue

    // Jogos sem placar ainda não contribuem para as stats
    if (game.home_score === null || game.away_score === null) continue

    const myScore = isHome ? game.home_score : game.away_score
    const oppScore = isHome ? game.away_score : game.home_score

    if (myScore > oppScore) wins++
    else if (myScore === oppScore) draws++
    else losses++

    goalsFor += myScore
    goalsAgainst += oppScore
    if (oppScore === 0) cleanSheets++
    if (myScore > 0) gamesScored++
  }

  return {
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets,
    gamesScored,
  }
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d
    .toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    .replace('.', '')
    .toUpperCase()
}

function getRecentGames(games: GameRow[], teamCode: string): RecentGame[] {
  // Filtrar apenas jogos com placar definido (encerrados ou ao vivo com placar)
  const teamGames = games
    .filter(
      (g) =>
        (g.home_team_code === teamCode || g.away_team_code === teamCode) &&
        g.home_score !== null &&
        g.away_score !== null
    )
    // Ordenar do mais recente ao mais antigo
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    // Pegar os 3 mais recentes
    .slice(0, 3)

  return teamGames.map((game) => {
    const isHome = game.home_team_code === teamCode
    const myScore = isHome ? game.home_score! : game.away_score!
    const oppScore = isHome ? game.away_score! : game.home_score!
    const adversario = isHome ? game.away_team_code : game.home_team_code

    let resultado: 'V' | 'E' | 'D'
    if (myScore > oppScore) resultado = 'V'
    else if (myScore === oppScore) resultado = 'E'
    else resultado = 'D'

    return {
      date: formatDate(game.match_date),
      placar: `${myScore}×${oppScore}`,
      adversario,
      resultado,
    }
  })
}

export default async function AnalisePage({ params }: PageProps) {
  const { gameId } = await params

  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
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

  // Calcular stats em memória
  const homeStats = calculateTeamStats(games, game.home_team_code)
  const awayStats = calculateTeamStats(games, game.away_team_code)

  // Calcular últimos 3 jogos por time
  const homeRecentGames = getRecentGames(games, game.home_team_code)
  const awayRecentGames = getRecentGames(games, game.away_team_code)

  // URL de volta para o dia do jogo
  const backDate = game.match_day ?? game.match_date?.slice(0, 10)
  const backUrl = backDate ? `/jogos?date=${backDate}` : '/jogos'

  // Formatar a data do jogo para o header
  const matchDateFormatted = formatDate(game.match_date)

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Botão de voltar */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={backUrl}
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          ← VOLTAR AO PALPITE
        </Link>
      </div>

      {/* Header da análise */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          marginBottom: '1rem',
          overflow: 'hidden',
        }}
      >
        {/* Barra de título */}
        <div
          style={{
            borderBottom: '1px solid var(--color-border)',
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--color-primary)',
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'var(--color-bg)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>ANÁLISE DE CONFRONTO</span>
          <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--color-bg)', opacity: 0.8 }}>
            {game.round ?? 'COPA 2026'}
          </span>
        </div>

        {/* Confronto principal */}
        <div
          style={{
            padding: '1rem 0.75rem',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {/* Time da casa */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'var(--color-text)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {game.home_team}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                marginTop: '0.1rem',
              }}
            >
              {game.home_team_code}
            </div>
          </div>

          {/* Separador e data */}
          <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
              }}
            >
              ×
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                marginTop: '0.1rem',
                whiteSpace: 'nowrap',
              }}
            >
              {matchDateFormatted}
            </div>
          </div>

          {/* Time visitante */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'var(--color-text)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {game.away_team}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                marginTop: '0.1rem',
              }}
            >
              {game.away_team_code}
            </div>
          </div>
        </div>

        {/* Status do jogo */}
        <div
          style={{
            borderTop: '1px dashed var(--color-border)',
            padding: '0.4rem 0.75rem',
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
          }}
        >
          {game.status === 'pending' && '⏱ JOGO AINDA NÃO INICIADO'}
          {game.status === 'live' && (
            <span style={{ color: 'var(--color-live)', fontWeight: 'bold' }}>
              ■ AO VIVO —{' '}
              {game.home_score !== null && game.away_score !== null
                ? `${game.home_score} × ${game.away_score}`
                : '0 × 0'}
            </span>
          )}
          {game.status === 'finished' && (
            <span>
              □ ENCERRADO —{' '}
              {game.home_score !== null && game.away_score !== null
                ? `${game.home_score} × ${game.away_score}`
                : '- × -'}
            </span>
          )}
        </div>
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

      {/* Seção de últimos 3 jogos */}
      <div style={{ marginBottom: '1.5rem' }}>
        <RecentGamesSection
          homeTeam={game.home_team}
          awayTeam={game.away_team}
          homeTeamCode={game.home_team_code}
          awayTeamCode={game.away_team_code}
          homeRecentGames={homeRecentGames}
          awayRecentGames={awayRecentGames}
        />
      </div>

      {/* Rodapé com aviso de atualização */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--color-muted)',
          textAlign: 'center',
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
