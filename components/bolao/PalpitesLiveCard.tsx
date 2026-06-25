'use client'

import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface PalpitesLiveCardProps {
  liveGames: LiveGameWithPrediction[]
  loading: boolean
}

export function PalpitesLiveCard({ liveGames, loading }: PalpitesLiveCardProps) {
  if (loading) {
    return (
      <div
        style={{
          ...MONO,
          padding: '0.75rem',
          fontSize: '11px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        CARREGANDO...
      </div>
    )
  }

  if (liveGames.length === 0) {
    return (
      <div
        style={{
          ...MONO,
          padding: '0.75rem 1rem',
          fontSize: '11px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          textAlign: 'center',
        }}
      >
        NENHUM JOGO AO VIVO NO MOMENTO
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        overflowX: liveGames.length >= 2 ? 'auto' : undefined,
      }}
    >
      {liveGames.map((game) => (
        <LiveGameCard key={game.id} game={game} />
      ))}
    </div>
  )
}

function LiveGameCard({ game }: { game: LiveGameWithPrediction }) {
  const homeFlag = getTeamFlag(game.home_team_code)
  const awayFlag = getTeamFlag(game.away_team_code)

  const scoreHome = game.home_score ?? '-'
  const scoreAway = game.away_score ?? '-'

  return (
    <div
      style={{
        ...MONO,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        minWidth: '260px',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho: badge AO VIVO + times */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.4rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-live)',
            animation: 'blink 1s step-end infinite',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
          }}
        >
          ██ AO VIVO ██
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {game.home_team_code} × {game.away_team_code}
        </span>
      </div>

      {/* Placar real */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '13px' }}>{homeFlag}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text)', fontWeight: 'bold' }}>
            {game.home_team_code}
          </span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'var(--color-accent)',
              minWidth: '3.5rem',
              textAlign: 'center',
            }}
          >
            {scoreHome} × {scoreAway}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text)', fontWeight: 'bold' }}>
            {game.away_team_code}
          </span>
          <span style={{ fontSize: '13px' }}>{awayFlag}</span>
        </div>
        <div
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: '0.2rem',
          }}
        >
          PLACAR REAL
        </div>
      </div>

      {/* Palpite do usuário */}
      <div style={{ padding: '0.5rem 0.75rem' }}>
        {game.myPrediction ? (
          <div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.2rem',
              }}
            >
              SEU PALPITE:
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span style={{ fontSize: '13px' }}>{homeFlag}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>
                {game.home_team_code}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'var(--color-text)',
                  minWidth: '3rem',
                  textAlign: 'center',
                }}
              >
                {game.myPrediction.home_score} × {game.myPrediction.away_score}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>
                {game.away_team_code}
              </span>
              <span style={{ fontSize: '13px' }}>{awayFlag}</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            SEM PALPITE REGISTRADO
          </div>
        )}
      </div>
    </div>
  )
}
