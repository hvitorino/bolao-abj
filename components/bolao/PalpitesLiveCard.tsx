'use client'

import { useState, useEffect } from 'react'
import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { LiveGameWithPrediction } from '@/lib/hooks/usePalpitesAoVivo'
import { BracketTree } from '@/components/bolao/BracketTree'
import { useBracketExpansion } from '@/lib/hooks/useBracketExpansion'

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
  onBracketExpandChange?: (expanded: boolean) => void
}

export function PalpitesLiveCard({ todayGames, loading, onGameClick, groupId, currentUserId, onBracketExpandChange }: PalpitesLiveCardProps) {
  // ── Bracket expansion (shared hook) ─────────────────────────────
  const bracket = useBracketExpansion(currentUserId)
  const isKnockoutDay = todayGames.length > 0 && KNOCKOUT_PHASES.includes(todayGames[0].phase)

  // Notify parent of expansion state for swipe lock
  useEffect(() => {
    onBracketExpandChange?.(bracket.expanded)
  }, [bracket.expanded, onBracketExpandChange])

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
      <style>{`
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

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
            onClick={bracket.toggle}
            aria-label={bracket.expanded ? 'Recolher chaveamento' : 'Expandir chaveamento'}
            aria-expanded={bracket.expanded}
            style={{
              position: 'absolute',
              right: 0,
              background: 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              color: 'var(--color-bg)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '14px',
              fontWeight: 'bold',
              lineHeight: 1,
            }}
          >
            {bracket.expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* ── Content: games grid OR bracket (swap with animation) ─── */}
      <div
        key={bracket.expanded ? 'bracket' : 'games'}
        style={{
          opacity: bracket.isTransitioning ? 0 : 1,
          transform: bracket.isTransitioning ? 'translateY(4px)' : 'translateY(0)',
          transition: bracket.isTransitioning
            ? 'opacity 160ms ease, transform 160ms ease'
            : 'none',
          animation: bracket.isTransitioning ? 'none' : 'cardFadeIn 200ms ease-out',
        }}
      >
        {bracket.expanded ? (
          /* ── Bracket view ──────────────────────────────────────── */
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)',
                textAlign: 'center',
                marginBottom: '0.35rem',
              }}
            >
              CHAVEAMENTO — MATA-MATA
            </div>

            {bracket.loading ? (
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
            ) : bracket.roots && bracket.roots.length > 0 ? (
              <BracketTree
                roots={bracket.roots}
                predictions={bracket.predictions}
                groupId={groupId}
                currentUserId={currentUserId}
                onGameClick={onGameClick}
              />
            ) : bracket.roots && bracket.roots.length === 0 ? (
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
          </>
        ) : (
          /* ── Games grid ────────────────────────────────────────── */
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
        )}
      </div>
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
