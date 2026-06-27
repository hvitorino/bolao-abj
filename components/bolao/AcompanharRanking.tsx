'use client'

import type { RankingParticipantDetail } from '@/lib/hooks/usePalpitesAoVivo'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface AcompanharRankingProps {
  rankingWithDetails: RankingParticipantDetail[]
  currentUserId: string
  loading: boolean
}

export function AcompanharRanking({
  rankingWithDetails,
  currentUserId,
  loading,
}: AcompanharRankingProps) {
  // ---------- Estado de loading ----------

  if (loading) {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            borderBottom: '1px solid var(--color-border)',
            padding: '0.5rem 0.75rem',
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-text)',
            }}
          >
            RANKING DO DIA
          </span>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ ...MONO, fontSize: '12px', color: 'var(--color-muted)', width: '2rem' }}>
              ─
            </span>
            <span style={{ ...MONO, fontSize: '12px', color: 'var(--color-muted)', flex: 1 }}>
              ────────────────
            </span>
            <span style={{ ...MONO, fontSize: '12px', color: 'var(--color-muted)', width: '2.5rem' }}>
              ──
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ---------- Estado vazio ----------

  if (rankingWithDetails.length === 0) {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            ...MONO,
            fontSize: '12px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          NENHUM PARTICIPANTE
        </span>
      </div>
    )
  }

  // ---------- Estilos comuns ----------

  const thStyle: React.CSSProperties = {
    ...MONO,
    padding: '0.35rem 0.5rem',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-muted)',
    fontWeight: 'normal',
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho da seção */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
        }}
      >
        <span
          style={{
            ...MONO,
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          RANKING DO DIA
        </span>
      </div>

      {/* Cabeçalho das colunas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '2px solid var(--color-border)',
        }}
      >
        <div style={{ ...thStyle, width: '2.5rem', textAlign: 'right' }}>#</div>
        <div style={{ ...thStyle, flex: 1 }}>PARTICIPANTE</div>
        <div style={{ ...thStyle, width: '4rem', textAlign: 'center' }}>PTS</div>
      </div>

      {/* Linhas de participantes */}
      {rankingWithDetails.map((participant) => {
        const isCurrentUser = participant.userId === currentUserId
        const isLeader = participant.rank_position === 1 && participant.total_points > 0

        let prefix = ''
        let prefixColor = 'transparent'

        if (isLeader) {
          prefix = '► '
          prefixColor = 'var(--color-accent)'
        } else if (isCurrentUser) {
          prefix = '■ '
          prefixColor = 'var(--color-primary)'
        }

        return (
          <div
            key={participant.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: isCurrentUser ? 'rgba(0,151,59,0.08)' : 'transparent',
            }}
          >
            {/* Posição */}
            <div
              style={{
                ...MONO,
                width: '2.5rem',
                padding: '0.45rem 0.5rem',
                fontSize: '12px',
                color: 'var(--color-muted)',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {participant.rank_position}
            </div>

            {/* Nome com prefixo */}
            <div
              style={{
                ...MONO,
                flex: 1,
                padding: '0.45rem 0.5rem',
                fontSize: '12px',
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {prefix.length > 0 && (
                <span style={{ color: prefixColor }}>{prefix}</span>
              )}
              {participant.name}
            </div>

            {/* Pontuação */}
            <div
              style={{
                ...MONO,
                width: '4rem',
                padding: '0.45rem 0.5rem',
                fontSize: '13px',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {participant.total_points}
              {participant.hasLivePoints && (
                <span style={{ color: 'var(--color-live)', fontSize: '10px' }}>*</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Rodapé / legenda */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-accent)' }}>► LÍDER</span>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-primary)' }}>■ VOCÊ</span>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-muted)' }}>
          {rankingWithDetails.length} PARTICIPANTE{rankingWithDetails.length !== 1 ? 'S' : ''}
        </span>
      </div>
    </div>
  )
}
