'use client'

import { useId } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'
import { BREAKDOWN_LABELS } from '@/lib/scoring'
import type { RankingParticipantDetail, GameScoreEntry } from '@/lib/hooks/usePalpitesAoVivo'
import type { ScoreBreakdown } from '@/lib/types/score'

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
          }}
        >
          {participant.games
            .filter((g) => g.status === 'live' || g.status === 'finished')
            .map((game) => (
              <GameBreakdownLine key={game.gameId} game={game} />
            ))}

          {participant.games.filter((g) => g.status === 'live' || g.status === 'finished')
            .length === 0 && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '11px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              NENHUM JOGO DISPUTADO
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GameBreakdownLine({ game }: { game: GameScoreEntry }) {
  const homeFlag = getTeamFlag(game.home_team_code)
  const awayFlag = getTeamFlag(game.away_team_code)

  const isLive = game.status === 'live'
  const hasPrediction = game.userPrediction !== null

  // Pontos efetivos para exibir
  const effectivePoints = isLive ? game.livePoints : game.officialPoints
  const effectiveBreakdown: ScoreBreakdown | null = isLive ? null : game.officialBreakdown

  // Cores
  const pointsColor = isLive
    ? 'var(--color-live)'
    : effectivePoints !== null && effectivePoints > 0
      ? 'var(--color-accent)'
      : 'var(--color-muted)'

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '0.4rem 0.75rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '11px',
      }}
    >
      {/* Linha do jogo: palpite + pontos */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        {/* Palpite do participante (ou placeholder) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            overflow: 'hidden',
          }}
        >
          <span style={{ fontSize: '13px', flexShrink: 0 }}>{homeFlag}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 'bold', flexShrink: 0 }}>
            {game.home_team_code}
          </span>
          {hasPrediction ? (
            <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', flexShrink: 0 }}>
              {game.userPrediction!.home_score} × {game.userPrediction!.away_score}
            </span>
          ) : (
            <span style={{ color: 'var(--color-muted)', flexShrink: 0 }}>— × —</span>
          )}
          <span style={{ color: 'var(--color-text)', fontWeight: 'bold', flexShrink: 0 }}>
            {game.away_team_code}
          </span>
          <span style={{ fontSize: '13px', flexShrink: 0 }}>{awayFlag}</span>
        </div>

        {/* Pontos */}
        <div
          style={{
            color: pointsColor,
            fontWeight: 'bold',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {hasPrediction ? (
            <>
              {effectivePoints !== null ? `+${effectivePoints}` : '—'} PTS
              {isLive && <span style={{ color: 'var(--color-live)' }}>*</span>}
            </>
          ) : (
            <span style={{ color: 'var(--color-error)' }}>SEM PALPITE</span>
          )}
        </div>
      </div>

      {/* Breakdown textual (apenas jogos finished com pontos > 0) */}
      {!isLive && effectiveBreakdown && effectivePoints !== null && effectivePoints > 0 && (
        <div
          style={{
            marginTop: '0.2rem',
            fontSize: '10px',
            color: 'var(--color-muted)',
            letterSpacing: '0.03em',
          }}
        >
          {buildBreakdownText(effectiveBreakdown)}
        </div>
      )}

      {/* Para jogos live com palpite: indicador provisório */}
      {isLive && hasPrediction && (
        <div
          style={{
            marginTop: '0.2rem',
            fontSize: '10px',
            color: 'var(--color-live)',
            letterSpacing: '0.03em',
          }}
        >
          PONTUAÇÃO PROVISÓRIA
        </div>
      )}
    </div>
  )
}

/**
 * Monta string de breakdown exibindo apenas componentes com valor > 0.
 * Ex: "Acertou o vencedor +3 · Placar exato +5"
 */
function buildBreakdownText(breakdown: ScoreBreakdown): string {
  const parts: string[] = []

  for (const key of Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>) {
    const pts = breakdown[key]
    if (pts > 0) {
      parts.push(`${BREAKDOWN_LABELS[key]} +${pts}`)
    }
  }

  return parts.join(' · ')
}
