import { dayBoundsInUTC, isValidDateString, todayInBrasilia } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import DayNavigator from '@/components/games/DayNavigator'
import GameList from '@/components/games/GameList'

interface JogosPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function JogosPage({ searchParams }: JogosPageProps) {
  const params = await searchParams
  const dateParam = params.date

  // Determinar data a exibir
  const currentDate =
    dateParam && isValidDateString(dateParam) ? dateParam : todayInBrasilia()

  // Calcular limites do dia em BRT convertidos para UTC
  // Jogos como 2026-06-12T00:00:00Z (21:00 BRT de 11/06) devem aparecer no dia 11/06 BRT
  const { start: startOfDay, end: endOfDay } = dayBoundsInUTC(currentDate)

  const supabase = await createClient()

  // Buscar jogos do dia
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)
    .order('match_date', { ascending: true })

  // Buscar usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Buscar palpites do usuário para os jogos do dia
  let predictionsByGameId: Record<string, Prediction> = {}
  let scoresByGameId: Record<string, Score> = {}
  let participantsByGameId: Record<string, ParticipantEntry[]> = {}
  let guessCount = 0

  if (user && games && games.length > 0) {
    const gameIds = games.map((g: Game) => g.id)

    // Executar todas as queries em paralelo para evitar N+1
    const [
      { data: predictions, count },
      { data: allProfiles },
      { data: allPredictions },
      { data: allScores },
    ] = await Promise.all([
      // Palpites do usuário logado (com contagem para guessCount)
      supabase
        .from('predictions')
        .select('id, game_id, user_id, home_score, away_score, submitted_at', {
          count: 'exact',
        })
        .eq('user_id', user.id)
        .in('game_id', gameIds),

      // Todos os perfis do bolão
      supabase
        .from('profiles')
        .select('id, name')
        .order('name', { ascending: true }),

      // Palpites de todos os usuários nos jogos do dia
      supabase
        .from('predictions')
        .select('id, game_id, user_id, home_score, away_score, submitted_at')
        .in('game_id', gameIds),

      // Scores de todos os usuários nos jogos do dia
      supabase
        .from('scores')
        .select('id, game_id, user_id, points, breakdown')
        .in('game_id', gameIds),
    ])

    guessCount = count ?? 0

    // Mapear predictions do usuário logado por game_id para acesso O(1) no GameCard
    predictionsByGameId = Object.fromEntries(
      (predictions ?? []).map((p: Prediction) => [p.game_id, p])
    )

    // Mapear scores do usuário logado por game_id
    const myScores = (allScores ?? []).filter(
      (s: Score) => s.user_id === user.id
    )
    scoresByGameId = Object.fromEntries(
      myScores.map((s: Score) => [s.game_id, s])
    )

    // Montar participantsByGameId: para cada jogo, lista ordenada de ParticipantEntry
    // Indexar allPredictions e allScores por (user_id, game_id) para acesso O(1)
    const predByUserGame: Record<string, { home_score: number; away_score: number }> = {}
    for (const p of allPredictions ?? []) {
      predByUserGame[`${p.user_id}:${p.game_id}`] = {
        home_score: p.home_score,
        away_score: p.away_score,
      }
    }
    const scoreByUserGame: Record<string, number> = {}
    for (const s of allScores ?? []) {
      scoreByUserGame[`${s.user_id}:${s.game_id}`] = s.points
    }

    for (const gameId of gameIds) {
      participantsByGameId[gameId] = (allProfiles ?? []).map(
        (profile: { id: string; name: string }) => {
          const key = `${profile.id}:${gameId}`
          const prediction = predByUserGame[key] ?? null
          const points =
            prediction !== null
              ? (scoreByUserGame[key] ?? null)
              : null
          return {
            userId: profile.id,
            name: profile.name,
            prediction,
            points,
          } as ParticipantEntry
        }
      )
    }
  }

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Título da seção */}
      <div
        style={{
          marginBottom: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          JOGOS
        </span>
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          COPA DO MUNDO 2026
        </span>
      </div>

      {/* Erro ao buscar jogos */}
      {gamesError && (
        <div
          style={{
            border: '1px solid var(--color-error)',
            backgroundColor: 'var(--color-surface)',
            padding: '1rem',
            marginBottom: '1rem',
            color: 'var(--color-error)',
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          ✗ ERRO AO CARREGAR JOGOS — tente recarregar a página
        </div>
      )}

      {/* Navegador de dias */}
      <div style={{ marginBottom: '1.25rem' }}>
        <DayNavigator
          currentDate={currentDate}
          gameCount={games?.length ?? 0}
          guessCount={guessCount}
        />
      </div>

      {/* Lista de jogos com palpites e pontuações */}
      <GameList
        games={games ?? []}
        date={currentDate}
        predictionsByGameId={predictionsByGameId}
        scoresByGameId={scoresByGameId}
        participantsByGameId={participantsByGameId}
        userId={user?.id}
      />
    </div>
  )
}
