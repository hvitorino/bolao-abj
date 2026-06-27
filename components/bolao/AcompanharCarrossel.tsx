'use client'

import type { LiveGameWithPrediction, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import { getTeamFlag } from '@/lib/utils/teamFlag'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

// --------------------------------------------------------------------------
// Tipos e helpers
// --------------------------------------------------------------------------

type MiniCardState = 'em-breve' | 'ao-vivo' | 'pontuado' | 'final'

function getMiniCardState(
  game: LiveGameWithPrediction,
  userScore: GameScoreEntry | undefined
): MiniCardState {
  if (game.status === 'live') return 'ao-vivo'
  if (game.status === 'finished') {
    if (userScore?.officialPoints !== null && userScore?.officialPoints !== undefined) {
      return 'pontuado'
    }
    return 'final'
  }
  return 'em-breve'
}

function formatTime(matchDate: string): string {
  try {
    const date = new Date(matchDate)
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return '--:--'
  }
}

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

interface AcompanharCarrosselProps {
  todayGames: LiveGameWithPrediction[]
  currentUserGameScores: GameScoreEntry[]
  loading: boolean
}

// --------------------------------------------------------------------------
// Mini-card individual
// --------------------------------------------------------------------------

function MiniCard({
  game,
  userScore,
}: {
  game: LiveGameWithPrediction
  userScore: GameScoreEntry | undefined
}) {
  const state = getMiniCardState(game, userScore)

  const cardBorder =
    state === 'ao-vivo' ? '2px solid var(--color-live)' : '1px solid var(--color-border)'

  const placarColor =
    state === 'em-breve'
      ? 'var(--color-muted)'
      : state === 'ao-vivo'
        ? 'var(--color-accent)'
        : state === 'pontuado'
          ? 'var(--color-accent)'
          : 'var(--color-muted)'

  const placar =
    state === 'em-breve'
      ? '×'
      : `${game.home_score ?? 0}×${game.away_score ?? 0}`

  let labelText = ''
  let labelColor = 'var(--color-muted)'

  if (state === 'em-breve') {
    labelText = 'EM BREVE'
    labelColor = 'var(--color-muted)'
  } else if (state === 'ao-vivo') {
    labelText = '● AO VIVO'
    labelColor = 'var(--color-live)'
  } else if (state === 'final') {
    labelText = 'FINAL'
    labelColor = 'var(--color-muted)'
  } else if (state === 'pontuado') {
    const pts = userScore!.officialPoints!
    labelText = pts > 0 ? `+${pts} PTS` : '+0'
    labelColor = pts > 0 ? 'var(--color-win)' : 'var(--color-muted)'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2rem',
        flexShrink: 0,
        minWidth: '80px',
        padding: '0.4rem 0.6rem',
        border: cardBorder,
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Horário */}
      <span
        style={{
          ...MONO,
          fontSize: '9px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {formatTime(game.match_date)}
      </span>

      {/* Linha de placar: bandeira × placar × bandeira */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>
          {getTeamFlag(game.home_team_code)}
        </span>
        <span
          style={{
            ...MONO,
            fontSize: '13px',
            fontWeight: 'bold',
            color: placarColor,
            whiteSpace: 'nowrap',
          }}
        >
          {placar}
        </span>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>
          {getTeamFlag(game.away_team_code)}
        </span>
      </div>

      {/* Label de status */}
      <span
        style={{
          ...MONO,
          fontSize: '9px',
          color: labelColor,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}
      >
        {labelText}
      </span>

      {/* Palpite do usuário */}
      {game.myPrediction && (
        <span
          style={{
            ...MONO,
            fontSize: '9px',
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {game.myPrediction.home_score}×{game.myPrediction.away_score}
        </span>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Componente principal
// --------------------------------------------------------------------------

export function AcompanharCarrossel({
  todayGames,
  currentUserGameScores,
  loading,
}: AcompanharCarrosselProps) {
  if (loading) {
    return (
      <div
        className="acompanhar-carrossel"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.5rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '0.5rem 0',
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: '80px',
              height: '68px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    )
  }

  if (todayGames.length === 0) {
    return null
  }

  // Indexar pontuações do usuário por gameId para lookup rápido
  const scoreByGameId: Record<string, GameScoreEntry> = {}
  for (const s of currentUserGameScores) {
    scoreByGameId[s.gameId] = s
  }

  return (
    <div
      className="acompanhar-carrossel"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '0.5rem',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        padding: '0.5rem 0',
      }}
    >
      {todayGames.map((game) => (
        <MiniCard key={game.id} game={game} userScore={scoreByGameId[game.id]} />
      ))}
    </div>
  )
}
