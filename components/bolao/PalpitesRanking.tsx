'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { PalpitesRankingRow } from './PalpitesRankingRow'
import type { RankingParticipantDetail, LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

interface PalpitesRankingProps {
  currentUserId: string
  rankingWithDetails: RankingParticipantDetail[]
  liveGames: LiveGameWithPrediction[]
  loading: boolean
  error: string | null
  lastPolledAt: Date | null
}

export function PalpitesRanking({
  currentUserId,
  rankingWithDetails,
  liveGames,
  loading,
  error,
  lastPolledAt,
}: PalpitesRankingProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // FLIP state
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevPositions = useRef<Map<string, DOMRect>>(new Map())
  const isFirstRender = useRef(true)

  const capturePositions = () => {
    const map = new Map<string, DOMRect>()
    rowRefs.current.forEach((el, userId) => {
      if (el) map.set(userId, el.getBoundingClientRect())
    })
    prevPositions.current = map
  }

  // FLIP: executa após cada mudança de rankingWithDetails
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      capturePositions()
      return
    }

    const elements: Array<{ el: HTMLDivElement; deltaY: number }> = []

    rowRefs.current.forEach((el, userId) => {
      if (!el) return
      const first = prevPositions.current.get(userId)
      if (!first) return
      const last = el.getBoundingClientRect()
      const deltaY = first.top - last.top
      if (deltaY !== 0) elements.push({ el, deltaY })
    })

    if (elements.length === 0) {
      capturePositions()
      return
    }

    // INVERT
    elements.forEach(({ el, deltaY }) => {
      el.style.transition = 'none'
      el.style.transform = `translateY(${deltaY}px)`
    })

    // Reflow forçado
    void elements[0]?.el.getBoundingClientRect()

    // PLAY
    elements.forEach(({ el }) => {
      el.style.transition = 'transform 350ms ease-in-out'
      el.style.transform = ''
    })

    capturePositions()
  }, [rankingWithDetails])

  const getRowRef = (userId: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(userId, el)
    else rowRefs.current.delete(userId)
  }

  const handleToggle = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId))
  }

  const hasLiveGames = liveGames.length > 0

  // ---------- Estados de loading / error / empty ----------

  if (loading) {
    return (
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
    )
  }

  if (error) {
    return (
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
    )
  }

  if (rankingWithDetails.length === 0) {
    return (
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
        NENHUM PARTICIPANTE
      </div>
    )
  }

  // ---------- Header da tabela ----------

  const thStyle: React.CSSProperties = {
    ...MONO,
    padding: '0.35rem 0.5rem',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-muted)',
    fontWeight: 'normal',
    display: 'flex',
    alignItems: 'center',
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho da seção com label e próxima atualização */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          RANKING
        </span>
        <NextUpdateCountdown intervalMs={10_000} lastPolledAt={lastPolledAt} />
      </div>

      {/* Cabeçalho das colunas */}
      <div
        role="rowgroup"
        style={{
          borderBottom: '2px solid var(--color-border)',
        }}
      >
        <div
          role="row"
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            role="columnheader"
            style={{ ...thStyle, width: '2.5rem', justifyContent: 'flex-end' }}
          >
            #
          </div>
          <div role="columnheader" style={{ ...thStyle, flex: 1 }}>
            PARTICIPANTE
          </div>
          <div
            role="columnheader"
            style={{ ...thStyle, width: '4rem', justifyContent: 'center' }}
          >
            PTS
          </div>
          <div
            role="columnheader"
            style={{ ...thStyle, width: '1.5rem', justifyContent: 'center' }}
          >
            &nbsp;
          </div>
        </div>
      </div>

      {/* Corpo — rows animáveis com FLIP */}
      <div role="table" aria-label="Ranking dos participantes">
        <div role="rowgroup">
          {rankingWithDetails.map((participant: RankingParticipantDetail) => (
            <div
              key={participant.userId}
              ref={getRowRef(participant.userId)}
              style={{ transition: 'transform 350ms ease-in-out' }}
            >
              <PalpitesRankingRow
                participant={participant}
                isCurrentUser={participant.userId === currentUserId}
                isLeader={participant.rank_position === 1 && participant.total_points > 0}
                isExpanded={expandedUserId === participant.userId}
                onToggle={() => handleToggle(participant.userId)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé */}
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
        {hasLiveGames && (
          <span style={{ ...MONO, fontSize: '11px', color: 'var(--color-live)' }}>
            ██ AO VIVO
          </span>
        )}
        {lastPolledAt && (
          <span
            style={{
              ...MONO,
              fontSize: '11px',
              color: 'var(--color-muted)',
              marginLeft: 'auto',
            }}
          >
            ⏱{' '}
            {lastPolledAt.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Contador regressivo de próxima atualização
// --------------------------------------------------------------------------

function NextUpdateCountdown({
  intervalMs,
  lastPolledAt,
}: {
  intervalMs: number
  lastPolledAt: Date | null
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!lastPolledAt) return

    const tick = () => {
      const elapsed = Date.now() - lastPolledAt.getTime()
      const remaining = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000))
      setSecondsLeft(remaining)
    }

    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [intervalMs, lastPolledAt])

  if (secondsLeft === null) return null

  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '10px',
        color: 'var(--color-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      PRÓX. ATU. EM {secondsLeft}S
    </span>
  )
}
