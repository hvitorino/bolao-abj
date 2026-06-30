'use client'

import { useState, useCallback } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'
import { BracketTree } from '@/components/bolao/BracketTree'
import { buildBracketTree } from '@/lib/bracket'
import { createClient } from '@/lib/supabase/client'
import type { BracketSlot, BracketSlotWithGame, Game } from '@/lib/types/game'
import type { Prediction } from '@/lib/types/prediction'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

const KNOCKOUT_PHASES = [
  '16 avos de Final',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinal',
  'Terceiro Lugar',
  'Final',
]

interface PalpitesLiveCardProps {
  todayGames: LiveGameWithPrediction[]
  loading: boolean
  onGameClick: (gameId: string) => void
  groupId: string
  currentUserId: string
}

export function PalpitesLiveCard({ todayGames, loading, onGameClick, groupId, currentUserId }: PalpitesLiveCardProps) {
  // ── Bracket expansion state ──────────────────────────────────────
  const [bracketExpanded, setBracketExpanded] = useState(false)
  const [bracketRoots, setBracketRoots] = useState<BracketSlotWithGame[] | null>(null)
  const [bracketPredictions, setBracketPredictions] = useState<Record<string, Prediction>>({})
  const [bracketLoading, setBracketLoading] = useState(false)

  const isKnockoutDay = todayGames.length > 0 && KNOCKOUT_PHASES.includes(todayGames[0].phase)

  // ── Lazy fetch bracket data ─────────────────────────────────────
  const fetchBracketData = useCallback(async () => {
    if (bracketRoots !== null) return // already loaded
    setBracketLoading(true)
    try {
      const supabase = createClient()

      const [
        { data: slots },
        { data: games },
        { data: predictions },
      ] = await Promise.all([
        supabase.from('bracket_slots').select('*').order('phase').order('position'),
        supabase.from('games').select('*').not('bracket_slot_id', 'is', null),
        supabase.from('predictions').select('*').eq('user_id', currentUserId),
      ])

      const typedSlots = (slots ?? []) as BracketSlot[]
      const typedGames = (games ?? []) as Game[]

      // Build slot-id → game map
      const gameBySlotId: Record<string, Game> = {}
      for (const game of typedGames) {
        if (game.bracket_slot_id) {
          gameBySlotId[game.bracket_slot_id] = game
        }
      }

      // Build label → game map for buildBracketTree
      const gamesBySlotLabel: Record<string, Game | null> = {}
      for (const slot of typedSlots) {
        gamesBySlotLabel[slot.label] = gameBySlotId[slot.id] ?? null
      }

      const roots = buildBracketTree(typedSlots, gamesBySlotLabel)

      // Build game_id → prediction map
      const typedPredictions = (predictions ?? []) as Prediction[]
      const predMap: Record<string, Prediction> = {}
      for (const p of typedPredictions) {
        predMap[p.game_id] = p
      }

      setBracketRoots(roots)
      setBracketPredictions(predMap)
    } catch (err) {
      console.error('[PalpitesLiveCard] erro ao carregar bracket:', err)
    } finally {
      setBracketLoading(false)
    }
  }, [bracketRoots, currentUserId])

  // ── Toggle bracket ──────────────────────────────────────────────
  const toggleBracket = useCallback(() => {
    const next = !bracketExpanded
    setBracketExpanded(next)
    if (next) fetchBracketData()
  }, [bracketExpanded, fetchBracketData])

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...MONO, padding: '0.5rem', fontSize: '10px', color: 'var(--color-muted)', textAlign: 'center' }}>
        CARREGANDO...
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (todayGames.length === 0) {
    return (
      <div style={{ ...MONO, padding: '0.5rem', fontSize: '10px', color: 'var(--color-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        NENHUM JOGO HOJE
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding: '0.6rem 0.75rem',
      }}
    >
      {/* ── Header: round + expand icon ─────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
          position: 'relative',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-muted)',
          }}
        >
          {todayGames[0].round}
        </span>

        {isKnockoutDay && (
          <button
            onClick={toggleBracket}
            aria-label={bracketExpanded ? 'Recolher chaveamento' : 'Expandir chaveamento'}
            aria-expanded={bracketExpanded}
            style={{
              position: 'absolute',
              right: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0.15rem',
              color: 'var(--color-accent)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '16px',
              lineHeight: 1,
              opacity: bracketExpanded ? 1 : 0.85,
            }}
          >
            {bracketExpanded ? '⤡' : '⤢'}
          </button>
        )}
      </div>

      {/* ── Games grid ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}
      >
        {todayGames.map((game) => (
          <GameItem key={game.id} game={game} onGameClick={onGameClick} />
        ))}
      </div>

      {/* ── Bracket section (expanded) ──────────────────────────── */}
      {bracketExpanded && (
        <>
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              marginTop: '0.75rem',
              paddingTop: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '0.35rem',
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-muted)',
                }}
              >
                CHAVEAMENTO — MATA-MATA
              </span>

              <button
                onClick={toggleBracket}
                aria-label="Recolher chaveamento"
                style={{
                  position: 'absolute',
                  right: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 0.15rem',
                  color: 'var(--color-accent)',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '16px',
                  lineHeight: 1,
                }}
              >
                ⤡
              </button>
            </div>

            {bracketLoading ? (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '10px',
                  color: 'var(--color-muted)',
                  textAlign: 'center',
                  padding: '1rem 0',
                }}
              >
                CARREGANDO...
              </div>
            ) : bracketRoots && bracketRoots.length > 0 ? (
              <BracketTree
                roots={bracketRoots}
                predictions={bracketPredictions}
                groupId={groupId}
                currentUserId={currentUserId}
              />
            ) : bracketRoots && bracketRoots.length === 0 ? (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '10px',
                  color: 'var(--color-muted)',
                  textAlign: 'center',
                  padding: '0.5rem 0',
                }}
              >
                NENHUM SLOT DE CHAVEAMENTO ENCONTRADO
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function GameItem({
  game,
  onGameClick,
}: {
  game: LiveGameWithPrediction
  onGameClick: (gameId: string) => void
}) {
  const [isPressed, setIsPressed] = useState(false)
  const homeFlag = getTeamFlag(game.home_team_code)
  const awayFlag = getTeamFlag(game.away_team_code)

  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isPending = game.status === 'pending'

  const statusLabel = isLive ? '● AO VIVO' : isFinished ? '✓ ENC' : `◷ ${formatMatchTime(game.match_date)}`
  const statusColor = isLive
    ? 'var(--color-primary)'
    : isFinished
      ? 'var(--color-accent)'
      : 'var(--color-text)'

  const realScore = isPending ? '—×—' : `${game.home_score ?? '?'}×${game.away_score ?? '?'}`
  const predScore = game.myPrediction
    ? `${game.myPrediction.home_score}×${game.myPrediction.away_score}`
    : '—'

  return (
    <button
      onClick={() => onGameClick(game.id)}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      title="Ver análise"
      style={{
        ...MONO,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.1rem',
        opacity: 1,
        background: isPressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        border: 'none',
        outline: '1px solid rgba(90, 122, 106, 0.5)',
        boxShadow: isPressed ? 'none' : '0 2px 6px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        padding: '0.4rem 0.75rem',
        paddingTop: '1.75rem',
        borderRadius: '2px',
        transition: 'background 100ms ease, box-shadow 100ms ease',
      }}
    >
      {/* Indicador de edição — apenas para jogos pendentes */}
      {isPending && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            fontSize: '8px',
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          ✎
        </span>
      )}

      {/* Status */}
      <span
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          fontSize: '11px',
          color: statusColor,
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {statusLabel}
      </span>

      {/* Placar real: 🏴 2×1 🏴 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{homeFlag}</span>
        <span
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: isPending ? 'var(--color-muted)' : 'var(--color-accent)',
          }}
        >
          {realScore}
        </span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{awayFlag}</span>
      </div>

      {/* Palpite: só o placar, sem bandeiras */}
      <span
        style={{
          fontSize: '12px',
          color: game.myPrediction ? 'var(--color-text)' : 'var(--color-muted)',
        }}
      >
        {predScore}
      </span>
    </button>
  )
}

function formatMatchTime(matchDate: string): string {
  try {
    return new Date(matchDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—:——'
  }
}
