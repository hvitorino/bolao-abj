'use client'

import { useState } from 'react'
import type { BracketSlotWithGame } from '@/lib/types/game'
import type { Prediction } from '@/lib/types/prediction'
import { getTeamFlag } from '@/lib/flags'
import GameAnaliseDrawer from '@/components/bolao/GameAnaliseDrawer'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ── Constants ─────────────────────────────────────────────────────

/** Card height in px (used to compute connector SVG positions) */
const CARD_H = 36
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

/** Returns the display label for a side: flag + code for teams, short text for empty slots */
function sideLabel(slot: BracketSlotWithGame, side: 'home' | 'away'): string {
  const g = slot.game
  if (g) {
    const code = side === 'home' ? g.home_team_code : g.away_team_code
    return getTeamFlag(code) + ' ' + code
  }
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

function gameCode(slot: BracketSlotWithGame, side: 'home' | 'away'): string {
  const g = slot.game
  if (g) return side === 'home' ? g.home_team_code : g.away_team_code
  return ''
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

function columnHeight(node: BracketSlotWithGame): number {
  if (node.children.length === 0) return CARD_H
  const childrenTotal = node.children.reduce((sum, c) => sum + columnHeight(c), 0)
  const gaps = (node.children.length - 1) * CHILD_GAP
  return childrenTotal + gaps
}

// ── Prediction color helper ───────────────────────────────────────

function predictionColor(game: BracketSlotWithGame['game'], pred: Prediction | null | undefined): string {
  if (!game || !pred || game.status === 'pending') return 'var(--color-muted)'
  if (game.home_score == null || game.away_score == null) return 'var(--color-muted)'
  if (pred.home_score === game.home_score && pred.away_score === game.away_score) return 'var(--color-win)'
  // Check if hit winner (for knockout, winner matters most)
  const actualWinner = game.home_score > game.away_score ? game.home_team_code
    : game.away_score > game.home_score ? game.away_team_code : null
  const predWinner = pred.home_score > pred.away_score ? game.home_team_code
    : pred.away_score > pred.home_score ? game.away_team_code : null
  if (actualWinner && actualWinner === predWinner) return 'var(--color-accent)'
  return 'var(--color-error)'
}

// ── Compact Slot Card ─────────────────────────────────────────────

function CompactSlotCard({
  slot,
  prediction,
  onGameClick,
}: {
  slot: BracketSlotWithGame
  prediction?: Prediction | null
  onGameClick?: (gameId: string) => void
}) {
  const status = slotStatus(slot)
  const isLive = status === 'live'
  const isFinished = status === 'finished'
  const isPending = status === 'pending'
  const hasGame = !!slot.game

  const winner = winnerCode(slot)
  const homeLabel = sideLabel(slot, 'home')
  const awayLabel = sideLabel(slot, 'away')
  const homeCode = gameCode(slot, 'home')
  const awayCode = gameCode(slot, 'away')
  const score = scoreStr(slot)

  // Border color by status (empty=default, pending=blue, live=red, finished=green)
  let borderColor = 'var(--color-border)'
  if (isPending) borderColor = 'var(--color-secondary)'
  else if (isLive) borderColor = 'var(--color-live)'
  else if (isFinished) borderColor = 'var(--color-primary)'

  const scoreColor = isLive
    ? 'var(--color-live)'
    : isFinished
      ? 'var(--color-accent)'
      : 'var(--color-muted)'

  const predColor = predictionColor(slot.game, prediction)

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: 'var(--color-surface)',
        padding: '0.1rem 0.3rem',
        fontFamily: FONT,
        fontSize: '10px',
        lineHeight: 1.3,
        minWidth: '120px',
        overflow: 'hidden',
        ...(hasGame && onGameClick
          ? { cursor: 'pointer' }
          : {}),
      }}
      onClick={hasGame && onGameClick ? () => onGameClick(slot.game!.id) : undefined}
    >
      {/* Main row: home — score — away */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.25rem',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontWeight: winner === homeCode ? 'bold' : 'normal',
            color: winner === homeCode ? 'var(--color-accent)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
          title={slot.game?.home_team ?? homeLabel}
        >
          {homeLabel}
        </span>

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

        <span
          style={{
            fontWeight: winner === awayCode ? 'bold' : 'normal',
            color: winner === awayCode ? 'var(--color-accent)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'right',
            minWidth: 0,
          }}
          title={slot.game?.away_team ?? awayLabel}
        >
          {awayLabel}
        </span>
      </div>

      {/* Prediction / placeholder row (always same height for consistency) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '0.08rem',
          paddingTop: '0.08rem',
          borderTop: `1px dashed var(--color-border)`,
          fontSize: '9px',
          minHeight: '12px',
          alignItems: 'center',
          color: predColor,
        }}
      >
        {prediction
          ? `${prediction.home_score}×${prediction.away_score}`
          : hasGame
            ? '-×-'
            : ''}
      </div>
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

function BracketConnector({
  node,
  extraTarget = false,
}: {
  node: BracketSlotWithGame
  /** If true, draws a second horizontal line going right (for 3RD next to FINAL) */
  extraTarget?: boolean
}) {
  const children = node.children
  if (children.length === 0) return null

  const totalHeight = columnHeight(node)
  const childHeights = children.map((c) => columnHeight(c))

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
        <line x1="6" y1={firstCenter} x2="6" y2={lastCenter} stroke="var(--color-border)" strokeWidth="1" />
        {/* Main horizontal line to parent (right) */}
        <line x1="6" y1={midY} x2="12" y2={midY} stroke="var(--color-border)" strokeWidth="1" />
        {/* Extra horizontal line for 3RD (below main) */}
        {extraTarget && (
          <line x1="6" y1={midY + 16} x2="12" y2={midY + 16} stroke="var(--color-border)" strokeWidth="1" />
        )}
        {/* Horizontal lines to each child (left) */}
        {childCenters.map((cy, i) => (
          <line key={i} x1="0" y1={cy} x2="6" y2={cy} stroke="var(--color-border)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  )
}

// ── Recursive bracket column ──────────────────────────────────────

function BracketColumn({
  node,
  predictionMap,
  onGameClick,
}: {
  node: BracketSlotWithGame
  predictionMap: Record<string, Prediction>
  onGameClick?: (gameId: string) => void
}) {
  const hasChildren = node.children.length > 0

  if (!hasChildren) {
    const pred = node.game ? predictionMap[node.game.id] : undefined
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <CompactSlotCard slot={node} prediction={pred} onGameClick={onGameClick} />
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
          <BracketColumn key={child.id} node={child} predictionMap={predictionMap} onGameClick={onGameClick} />
        ))}
      </div>

      {/* Connector lines */}
      <BracketConnector node={node} />

      {/* Current node card (right) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <PhaseLabel text={node.phase} />
        <CompactSlotCard slot={node} prediction={node.game ? predictionMap[node.game.id] : undefined} onGameClick={onGameClick} />
      </div>
    </div>
  )
}

// ── Final + 3rd Place merged column ───────────────────────────────

function FinalAnd3rdColumn({
  final,
  third,
  predictionMap,
  onGameClick,
}: {
  final: BracketSlotWithGame
  third: BracketSlotWithGame
  predictionMap: Record<string, Prediction>
  onGameClick?: (gameId: string) => void
}) {
  const sfChildren = final.children // SF-01, SF-02

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      {/* SF subtree (left) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${CHILD_GAP}px`,
          alignItems: 'stretch',
        }}
      >
        {sfChildren.map((child) => (
          <BracketColumn key={child.id} node={child} predictionMap={predictionMap} onGameClick={onGameClick} />
        ))}
      </div>

      {/* Connector with extra line for 3RD */}
      <BracketConnector node={final} extraTarget />

      {/* FINAL + 3RD stacked (right) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        {/* FINAL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PhaseLabel text={final.phase} />
          <CompactSlotCard slot={final} prediction={final.game ? predictionMap[final.game.id] : undefined} onGameClick={onGameClick} />
        </div>

        {/* 3RD PLACE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PhaseLabel text={third.phase} />
          <CompactSlotCard slot={third} prediction={third.game ? predictionMap[third.game.id] : undefined} onGameClick={onGameClick} />
        </div>
      </div>
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────

interface BracketTreeProps {
  roots: BracketSlotWithGame[]
  predictions?: Record<string, Prediction>
  groupId?: string
  currentUserId?: string
}

export function BracketTree({ roots, predictions, groupId, currentUserId }: BracketTreeProps) {
  const predictionMap = predictions ?? {}
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

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

  // Separate FINAL and 3RD from other roots so they render in the same column
  const finalRoot = roots.find((r) => r.label === 'FINAL')
  const thirdRoot = roots.find((r) => r.label === '3RD')
  const otherRoots = roots.filter((r) => r.label !== 'FINAL' && r.label !== '3RD')

  return (
    <>
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
          {/* Other roots (should be none in practice) */}
          {otherRoots.map((root) => (
            <BracketColumn key={root.id} node={root} predictionMap={predictionMap} onGameClick={setSelectedGameId} />
          ))}

          {/* FINAL + 3RD merged column */}
          {finalRoot && thirdRoot && (
            <FinalAnd3rdColumn final={finalRoot} third={thirdRoot} predictionMap={predictionMap} onGameClick={setSelectedGameId} />
          )}

          {/* If only FINAL exists (no 3RD), render solo */}
          {finalRoot && !thirdRoot && (
            <BracketColumn node={finalRoot} predictionMap={predictionMap} onGameClick={setSelectedGameId} />
          )}

          {/* If only 3RD exists (no FINAL), render solo */}
          {thirdRoot && !finalRoot && (
            <BracketColumn node={thirdRoot} predictionMap={predictionMap} onGameClick={setSelectedGameId} />
          )}
        </div>
      </div>

      {/* Game detail drawer */}
      {groupId && currentUserId && (
        <GameAnaliseDrawer
          gameId={selectedGameId}
          groupId={groupId}
          currentUserId={currentUserId}
          onClose={() => setSelectedGameId(null)}
        />
      )}
    </>
  )
}
