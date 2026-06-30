'use client'

import type { BracketSlotWithGame } from '@/lib/types/game'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ── Constants ─────────────────────────────────────────────────────

/** Card height in px (used to compute connector SVG positions) */
const CARD_H = 20
/** Gap between children inside a column, in px */
const CHILD_GAP = 4

// ── Slot helpers ──────────────────────────────────────────────────

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
  // For empty slots, derive short code from source description
  const source = side === 'home' ? slot.source_home : slot.source_away
  if (source) {
    const slotRef = source.match(/[A-Z]+\d*-?\d+/)
    if (slotRef) return slotRef[0]
    const groupRef = source.match(/([12])º Grupo ([A-L])/)
    if (groupRef) return `${groupRef[1]}${groupRef[2]}`
    if (source.startsWith('Melhor 3º')) return '3º+'
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

// ── Column-height calculator (for SVG connectors) ─────────────────

/** Recursively compute the rendered height of a subtree column */
function columnHeight(node: BracketSlotWithGame): number {
  if (node.children.length === 0) return CARD_H
  const childrenTotal = node.children.reduce((sum, c) => sum + columnHeight(c), 0)
  const gaps = (node.children.length - 1) * CHILD_GAP
  return childrenTotal + gaps
}

// ── Compact Slot Card ─────────────────────────────────────────────

function CompactSlotCard({ slot }: { slot: BracketSlotWithGame }) {
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
        gap: '0.25rem',
        border: `1px solid ${borderColor}`,
        backgroundColor: 'var(--color-surface)',
        padding: '0.1rem 0.3rem',
        fontFamily: FONT,
        fontSize: '10px',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        minWidth: '115px',
      }}
    >
      {/* Home */}
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
          fontSize: '10px',
          flexShrink: 0,
        }}
      >
        {isLive ? <span className="blink">{score}</span> : score}
      </span>

      {/* Away */}
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

// ── Phase label ───────────────────────────────────────────────────

function PhaseLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        color: 'var(--color-muted)',
        fontSize: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: 'center',
        marginBottom: '0.15rem',
      }}
    >
      {text}
    </div>
  )
}

// ── Bracket connector SVG ─────────────────────────────────────────

function BracketConnector({ node }: { node: BracketSlotWithGame }) {
  const children = node.children
  if (children.length === 0) return null

  const totalHeight = columnHeight(node)
  const childHeights = children.map((c) => columnHeight(c))

  // Compute Y positions of each child's vertical center
  const childCenters: number[] = []
  let y = 0
  for (let i = 0; i < children.length; i++) {
    const center = y + childHeights[i] / 2
    childCenters.push(center)
    y += childHeights[i] + CHILD_GAP
  }

  const firstCenter = childCenters[0]
  const lastCenter = childCenters[childCenters.length - 1]
  const midY = (firstCenter + lastCenter) / 2

  return (
    <div
      style={{
        width: 12,
        flexShrink: 0,
        height: totalHeight,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <svg width="12" height={totalHeight} viewBox={`0 0 12 ${totalHeight}`}>
        {/* Vertical line connecting children */}
        <line
          x1="6" y1={firstCenter}
          x2="6" y2={lastCenter}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        {/* Horizontal line to parent (right) */}
        <line
          x1="6" y1={midY}
          x2="12" y2={midY}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        {/* Horizontal lines to each child (left) */}
        {childCenters.map((cy, i) => (
          <line
            key={i}
            x1="0" y1={cy}
            x2="6" y2={cy}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  )
}

// ── Recursive bracket column ──────────────────────────────────────

function BracketColumn({ node }: { node: BracketSlotWithGame }) {
  const hasChildren = node.children.length > 0

  if (!hasChildren) {
    // Leaf slot (R32 or orphan like 3RD)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <CompactSlotCard slot={node} />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      {/* Children column (left) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${CHILD_GAP}px`,
          alignItems: 'stretch',
        }}
      >
        {node.children.map((child) => (
          <BracketColumn key={child.id} node={child} />
        ))}
      </div>

      {/* Connector lines */}
      <BracketConnector node={node} />

      {/* Current node card (right) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <PhaseLabel text={node.phase} />
        <CompactSlotCard slot={node} />
      </div>
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────

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

  return (
    <div
      style={{
        fontFamily: FONT,
        overflowX: 'auto',
        padding: '0.25rem 0',
        scrollbarWidth: 'none',
      }}
    >
      <style>{`
        .bracket-scroll::-webkit-scrollbar { display: none; }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      <div
        className="bracket-scroll"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.5rem',
          minWidth: 'max-content',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: '0 0.5rem',
        }}
      >
        {roots.map((root) => (
          <BracketColumn key={root.id} node={root} />
        ))}
      </div>
    </div>
  )
}
