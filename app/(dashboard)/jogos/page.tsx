import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import DayNavigator from '@/components/games/DayNavigator'
import GameList from '@/components/games/GameList'

interface JogosPageProps {
  searchParams: Promise<{ date?: string }>
}

// Valida formato YYYY-MM-DD
function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

// Retorna data atual no fuso de Brasília em formato YYYY-MM-DD
function todayInBrasilia(): string {
  return new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
}

export default async function JogosPage({ searchParams }: JogosPageProps) {
  const params = await searchParams
  const dateParam = params.date

  // Determinar data a exibir
  const currentDate =
    dateParam && isValidDate(dateParam) ? dateParam : todayInBrasilia()

  const startOfDay = `${currentDate}T00:00:00Z`
  const endOfDay = `${currentDate}T23:59:59Z`

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
  let guessCount = 0

  if (user && games && games.length > 0) {
    const gameIds = games.map((g: Game) => g.id)

    const { data: predictions, count } = await supabase
      .from('predictions')
      .select('id, game_id, user_id, home_score, away_score, submitted_at', {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .in('game_id', gameIds)

    guessCount = count ?? 0

    // Mapear predictions por game_id para acesso O(1) no GameCard
    predictionsByGameId = Object.fromEntries(
      (predictions ?? []).map((p: Prediction) => [p.game_id, p])
    )

    // Buscar scores calculados para os jogos do dia (apenas jogos encerrados terão scores)
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', user.id)
      .in('game_id', gameIds)

    scoresByGameId = Object.fromEntries(
      (scores ?? []).map((s: Score) => [s.game_id, s])
    )
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
        userId={user?.id}
      />
    </div>
  )
}
