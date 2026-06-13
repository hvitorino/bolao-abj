import { isValidDateString, todayInBrasilia } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types/game'
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

  // Buscar usuário autenticado e contagem de palpites do dia
  let guessCount = 0
  if (games && games.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const gameIds = games.map((g: Game) => g.id)
      const { count } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('game_id', gameIds)

      guessCount = count ?? 0
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

      {/* Lista de jogos */}
      <GameList games={games ?? []} date={currentDate} />
    </div>
  )
}
