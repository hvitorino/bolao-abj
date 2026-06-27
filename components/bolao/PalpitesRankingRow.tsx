'use client'

import { useId } from 'react'
import { BREAKDOWN_LABELS } from '@/lib/scoring'
import type { RankingParticipantDetail, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import type { ScoreBreakdown } from '@/lib/types/score'
import { getTeamFlag } from '@/lib/utils/teamFlag'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface PalpitesRankingRowProps {
  participant: RankingParticipantDetail
  isCurrentUser: boolean
  isLeader: boolean
  isExpanded: boolean
  onToggle: () => void
}

export function PalpitesRankingRow({
  participant,
  isCurrentUser,
  isLeader,
  isExpanded,
  onToggle,
}: PalpitesRankingRowProps) {
  const accordionId = useId()

  const rankColor = isLeader
    ? 'var(--color-accent)'
    : isCurrentUser
      ? 'var(--color-primary)'
      : 'var(--color-text)'

  const rowBg = isCurrentUser ? 'rgba(0,151,59,0.08)' : undefined

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      style={{
        ...MONO,
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Linha principal — clicável */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={accordionId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.4rem 0.5rem',
          cursor: 'pointer',
          backgroundColor: rowBg,
          userSelect: 'none',
        }}
      >
        {/* Posição */}
        <div
          style={{
            width: '2.5rem',
            textAlign: 'right',
            fontSize: '12px',
            fontWeight: 'bold',
            color: rankColor,
            flexShrink: 0,
            paddingRight: '0.5rem',
          }}
        >
          {participant.rank_position}
        </div>

        {/* Nome */}
        <div
          style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {isLeader && (
            <span style={{ color: 'var(--color-accent)', marginRight: '0.25rem' }}>►</span>
          )}
          {isCurrentUser && !isLeader && (
            <span style={{ color: 'var(--color-primary)', marginRight: '0.25rem' }}>■</span>
          )}
          <span style={{ color: rankColor }}>{participant.name}</span>
        </div>

        {/* Pontos */}
        <div
          style={{
            width: '4rem',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            flexShrink: 0,
          }}
        >
          {participant.total_points}
          {participant.hasLivePoints && (
            <span style={{ color: 'var(--color-live)', fontSize: '11px' }}>*</span>
          )}
        </div>

        {/* Ícone expandir/recolher */}
        <div
          style={{
            width: '1.5rem',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--color-muted)',
            flexShrink: 0,
          }}
        >
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Accordion de breakdown */}
      {isExpanded && (
        <div
          id={accordionId}
          role="region"
          aria-label={`Detalhes de ${participant.name}`}
          style={{
            backgroundColor: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border)',
            padding: '0.25rem 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {participant.games.map((game) => (
            <GameBreakdownBlock
              key={game.gameId}
              game={game}
              isCurrentUser={isCurrentUser}
            />
          ))}

          {participant.games.length === 0 && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              NENHUM PONTO CONQUISTADO HOJE
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// GameBreakdownBlock — bloco vertical por jogo
// --------------------------------------------------------------------------

interface GameBreakdownBlockProps {
  game: GameScoreEntry
  isCurrentUser: boolean
}

function GameBreakdownBlock({ game, isCurrentUser }: GameBreakdownBlockProps) {
  // Guard de privacidade: oculta palpite de terceiro em jogo pendente
  const shouldHidePrediction = game.status === 'pending' && !isCurrentUser
  const predictionLabel = shouldHidePrediction
    ? '—'
    : game.userPrediction
      ? `${game.userPrediction.home_score}×${game.userPrediction.away_score}`
      : '—'

  // Segmento esquerdo: times e placar real
  const matchLabel =
    game.status === 'pending'
      ? `${getTeamFlag(game.home_team_code)} vs ${getTeamFlag(game.away_team_code)}`
      : `${getTeamFlag(game.home_team_code)} ${game.home_score}×${game.away_score} ${getTeamFlag(game.away_team_code)}`

  // Segmento direito: total do jogo
  let totalLabel: string
  let totalColor: string
  if (game.status === 'pending') {
    totalLabel = '—'
    totalColor = 'var(--color-muted)'
  } else if (game.status === 'live') {
    if (game.livePoints !== null) {
      totalLabel = `+${game.livePoints}*`
      totalColor = 'var(--color-live)'
    } else {
      totalLabel = '—'
      totalColor = 'var(--color-muted)'
    }
  } else {
    // finished
    const pts = game.officialPoints ?? 0
    totalLabel = `+${pts}`
    totalColor = pts > 0 ? 'var(--color-accent)' : 'var(--color-muted)'
  }

  // Sub-linhas de regra ativas
  const keys = Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>
  let activeRules: Array<keyof ScoreBreakdown> = []

  if (game.status === 'finished' && game.officialBreakdown) {
    activeRules = keys.filter((k) => (game.officialBreakdown![k] ?? 0) > 0)
  } else if (game.status === 'live' && game.liveBreakdown) {
    activeRules = keys.filter((k) => (game.liveBreakdown![k] ?? 0) > 0)
  }

  const isLive = game.status === 'live'

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '12px',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '0.2rem',
        marginBottom: '0.1rem',
      }}
    >
      {/* Linha-cabeçalho */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: '0.25rem',
          lineHeight: 1.6,
          overflow: 'hidden',
        }}
      >
        {/* Esquerdo: times + placar real */}
        <span
          style={{
            color: isLive ? 'var(--color-live)' : 'var(--color-text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {matchLabel}
        </span>

        {/* Centro: palpite */}
        <span
          style={{
            color: game.status === 'pending' ? 'var(--color-muted)' : 'var(--color-text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          {predictionLabel}
        </span>

        {/* Direito: total */}
        <span
          style={{
            color: totalColor,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {totalLabel}
        </span>
      </div>

      {/* Sub-linhas de regra */}
      {activeRules.map((key) => {
        const pts = isLive
          ? (game.liveBreakdown![key] ?? 0)
          : (game.officialBreakdown![key] ?? 0)

        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingLeft: '1rem',
              lineHeight: 1.5,
              gap: '0.25rem',
            }}
          >
            <span style={{ color: isLive ? 'var(--color-live)' : 'var(--color-win)', flexShrink: 0 }}>
              ✓
            </span>
            <span
              style={{
                flex: 1,
                color: 'var(--color-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {BREAKDOWN_LABELS[key]}
            </span>
            <span
              style={{
                color: isLive ? 'var(--color-live)' : 'var(--color-accent)',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              {isLive ? `+${pts}*` : `+${pts}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
