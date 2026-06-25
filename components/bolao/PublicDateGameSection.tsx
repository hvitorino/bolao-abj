import { ParticipantEntry } from '@/lib/types/participant'
import type { PublicDateGame } from '@/lib/types/public-date'
import PublicParticipantsList from '@/components/bolao/PublicParticipantsList'

interface PublicDateGameSectionProps {
  game: PublicDateGame
  groupId: string
  participants: ParticipantEntry[]
  liveHomeScore: number | null
  liveAwayScore: number | null
}

/**
 * Formata a rodada removendo o prefixo "Copa do Mundo NNNN - " gerado pela ESPN
 * para exibição compacta no cabeçalho.
 */
function formatRound(round: string): string {
  return round.replace(/^Copa do Mundo \d{4}\s*[-–]\s*/i, '').trim().toUpperCase()
}

/**
 * Formata o horário BRT a partir de uma string ISO UTC.
 */
function formatTimeBRT(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Seção de um jogo na página pública por data.
 * Exibe mini placar + badge de status + tabela de palpites via PublicParticipantsList.
 */
export default function PublicDateGameSection({
  game,
  groupId,
  participants,
  liveHomeScore,
  liveAwayScore,
}: PublicDateGameSectionProps) {
  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isPending = game.status === 'pending'

  const hasScore = game.home_score !== null && game.away_score !== null
  const scoreText = hasScore
    ? `${game.home_score} × ${game.away_score}`
    : isLive
      ? '0 × 0'
      : '— × —'

  const cardBorderColor = isLive ? 'var(--color-primary)' : 'var(--color-border)'
  const cardBorderStyle = isFinished ? 'dashed' : 'solid'

  const roundLabel = formatRound(game.round)
  const timeBRT = formatTimeBRT(game.match_date)

  return (
    <div
      style={{
        border: `1px ${cardBorderStyle} ${cardBorderColor}`,
        backgroundColor: isLive ? 'rgba(0, 156, 59, 0.08)' : 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header: rodada + horário BRT + badge de status */}
      <div
        style={{
          borderBottom: `1px ${cardBorderStyle} ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {roundLabel} · {timeBRT} BRT
        </span>

        {isLive && (
          <span
            style={{
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--color-primary)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
              animation: 'blink 1s step-end infinite',
            }}
          >
            ■ AO VIVO
          </span>
        )}
        {isPending && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            PENDENTE
          </span>
        )}
        {isFinished && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--color-muted)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            □ ENCERRADO
          </span>
        )}
      </div>

      {/* Placar central: home_team_code × away_team_code */}
      <div
        style={{
          padding: '0.75rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {/* Time da casa */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--color-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {game.home_team_code}
        </div>

        {/* Placar */}
        <div
          style={{
            textAlign: 'center',
            fontSize: hasScore || isLive ? '22px' : '16px',
            fontWeight: 'bold',
            color: hasScore || isLive ? 'var(--color-accent)' : 'var(--color-muted)',
            letterSpacing: '0.05em',
            minWidth: '72px',
          }}
        >
          {scoreText}
        </div>

        {/* Time visitante */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'var(--color-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {game.away_team_code}
        </div>
      </div>

      {/* Tabela de palpites: reutiliza PublicParticipantsList */}
      <div
        style={{
          borderTop: `1px ${cardBorderStyle} ${cardBorderColor}`,
        }}
      >
        <PublicParticipantsList
          participants={participants}
          gameStatus={game.status}
          gameId={game.id}
          groupId={groupId}
          liveHomeScore={liveHomeScore}
          liveAwayScore={liveAwayScore}
        />
      </div>
    </div>
  )
}
