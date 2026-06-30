'use client'

import type { BracketSlotWithGame } from '@/lib/types/game'
import { PHASE_ORDER } from '@/lib/bracket'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ── Helpers ──────────────────────────────────────────────────────

function winnerCode(slot: BracketSlotWithGame): string | null {
  const g = slot.game
  if (!g || g.status !== 'finished' || g.home_score == null || g.away_score == null) return null
  if (g.home_score > g.away_score) return g.home_team_code
  if (g.away_score > g.home_score) return g.away_team_code
  return null
}

function teamCode(slot: BracketSlotWithGame, side: 'home' | 'away'): string {
  const g = slot.game
  if (g) return side === 'home' ? g.home_team_code : g.away_team_code
  // For empty slots, use source description or slot label as short identifier
  const source = side === 'home' ? slot.source_home : slot.source_away
  if (source) {
    // "Venc. R32-01" → "R32-01"
    const slotRef = source.match(/[A-Z]+\d*-?\d+/)
    if (slotRef) return slotRef[0]
    // "1º Grupo A" → "1A"
    const groupRef = source.match(/([12])º Grupo ([A-L])/)
    if (groupRef) return `${groupRef[1]}${groupRef[2]}`
    // "Melhor 3º ..." → "3º+"
    if (source.startsWith('Melhor 3º')) return '3º+'
    // "Perd. SF-01" → "LSF-01"
    if (source.startsWith('Perd.')) {
      const ref = source.match(/[A-Z]+\d*-?\d+/)
      return ref ? `L${ref[0]}` : source.substring(0, 6)
    }
    return source.substring(0, 6)
  }
  return '???'
}

function scoreStr(slot: BracketSlotWithGame): string {
  const g = slot.game
  if (!g) return '—'
  if (g.status === 'pending') {
    const d = new Date(g.match_date)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  return `${g.home_score ?? '-'}×${g.away_score ?? '-'}`
}

type SlotStatus = 'empty' | 'pending' | 'live' | 'finished'
function slotStatus(slot: BracketSlotWithGame): SlotStatus {
  if (!slot.game) return 'empty'
  if (slot.game.status === 'live') return 'live'
  if (slot.game.status === 'finished') return 'finished'
  return 'pending'
}

// ── Collect all nodes from tree, indexed by phase ────────────────

function collectByPhase(roots: BracketSlotWithGame[]): Map<string, BracketSlotWithGame[]> {
  const map = new Map<string, BracketSlotWithGame[]>()
  const visited = new Set<string>()

  function walk(node: BracketSlotWithGame) {
    if (visited.has(node.id)) return
    visited.add(node.id)

    const phase = node.phase
    if (!map.has(phase)) map.set(phase, [])
    map.get(phase)!.push(node)

    for (const child of node.children) {
      walk(child)
    }
  }

  for (const root of roots) {
    walk(root)
  }

  // Sort within each phase by position
  map.forEach((nodes) => {
    nodes.sort((a, b) => a.position - b.position)
  })

  return map
}

// ── Compact Match Card ───────────────────────────────────────────

function CompactMatchCard({ slot }: { slot: BracketSlotWithGame }) {
  const status = slotStatus(slot)
  const isLive = status === 'live'
  const isFinished = status === 'finished'

  const winner = winnerCode(slot)
  const homeCode = teamCode(slot, 'home')
  const awayCode = teamCode(slot, 'away')
  const score = scoreStr(slot)

  let borderColor = 'var(--color-border)'
  if (isLive) borderColor = 'var(--color-live)'
  else if (isFinished) borderColor = 'var(--color-primary)'

  const scoreColor = isLive
    ? 'var(--color-live)'
    : isFinished
      ? 'var(--color-accent)'
      : 'var(--color-muted)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.3rem',
        border: `1px solid ${borderColor}`,
        backgroundColor: 'var(--color-surface)',
        padding: '0.15rem 0.35rem',
        fontFamily: FONT,
        fontSize: '10px',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {/* Home team */}
      <span
        style={{
          fontWeight: winner === slot.game?.home_team_code ? 'bold' : 'normal',
          color: winner === slot.game?.home_team_code ? 'var(--color-accent)' : 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {homeCode}
      </span>

      {/* Score */}
      <span
        style={{
          color: scoreColor,
          fontWeight: 'bold',
          fontSize: '11px',
          flexShrink: 0,
        }}
      >
        {isLive ? (
          <span className="blink">{score}</span>
        ) : (
          score
        )}
      </span>

      {/* Away team */}
      <span
        style={{
          fontWeight: winner === slot.game?.away_team_code ? 'bold' : 'normal',
          color: winner === slot.game?.away_team_code ? 'var(--color-accent)' : 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'right',
          minWidth: 0,
        }}
      >
        {awayCode}
      </span>
    </div>
  )
}

// ── BracketTree (public export) ──────────────────────────────────

interface BracketTreeProps {
  roots: BracketSlotWithGame[]
}

export function BracketTree({ roots }: BracketTreeProps) {
  if (roots.length === 0) {
    return (
      <div
        style={{
          fontFamily: FONT,
          color: 'var(--color-muted)',
          textAlign: 'center',
          padding: '2rem 0',
          fontSize: '13px',
        }}
      >
        NENHUM SLOT DE CHAVEAMENTO ENCONTRADO
      </div>
    )
  }

  const phaseMap = collectByPhase(roots)
  const orderedPhases = PHASE_ORDER.filter((p) => phaseMap.has(p))

  return (
    <div
      style={{
        fontFamily: FONT,
        padding: '0.25rem 0',
      }}
    >
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        .blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        {orderedPhases.map((phase) => {
          const matches = phaseMap.get(phase)!
          return (
            <div key={phase}>
              {/* Phase header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: 'var(--color-accent)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.1rem',
                  marginBottom: '0.2rem',
                }}
              >
                <span>█</span>
                <span>{phase}</span>
                <span style={{ color: 'var(--color-muted)', fontWeight: 'normal', fontSize: '9px' }}>
                  {matches.length} {matches.length === 1 ? 'JOGO' : 'JOGOS'}
                </span>
              </div>

              {/* Match grid: 2 cols on md+, 1 col on mobile */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: '0.15rem',
                }}
              >
                {matches.map((match) => (
                  <CompactMatchCard key={match.id} slot={match} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
