import { cookies } from 'next/headers'
import { dayBoundsInUTC, isValidDateString, todayInBrasilia } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { redirect } from 'next/navigation'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import type { ScoreBreakdown } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import DayNavigator from '@/components/games/DayNavigator'
import GameList from '@/components/games/GameList'

interface JogosPageProps {
  searchParams: Promise<{ date?: string; group?: string }>
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

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value

  const activeGroup = await resolveActiveGroup(
    supabase,
    authUser.id,
    params.group,
    '/jogos',
    { date: dateParam },
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

  const { groupId: activeGroupId, groupName: activeGroupName } = activeGroup

  // Buscar jogos do dia
  const { data: rawGames, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)

  const STATUS_ORDER: Record<string, number> = { live: 0, pending: 1, finished: 2 }
  const games = rawGames
    ? [...rawGames].sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
        if (statusDiff !== 0) return statusDiff
        return new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
      })
    : null

  const user = authUser

  // Buscar palpites do usuário para os jogos do dia
  let predictionsByGameId: Record<string, Prediction> = {}
  let scoresByGameId: Record<string, Score> = {}
  const participantsByGameId: Record<string, ParticipantEntry[]> = {}
  let guessCount = 0

  if (user && games && games.length > 0) {
    const gameIds = games.map((g: Game) => g.id)

    // Executar todas as queries em paralelo para evitar N+1
    const [
      { data: predictions, count },
      { data: groupMembers },
      { data: allPredictions },
      { data: allScores },
    ] = await Promise.all([
      // Palpites do usuário logado neste grupo (com contagem para guessCount)
      supabase
        .from('predictions')
        .select('id, game_id, user_id, home_score, away_score, submitted_at', {
          count: 'exact',
        })
        .eq('user_id', user.id)
        .eq('group_id', activeGroupId)
        .in('game_id', gameIds),

      // Membros do grupo ativo (substitui "todos os perfis do sistema")
      supabase
        .from('group_members')
        .select('user_id, profiles(id, name)')
        .eq('group_id', activeGroupId),

      // Palpites de todos os membros do grupo ativo nos jogos do dia
      supabase
        .from('predictions')
        .select('id, game_id, user_id, home_score, away_score, submitted_at')
        .eq('group_id', activeGroupId)
        .in('game_id', gameIds),

      // Scores de todos os membros do grupo ativo nos jogos do dia
      supabase
        .from('scores')
        .select('*')
        .eq('group_id', activeGroupId)
        .in('game_id', gameIds),
    ])

    guessCount = count ?? 0

    // Mapear predictions do usuário logado por game_id para acesso O(1) no GameCard
    predictionsByGameId = Object.fromEntries(
      (predictions ?? []).map((p: Prediction) => [p.game_id, p])
    )

    // Mapear scores do usuário logado por game_id
    const typedAllScores = (allScores ?? []) as Score[]
    const myScores = typedAllScores.filter((s) => s.user_id === user.id)
    scoresByGameId = Object.fromEntries(
      myScores.map((s) => [s.game_id, s])
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
    const scoreByUserGame: Record<string, { points: number; breakdown: ScoreBreakdown }> = {}
    for (const s of typedAllScores) {
      scoreByUserGame[`${s.user_id}:${s.game_id}`] = {
        points: s.points,
        breakdown: s.breakdown,
      }
    }

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

    for (const gameId of gameIds) {
      participantsByGameId[gameId] = memberProfiles.map((profile) => {
        const key = `${profile.id}:${gameId}`
        const prediction = predByUserGame[key] ?? null
        const scoreEntry = prediction !== null ? (scoreByUserGame[key] ?? null) : null
        return {
          userId: profile.id,
          name: profile.name,
          prediction,
          points: scoreEntry?.points ?? null,
          breakdown: scoreEntry?.breakdown ?? null,
        } as ParticipantEntry
      })
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
          alignItems: 'baseline',
          gap: '0.75rem',
          flexWrap: 'wrap',
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
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          · {activeGroupName.toUpperCase()}
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
        groupId={activeGroupId}
      />
    </div>
  )
}
