'use client'

import { useRankingRealtime } from '@/lib/hooks/useRankingRealtime'
import { RankingRow } from './RankingRow'

interface RankingTableProps {
  currentUserId: string
}

export function RankingTable({ currentUserId }: RankingTableProps) {
  const { ranking, loading, error } = useRankingRealtime()

  if (loading) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        CARREGANDO RANKING...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          color: 'var(--color-error)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        ✗ {error}
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        NENHUM PARTICIPANTE NO RANKING AINDA
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Cabeçalho da tabela com título e indicador ao vivo */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          RANKING — BOLÃO DO CARTOLA ABJ
        </span>
        <span
          className="blink"
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            color: 'var(--color-live)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          ● AO VIVO
        </span>
      </div>

      {/* Tabela principal */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        {/* Thead */}
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-surface)',
              borderBottom: '2px solid var(--color-border)',
            }}
          >
            <th
              style={{
                padding: '0.35rem 0.5rem',
                textAlign: 'right',
                width: '3rem',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
              }}
            >
              #
            </th>
            <th
              style={{
                padding: '0.35rem 0.5rem',
                textAlign: 'left',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
              }}
            >
              PARTICIPANTE
            </th>
            <th
              style={{
                padding: '0.35rem 0.5rem',
                textAlign: 'center',
                minWidth: '5rem',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
              }}
            >
              PONTOS
            </th>
            <th
              className="hidden md:table-cell"
              style={{
                padding: '0.35rem 0.5rem',
                textAlign: 'center',
                minWidth: '5rem',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                fontWeight: 'normal',
              }}
            >
              APROVEIT.
            </th>
          </tr>
        </thead>

        {/* Tbody */}
        <tbody>
          {ranking.map((entry) => (
            <RankingRow
              key={entry.user_id}
              entry={entry}
              isCurrentUser={entry.user_id === currentUserId}
              isLeader={entry.rank_position === 1 && entry.total_points > 0}
            />
          ))}
        </tbody>
      </table>

      {/* Rodapé com legenda */}
      <div
        style={{
          padding: '0.5rem 1rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            color: 'var(--color-accent)',
          }}
        >
          ► LÍDER
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            color: 'var(--color-primary)',
          }}
        >
          ■ VOCÊ
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            color: 'var(--color-muted)',
          }}
        >
          {ranking.length} PARTICIPANTE{ranking.length !== 1 ? 'S' : ''}
        </span>
      </div>
    </div>
  )
}
