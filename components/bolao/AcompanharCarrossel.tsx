'use client'

import { useEffect, useRef, useState } from 'react'
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
  onGameClick?: (gameId: string) => void
}

// --------------------------------------------------------------------------
// Mini-card individual
// --------------------------------------------------------------------------

function MiniCard({
  game,
  userScore,
  onClick,
}: {
  game: LiveGameWithPrediction
  userScore: GameScoreEntry | undefined
  onClick?: () => void
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
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2rem',
        flex: 1,
        minWidth: '80px',
        padding: '0.4rem 0.6rem',
        border: cardBorder,
        backgroundColor: 'var(--color-surface)',
        cursor: onClick ? 'pointer' : undefined,
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
  onGameClick,
}: AcompanharCarrosselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showRightFade, setShowRightFade] = useState(false)
  const [showLeftFade, setShowLeftFade] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function check() {
      if (!el) return
      const hasOverflow = el.scrollWidth > el.clientWidth + 1
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4
      setShowRightFade(hasOverflow && !atEnd)
      setShowLeftFade(el.scrollLeft > 4)
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [todayGames])

  const scrollStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '0.5rem',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    padding: '0.5rem 0',
  }

  if (loading) {
    return (
      <div style={{ position: 'relative' }}>
        <div className="acompanhar-carrossel" style={scrollStyle}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: '80px',
                height: '68px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (todayGames.length === 0) return null

  const scoreByGameId: Record<string, GameScoreEntry> = {}
  for (const s of currentUserGameScores) {
    scoreByGameId[s.gameId] = s
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        className="acompanhar-carrossel"
        style={scrollStyle}
      >
        {todayGames.map((game) => (
          <MiniCard
            key={game.id}
            game={game}
            userScore={scoreByGameId[game.id]}
            onClick={onGameClick ? () => onGameClick(game.id) : undefined}
          />
        ))}
      </div>

      {showLeftFade && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '3rem',
            background: 'linear-gradient(to left, transparent, var(--color-bg))',
            pointerEvents: 'none',
          }}
        />
      )}
      {showRightFade && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '3rem',
            background: 'linear-gradient(to right, transparent, var(--color-bg))',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
