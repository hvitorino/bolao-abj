'use client'

import { useLivePointsByUser } from '@/lib/hooks/useLivePointsByUser'
import { useRoundRanking } from '@/lib/hooks/useRoundRanking'
import type { RankingEntry } from '@/lib/types/ranking'
import { RankingRow } from './RankingRow'
import { RoundChips } from './RoundChips'
import { SCOUT_META } from './ScoutBadges'

interface RankingTableProps {
  currentUserId: string
  groupId: string
}

// Soma a pontuação parcial de jogos `live` à pontuação oficial e recalcula
// `rank_position` no cliente (critério de empate: nome A-Z, igual ao backend).
// `rank_position` reproduz a semântica de RANK() do Postgres usada por
// `get_ranking()`: participantes com `total_points` idêntico recebem a
// mesma posição (empate), e a próxima posição distinta usa `index + 1`
// (não `count_anteriores + 1`), exatamente como RANK() faz ao pular números.
// `aproveitamento` permanece inalterado — continua refletindo apenas jogos `finished`.
function applyLivePoints(
  ranking: RankingEntry[],
  livePoints: Record<string, number>
): RankingEntry[] {
  const adjusted = ranking.map((entry) => ({
    ...entry,
    total_points: entry.total_points + (livePoints[entry.user_id] ?? 0),
  }))

  adjusted.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return a.participant_name.localeCompare(b.participant_name, 'pt-BR')
  })

  let previousRank = 0
  let previousPoints: number | null = null

  return adjusted.map((entry, index) => {
    const rank_position =
      previousPoints !== null && entry.total_points === previousPoints
        ? previousRank
        : index + 1

    previousRank = rank_position
    previousPoints = entry.total_points

    return { ...entry, rank_position }
  })
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

export function RankingTable({ currentUserId, groupId }: RankingTableProps) {
  const {
    selectedRound,
    setSelectedRound,
    availableRounds,
    roundsLoading,
    ranking,
    loading,
    error,
    lastUpdatedAt,
  } = useRoundRanking(groupId)

  const { livePoints, loading: livePointsLoading } = useLivePointsByUser(groupId)

  const isRoundMode = selectedRound !== 'GERAL'

  // Live points só se aplicam no modo GERAL
  const adjustedRanking = isRoundMode
    ? ranking
    : applyLivePoints(ranking, livePoints)

  const hasLivePoints = !isRoundMode && Object.values(livePoints).some((pts) => pts > 0)

  // Enquanto carrega no modo GERAL, aguarda também live points
  const isLoading = loading || (!isRoundMode && livePointsLoading)

  if (isLoading) {
    return (
      <>
        {/* Chips ficam visíveis mesmo durante o loading */}
        {!roundsLoading && (
          <RoundChips
            rounds={availableRounds}
            selectedRound={selectedRound}
            onSelect={setSelectedRound}
          />
        )}
        <div
          style={{
            ...MONO,
            padding: '2rem',
            textAlign: 'center',
            fontSize: '14px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          CARREGANDO RANKING...
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        {!roundsLoading && (
          <RoundChips
            rounds={availableRounds}
            selectedRound={selectedRound}
            onSelect={setSelectedRound}
          />
        )}
        <div
          style={{
            ...MONO,
            padding: '2rem',
            textAlign: 'center',
            fontSize: '14px',
            color: 'var(--color-error)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          ✗ {error}
        </div>
      </>
    )
  }

  if (ranking.length === 0) {
    return (
      <>
        {!roundsLoading && (
          <RoundChips
            rounds={availableRounds}
            selectedRound={selectedRound}
            onSelect={setSelectedRound}
          />
        )}
        <div
          style={{
            ...MONO,
            padding: '2rem',
            textAlign: 'center',
            fontSize: '14px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          NENHUM PARTICIPANTE NO RANKING AINDA
        </div>
      </>
    )
  }

  const thStyle: React.CSSProperties = {
    ...MONO,
    padding: '0.35rem 0.5rem',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-muted)',
    fontWeight: 'normal',
  }

  return (
    <>
      {/* Chips de fase — fora do border da tabela */}
      {!roundsLoading && (
        <RoundChips
          rounds={availableRounds}
          selectedRound={selectedRound}
          onSelect={setSelectedRound}
        />
      )}

      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {/* Cabeçalho descritivo da fase selecionada */}
        {isRoundMode && (
          <div
            style={{
              padding: '0.4rem 0.75rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.1rem',
            }}
          >
            <span
              style={{
                ...MONO,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text)',
                fontWeight: 'bold',
              }}
            >
              RANKING — BOLÃO DA COPA
            </span>
            <span
              style={{
                ...MONO,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
              }}
            >
              FASE: {selectedRound.toUpperCase()}
            </span>
          </div>
        )}

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
                  ...thStyle,
                  textAlign: 'right',
                  width: '3rem',
                }}
              >
                #
              </th>
              <th
                style={{
                  ...thStyle,
                  textAlign: 'left',
                }}
              >
                PARTICIPANTE
              </th>
              <th
                style={{
                  ...thStyle,
                  textAlign: 'center',
                  minWidth: '5rem',
                }}
              >
                PONTOS
              </th>
              {/* Coluna PALP. oculta no modo por rodada */}
              {!isRoundMode && (
                <th
                  style={{
                    ...thStyle,
                    textAlign: 'center',
                    minWidth: '4.5rem',
                  }}
                >
                  PALP.
                </th>
              )}
              <th
                className="hidden md:table-cell"
                style={{
                  ...thStyle,
                  textAlign: 'center',
                  minWidth: '5rem',
                }}
              >
                APROVEIT.
              </th>
            </tr>
          </thead>

          {/* Tbody */}
          <tbody>
            {adjustedRanking.map((entry) => (
              <RankingRow
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === currentUserId}
                isLeader={entry.rank_position === 1 && entry.total_points > 0}
                hideScouts={isRoundMode}
                hidePalpites={isRoundMode}
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
            alignItems: 'center',
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: '11px',
              color: 'var(--color-accent)',
            }}
          >
            ► LÍDER
          </span>
          <span
            style={{
              ...MONO,
              fontSize: '11px',
              color: 'var(--color-primary)',
            }}
          >
            ■ VOCÊ
          </span>
          <span
            style={{
              ...MONO,
              fontSize: '11px',
              color: 'var(--color-muted)',
            }}
          >
            {ranking.length} PARTICIPANTE{ranking.length !== 1 ? 'S' : ''}
          </span>
          {hasLivePoints && !isRoundMode && (
            <span
              style={{
                ...MONO,
                fontSize: '11px',
                color: 'var(--color-live)',
              }}
            >
              ██ AO VIVO
            </span>
          )}
          {lastUpdatedAt && !isRoundMode && (
            <span
              style={{
                ...MONO,
                fontSize: '11px',
                color: 'var(--color-muted)',
                marginLeft: 'auto',
              }}
            >
              ⏱ {lastUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Legenda dos scouts e streak — apenas no modo GERAL */}
        {!isRoundMode && (
          <div
            style={{
              padding: '0.5rem 1rem 0.75rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                ...MONO,
                fontSize: '11px',
                color: 'var(--color-win)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              🔥 SEQUÊNCIA DE ACERTOS
            </span>
            {Object.entries(SCOUT_META).map(([key, { emoji, label }]) => (
              <span
                key={key}
                style={{
                  ...MONO,
                  fontSize: '11px',
                  color: 'var(--color-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {emoji} {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
