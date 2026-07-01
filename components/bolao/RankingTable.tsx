'use client'

import { useState, useRef } from 'react'
import { useRankingRealtime } from '@/lib/hooks/useRankingRealtime'
import { useLivePointsByUser } from '@/lib/hooks/useLivePointsByUser'
import type { RankingEntry, ScoutCounts } from '@/lib/types/ranking'
import { RankingRow } from './RankingRow'
import { SCOUT_META } from './ScoutBadges'

interface RankingTableProps {
  currentUserId: string
  groupId: string
}

export const SCOUT_FILTERS: Record<string, { label: string; key: keyof ScoutCounts }> = {
  exact:         { label: 'PLACAR CRAVADO',      key: 'exact' },
  winner:        { label: 'ACERTOU VENCEDOR',     key: 'winner' },
  winner_score:  { label: 'GOLS DO VENCEDOR',     key: 'winner_score' },
  diff:          { label: 'DIFERENÇA DE GOLS',    key: 'diff' },
  loser_score:   { label: 'GOLS DO PERDEDOR',     key: 'loser_score' },
  goleada:       { label: 'GOLEADA',              key: 'goleada' },
}

// Ordem cíclica para navegação por gestos (swipe)
const SCOUT_ORDER: (string | null)[] = [
  null,        // GERAL
  'exact',     // PLACAR CRAVADO
  'winner',    // ACERTOU VENCEDOR
  'winner_score', // GOLS DO VENCEDOR
  'diff',      // DIFERENÇA DE GOLS
  'loser_score',  // GOLS DO PERDEDOR
  'goleada',   // GOLEADA
]

// Reordena o ranking pela contagem do scout selecionado (client-side).
// Aplica empate: mesma contagem = mesma posição (RANK).
function applyScoutFilter(
  ranking: RankingEntry[],
  activeScout: string
): RankingEntry[] {
  const key = SCOUT_FILTERS[activeScout].key

  const sorted = [...ranking].sort((a, b) => {
    const countA = a.scout_counts?.[key] ?? 0
    const countB = b.scout_counts?.[key] ?? 0
    if (countB !== countA) return countB - countA
    // Desempate: total_points desc
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    // Desempate final: nome A-Z
    return a.participant_name.localeCompare(b.participant_name, 'pt-BR')
  })

  let previousRank = 0
  let previousCount: number | null = null

  return sorted.map((entry, index) => {
    const count = entry.scout_counts?.[key] ?? 0
    const rank =
      previousCount !== null && count === previousCount
        ? previousRank
        : index + 1

    previousRank = rank
    previousCount = count

    return { ...entry, rank_position: rank }
  })
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
  const { ranking, loading, error, lastUpdatedAt } = useRankingRealtime(groupId)
  const { livePoints, loading: livePointsLoading } = useLivePointsByUser(groupId)
  const [activeScout, setActiveScout] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)

  // Navegação por gestos (swipe horizontal)
  function cycleScout(direction: 1 | -1) {
    const currentIdx = SCOUT_ORDER.indexOf(activeScout)
    const nextIdx = (currentIdx + direction + SCOUT_ORDER.length) % SCOUT_ORDER.length
    setActiveScout(SCOUT_ORDER[nextIdx])
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0].clientX
    const deltaX = endX - touchStartX.current
    touchStartX.current = null

    // Ignora scroll vertical — só swipe com deslocamento horizontal mínimo de 50px
    if (Math.abs(deltaX) < 50) return

    cycleScout(deltaX > 0 ? -1 : 1)
  }

  const hasLivePoints = Object.values(livePoints).some((points) => points > 0)
  const adjustedRanking = applyLivePoints(ranking, livePoints)

  // Aplica filtro de scout (client-side) após live points
  const displayRanking = activeScout
    ? applyScoutFilter(adjustedRanking, activeScout)
    : adjustedRanking

  const scoutKey = activeScout ? SCOUT_FILTERS[activeScout].key : undefined

  if (loading || livePointsLoading) {
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
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Chips de seleção de scout */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <button
          onClick={() => setActiveScout(null)}
          style={{
            ...MONO,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0.25rem 0.6rem',
            border: '1px solid var(--color-border)',
            backgroundColor: activeScout === null ? 'var(--color-accent)' : 'transparent',
            color: activeScout === null ? 'var(--color-bg)' : 'var(--color-muted)',
            fontWeight: activeScout === null ? 'bold' : 'normal',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          GERAL
        </button>
        {Object.entries(SCOUT_FILTERS).map(([slug, { label }]) => (
          <button
            key={slug}
            onClick={() => setActiveScout(slug)}
            style={{
              ...MONO,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.25rem 0.6rem',
              border: '1px solid var(--color-border)',
              backgroundColor: activeScout === slug ? 'var(--color-accent)' : 'transparent',
              color: activeScout === slug ? 'var(--color-bg)' : 'var(--color-muted)',
              fontWeight: activeScout === slug ? 'bold' : 'normal',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-surface)',
              borderBottom: '2px solid var(--color-border)',
            }}
          >
            <th style={{ ...thStyle, textAlign: 'right', width: '2.5rem' }}>#</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>PARTICIPANTE</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '5rem' }}>
              {scoutKey ? 'TOTAL' : 'PONTOS'}
            </th>
            {!scoutKey && (
              <th style={{ ...thStyle, textAlign: 'center', width: '3.5rem' }}>PALP.</th>
            )}
            <th
              className="hidden md:table-cell"
              style={{ ...thStyle, textAlign: 'center', width: '5rem' }}
            >
              APROVEIT.
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRanking.map((entry) => (
            <RankingRow
              key={entry.user_id}
              entry={entry}
              isCurrentUser={entry.user_id === currentUserId}
              isLeader={entry.rank_position === 1 && (scoutKey ? (entry.scout_counts?.[scoutKey] ?? 0) : entry.total_points) > 0}
              hidePalpites={!!scoutKey}
              scoutKey={scoutKey}
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
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-accent)' }}>► LÍDER</span>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-primary)' }}>■ VOCÊ</span>
        <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-muted)' }}>
          {ranking.length} PARTICIPANTE{ranking.length !== 1 ? 'S' : ''}
        </span>
        {hasLivePoints && (
          <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-live)' }}>
            ██ AO VIVO
          </span>
        )}
        {lastUpdatedAt && (
          <span
            style={{ ...MONO, fontSize: '11px', color: 'var(--color-muted)', marginLeft: 'auto' }}
          >
            ⏱{' '}
            {lastUpdatedAt.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Legenda dos scouts e streak */}
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
    </div>
  )
}
