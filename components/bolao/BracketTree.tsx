'use client'

import type { BracketSlotWithGame } from '@/lib/types/game'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

function formatTeam(slot: BracketSlotWithGame, side: 'home' | 'away'): string {
  const game = slot.game
  if (game) {
    return side === 'home' ? game.home_team_code : game.away_team_code
  }
  // Show source description if no team yet
  const source = side === 'home' ? slot.source_home : slot.source_away
  return source ?? '???'
}

function formatScore(slot: BracketSlotWithGame): string {
  const game = slot.game
  if (!game) return '—'
  if (game.status === 'pending') {
    const d = new Date(game.match_date)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  return `${game.home_score ?? '-'}×${game.away_score ?? '-'}`
}

function slotStatus(slot: BracketSlotWithGame): 'empty' | 'pending' | 'live' | 'finished' {
  if (!slot.game) return 'empty'
  if (slot.game.status === 'live') return 'live'
  if (slot.game.status === 'finished') return 'finished'
  return 'pending'
}

/** Returns the winner team code, or null if not determined yet */
function winnerCode(slot: BracketSlotWithGame): string | null {
  const g = slot.game
  if (!g || g.status !== 'finished' || g.home_score == null || g.away_score == null) return null
  if (g.home_score > g.away_score) return g.home_team_code
  if (g.away_score > g.home_score) return g.away_team_code
  return null // draw (shouldn't happen in knockout, but handle)
}

interface SlotCardProps {
  slot: BracketSlotWithGame
}

function SlotCard({ slot }: SlotCardProps) {
  const status = slotStatus(slot)

  let borderColor = 'var(--color-border)'
  if (status === 'live') borderColor = 'var(--color-live)'
  else if (status === 'finished') borderColor = 'var(--color-primary)'

  const isLive = status === 'live'

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: 'var(--color-surface)',
        padding: '0.4rem 0.5rem',
        minWidth: '140px',
        fontFamily: FONT,
        fontSize: '11px',
        lineHeight: 1.4,
      }}
    >
      {/* Teams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: winnerCode(slot) === slot.game?.home_team_code ? 'bold' : 'normal',
          color: winnerCode(slot) === slot.game?.home_team_code ? 'var(--color-accent)' : 'var(--color-text)',
        }}>
          <span>{formatTeam(slot, 'home')}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: winnerCode(slot) === slot.game?.away_team_code ? 'bold' : 'normal',
          color: winnerCode(slot) === slot.game?.away_team_code ? 'var(--color-accent)' : 'var(--color-text)',
        }}>
          <span>{formatTeam(slot, 'away')}</span>
        </div>
      </div>

      {/* Score / Status */}
      <div style={{
        marginTop: '0.3rem',
        textAlign: 'center',
        color: isLive ? 'var(--color-live)' : status === 'finished' ? 'var(--color-accent)' : 'var(--color-muted)',
        fontSize: '13px',
        fontWeight: 'bold',
      }}>
        {isLive ? (
          <span className="blink">{formatScore(slot)} ██ AO VIVO</span>
        ) : (
          formatScore(slot)
        )}
      </div>

      {/* Phase label for empty slots */}
      {status === 'empty' && (
        <div style={{
          marginTop: '0.2rem',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: '9px',
          textTransform: 'uppercase',
        }}>
          {slot.phase.split(' ')[0]}
        </div>
      )}
    </div>
  )
}

interface BracketTreeProps {
  roots: BracketSlotWithGame[]
}

export function BracketTree({ roots }: BracketTreeProps) {
  if (roots.length === 0) {
    return (
      <div style={{
        fontFamily: FONT,
        color: 'var(--color-muted)',
        textAlign: 'center',
        padding: '2rem 0',
        fontSize: '13px',
      }}>
        NENHUM SLOT DE CHAVEAMENTO ENCONTRADO
      </div>
    )
  }

  return (
    <div
      style={{
        fontFamily: FONT,
        overflowX: 'auto',
        padding: '1rem 0',
        scrollbarWidth: 'none',
      }}
    >
      <style>{`
        .bracket-tree::-webkit-scrollbar { display: none; }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      <div
        className="bracket-tree"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '1.5rem',
          minWidth: 'max-content',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 1rem',
        }}
      >
        {roots.map((root) => (
          <BracketColumn key={root.id} node={root} />
        ))}
      </div>
    </div>
  )
}

/** Recursively renders a bracket column (node + its children to the left) */
function BracketColumn({ node, depth = 0 }: { node: BracketSlotWithGame; depth?: number }) {
  const hasChildren = node.children.length > 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '1rem',
    }}>
      {/* Left side: children (recursive) */}
      {hasChildren && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: node.children.length > 2 ? '0.5rem' : '1.5rem',
          alignItems: 'flex-end',
        }}>
          {node.children.map((child) => (
            <BracketColumn key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {/* Connector lines (SVG or simple CSS) */}
      {hasChildren && <BracketConnector childCount={node.children.length} />}

      {/* Current slot card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Phase header */}
        <div style={{
          color: 'var(--color-muted)',
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '0.3rem',
          textAlign: 'center',
        }}>
          {node.phase}
        </div>
        <SlotCard slot={node} />
      </div>
    </div>
  )
}

/** Simple connector lines between children and parent */
function BracketConnector({ childCount }: { childCount: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '20px',
      flexShrink: 0,
    }}>
      <svg width="20" height={childCount * 50} viewBox={`0 0 20 ${childCount * 50}`}>
        {/* Vertical line */}
        <line x1="10" y1="0" x2="10" y2={childCount * 50} stroke="var(--color-border)" strokeWidth="1" />
        {/* Horizontal line to parent */}
        <line x1="10" y1={(childCount * 50) / 2} x2="20" y2={(childCount * 50) / 2} stroke="var(--color-border)" strokeWidth="1" />
        {/* Horizontal line to children */}
        <line x1="0" y1={(childCount * 50) / 2} x2="10" y2={(childCount * 50) / 2} stroke="var(--color-border)" strokeWidth="1" />
      </svg>
    </div>
  )
}
