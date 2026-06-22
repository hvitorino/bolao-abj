import type { RankingEntry } from '@/lib/types/ranking'
import { ScoutBadges } from '@/components/bolao/ScoutBadges'

interface RankingRowProps {
  entry: RankingEntry
  isCurrentUser: boolean
  isLeader: boolean
  hideScouts?: boolean
  hidePalpites?: boolean
}

export function RankingRow({ entry, isCurrentUser, isLeader, hideScouts = false, hidePalpites = false }: RankingRowProps) {
  // Determinar cor do texto da linha
  let rowColor = 'var(--color-text)'
  if (isLeader) {
    rowColor = 'var(--color-accent)'
  } else if (isCurrentUser) {
    rowColor = 'var(--color-primary)'
  }

  const aprovColor = entry.aproveitamento >= 60
    ? 'var(--color-win)'
    : 'var(--color-muted)'

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--color-border)',
        color: rowColor,
        fontWeight: isLeader || isCurrentUser ? 'bold' : 'normal',
        backgroundColor: isCurrentUser && !isLeader
          ? 'rgba(0, 156, 59, 0.08)'
          : 'transparent',
      }}
    >
      {/* Posição */}
      <td
        style={{
          padding: '0.35rem 0.5rem',
          textAlign: 'right',
          width: '3rem',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          letterSpacing: '0.05em',
        }}
      >
        {entry.rank_position}
      </td>

      {/* Participante */}
      <td
        className="ranking-name-cell"
        style={{
          padding: '0.35rem 0.5rem',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          overflow: 'hidden',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }}>
            {isLeader ? '► ' : ''}{entry.participant_name.split(' ')[0]}
          </span>
          {entry.streak > 0 && (
            <span
              title={`${entry.streak} acerto${entry.streak !== 1 ? 's' : ''} consecutivo${entry.streak !== 1 ? 's' : ''}`}
              style={{
                fontSize: '11px',
                color: 'var(--color-win)',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              🔥×{entry.streak}
            </span>
          )}
          {isCurrentUser && (
            <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 'normal', flexShrink: 0 }}>
              (VOCÊ)
            </span>
          )}
          {!hideScouts && <ScoutBadges scouts={entry.scouts ?? []} />}
        </div>
      </td>

      {/* Pontos */}
      <td
        style={{
          padding: '0.35rem 0.5rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          fontWeight: 'bold',
          minWidth: '5rem',
        }}
      >
        {entry.total_points}
      </td>

      {/* Palpites — oculto no modo por rodada */}
      {!hidePalpites && (
        <td
          style={{
            padding: '0.35rem 0.5rem',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '13px',
            color: 'var(--color-muted)',
            minWidth: '4.5rem',
          }}
        >
          {entry.predictions_count}
        </td>
      )}

      {/* Aproveitamento */}
      <td
        className="hidden md:table-cell"
        style={{
          padding: '0.35rem 0.5rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '13px',
          color: isLeader ? 'var(--color-accent)' : aprovColor,
          minWidth: '5rem',
        }}
      >
        {entry.aproveitamento}%
      </td>
    </tr>
  )
}
