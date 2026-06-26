'use client'

import { useId } from 'react'
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

  const ruleGroups = buildRuleGroups(participant.games)
  const liveGames = participant.games.filter((g) => g.status === 'live' && g.userPrediction)

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
            padding: '0.35rem 3.5rem 0.35rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {/* Regras de pontuação atingidas (jogos finalizados) */}
          {ruleGroups.map((group) => (
            <RuleGroupLine key={group.key} group={group} />
          ))}

          {/* Jogos ao vivo com pontuação provisória */}
          {liveGames.map((game) => (
            <LiveGameLine key={game.gameId} game={game} />
          ))}

          {ruleGroups.length === 0 && liveGames.length === 0 && (
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
// Linha de regra de pontuação agrupada
// --------------------------------------------------------------------------

interface RuleGame {
  home_team_code: string
  away_team_code: string
  predHome: number
  predAway: number
}

interface RuleGroup {
  key: keyof ScoreBreakdown
  label: string
  totalPoints: number
  games: RuleGame[]
}

function RuleGroupLine({ group }: { group: RuleGroup }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        justifyContent: 'flex-end',
        gap: '0.25rem',
        lineHeight: 1.6,
        overflow: 'hidden',
      }}
    >
      {/* Nome da regra */}
      <span style={{ color: 'var(--color-muted)', flexShrink: 0 }}>{group.label}</span>

      <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', flexShrink: 0 }}>
        +{group.totalPoints}
      </span>
    </div>
  )
}

// --------------------------------------------------------------------------
// Linha de jogo ao vivo (pontuação provisória)
// --------------------------------------------------------------------------

function LiveGameLine({ game }: { game: GameScoreEntry }) {
  // Se há breakdown detalhado ao vivo, exibe cada regra separadamente
  if (game.liveBreakdown) {
    const lines = (Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>)
      .filter((key) => {
        const pts = game.liveBreakdown![key]
        return pts !== undefined && pts > 0
      })

    if (lines.length > 0) {
      return (
        <>
          {lines.map((key) => (
            <div
              key={key}
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                flexWrap: 'nowrap',
                justifyContent: 'flex-end',
                lineHeight: 1.6,
                overflow: 'hidden',
              }}
            >
              <span style={{ color: 'var(--color-live)', flexShrink: 0 }}>
                {BREAKDOWN_LABELS[key]}*
              </span>
              <span style={{ color: 'var(--color-live)', fontWeight: 'bold', flexShrink: 0 }}>
                +{game.liveBreakdown![key]}
              </span>
            </div>
          ))}
        </>
      )
    }
  }

  // Fallback: exibe total ao vivo quando não há breakdown ou pontos = 0
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        flexWrap: 'nowrap',
        justifyContent: 'flex-end',
        lineHeight: 1.6,
        overflow: 'hidden',
      }}
    >
      <span style={{ color: 'var(--color-live)', flexShrink: 0 }}>AO VIVO*</span>
      <span style={{ color: 'var(--color-live)', fontWeight: 'bold', flexShrink: 0 }}>
        {game.livePoints !== null ? `+${game.livePoints}` : '+0'}
      </span>
    </div>
  )
}

// --------------------------------------------------------------------------
// Agrupamento por regra de pontuação
// --------------------------------------------------------------------------

function buildRuleGroups(games: GameScoreEntry[]): RuleGroup[] {
  const ruleMap = new Map<keyof ScoreBreakdown, RuleGroup>()

  for (const game of games) {
    if (game.status !== 'finished' || !game.officialBreakdown || !game.userPrediction) continue
    const breakdown = game.officialBreakdown

    for (const key of Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>) {
      const pts = breakdown[key]
      if (!pts || pts <= 0) continue

      if (!ruleMap.has(key)) {
        ruleMap.set(key, { key, label: BREAKDOWN_LABELS[key], totalPoints: 0, games: [] })
      }

      const group = ruleMap.get(key)!
      group.totalPoints += pts
      group.games.push({
        home_team_code: game.home_team_code,
        away_team_code: game.away_team_code,
        predHome: game.userPrediction.home_score,
        predAway: game.userPrediction.away_score,
      })
    }
  }

  // Preserva a ordem definida em BREAKDOWN_LABELS
  return (Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>)
    .filter((key) => ruleMap.has(key))
    .map((key) => ruleMap.get(key)!)
}
