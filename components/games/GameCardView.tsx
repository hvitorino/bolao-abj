'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import type { ScoreBreakdown } from '@/lib/types/score'
import PredictionForm from '@/components/bolao/PredictionForm'
import PredictionDisplay from '@/components/bolao/PredictionDisplay'
import ScoreDisplay from '@/components/bolao/ScoreDisplay'
import { calculateLiveScore } from '@/lib/scoring'
import GameParticipantsList from '@/components/bolao/GameParticipantsList'
import { ParticipantEntry } from '@/lib/types/participant'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface GameCardViewProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  participants?: ParticipantEntry[]
  userId?: string
  groupId: string
  hideAnalysisLink?: boolean
  onPredictionChange?: () => void
}

function formatMatchTime(matchDate: string): string {
  const d = new Date(matchDate)
  const date = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function isDeadlinePassed(matchDate: string): boolean {
  return Date.now() >= new Date(matchDate).getTime() - 5 * 60 * 1000
}

/**
 * Componente presentacional do card de jogo — sem hooks Realtime.
 * Recebe todos os dados como props, reativo via componente pai.
 *
 * Usado por:
 * - GameCard (wrapper com hooks Realtime para standalone)
 * - JogosRealtime (dados reativos via ScoreCache, sem hooks Realtime)
 * - GameAnaliseDrawer (dados via fetch)
 */
export default function GameCardView({
  game,
  prediction = null,
  score = null,
  participants = [],
  userId,
  groupId,
  hideAnalysisLink = false,
  onPredictionChange,
}: GameCardViewProps) {
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(prediction ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false)
  const [isScoreExpanded, setIsScoreExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isLive = game.status === 'live'
  const isFinished = game.status === 'finished'
  const isPending = game.status === 'pending'

  const liveHomeScore = isLive ? (game.home_score ?? 0) : game.home_score
  const liveAwayScore = isLive ? (game.away_score ?? 0) : game.away_score

  const provisionalScore =
    isLive && currentPrediction
      ? calculateLiveScore({ home_score: liveHomeScore, away_score: liveAwayScore }, currentPrediction)
      : null

  // Para jogos live: calcular client-side. Para finished: usar score do banco.
  const displayScore = isLive ? provisionalScore : score
  const hasScore = game.home_score !== null && game.away_score !== null
  const matchTime = formatMatchTime(game.match_date)
  const scoreText = hasScore ? `${game.home_score} × ${game.away_score}` : isLive ? '0 × 0' : '- × -'
  const cardBorderColor = isLive ? 'var(--color-primary)' : 'var(--color-border)'
  const cardBorderStyle = isFinished ? 'dashed' : 'solid'
  const cardBg = isLive ? 'rgba(0, 156, 59, 0.18)' : 'var(--color-surface)'
  const canEdit = isPending && currentPrediction != null && !isDeadlinePassed(game.match_date)

  function handleEditSuccess(updated: Prediction) {
    setCurrentPrediction(updated)
    setIsEditing(false)
    onPredictionChange?.()
  }

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/jogos/${game.id}/publico?grupo=${groupId}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silencioso */ }
  }

  return (
    <div style={{ border: `1px ${cardBorderStyle} ${cardBorderColor}`, backgroundColor: cardBg, fontFamily: "'JetBrains Mono', 'Courier New', monospace", overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px ${cardBorderStyle} ${cardBorderColor}`, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
        {isLive && <span style={{ color: 'var(--color-bg)', backgroundColor: 'var(--color-primary)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.1rem 0.4rem', flexShrink: 0 }}>● AO VIVO</span>}
        {isPending && <span style={{ color: 'var(--color-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid var(--color-border)', padding: '0.1rem 0.4rem', flexShrink: 0 }}>◷ EM BREVE</span>}
        {isFinished && <span style={{ color: 'var(--color-accent)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--color-accent)', padding: '0.1rem 0.4rem', flexShrink: 0 }}>✓ ENCERRADO</span>}
        <span style={{ color: 'var(--color-muted)', fontSize: '11px', marginLeft: 'auto', flexShrink: 0 }}>{matchTime} BRT</span>
        {isPending && currentPrediction && !isEditing && canEdit && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Editar palpite"
            style={{ flexShrink: 0, border: 'none', backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '11px', padding: '0.15rem 0.4rem', cursor: 'pointer' }}
          >
            ✎
          </button>
        )}
        {(isLive || isFinished) && currentPrediction && displayScore && (
          <button
            type="button"
            onClick={() => setIsScoreExpanded((prev) => !prev)}
            title="Ver detalhamento da pontuação"
            style={{ flexShrink: 0, border: 'none', backgroundColor: 'var(--color-primary)', color: 'var(--color-accent)', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '11px', fontWeight: 'bold', padding: '0.15rem 0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          >
            +{displayScore.points}
            <span style={{ display: 'inline-block', transform: isScoreExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 250ms ease' }}>▾</span>
          </button>
        )}
      </div>

      {/* Placar + palpite */}
      <div style={{ padding: '1rem 0.75rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: '28px', lineHeight: 1 }}>{getTeamFlag(game.home_team_code)}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', marginTop: '0.25rem', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.home_team}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          <div style={{ fontSize: hasScore ? '28px' : '22px', fontWeight: 'bold', color: hasScore || isLive ? 'var(--color-accent)' : 'var(--color-muted)', letterSpacing: '0.05em' }}>{scoreText}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: '28px', lineHeight: 1 }}>{getTeamFlag(game.away_team_code)}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', marginTop: '0.25rem', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.away_team}</div>
        </div>

        {isPending && currentPrediction && !isEditing && (
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <PredictionDisplay homeScore={currentPrediction.home_score} awayScore={currentPrediction.away_score} submittedAt={currentPrediction.submitted_at} />
          </div>
        )}

        {(isLive || isFinished) && (
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            {currentPrediction ? (
              <>
                <PredictionDisplay homeScore={currentPrediction.home_score} awayScore={currentPrediction.away_score} submittedAt={currentPrediction.submitted_at} />
                {displayScore && liveHomeScore !== null && liveAwayScore !== null && (
                  <div style={{ display: 'grid', gridTemplateRows: isScoreExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: '0.5rem' }}><ScoreDisplay points={displayScore.points} breakdown={displayScore.breakdown} /></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", textAlign: 'center', fontSize: '12px', color: 'var(--color-muted)' }}>
                SEM PALPITE · +0 PTS
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulário de palpite */}
      {isPending && (isEditing || !currentPrediction) && (
        <div style={{ borderTop: '1px dashed var(--color-border)', padding: '0.75rem' }}>
          {isEditing && currentPrediction && (
            <PredictionForm gameId={game.id} groupId={groupId} homeTeamCode={game.home_team_code} awayTeamCode={game.away_team_code} matchDate={game.match_date} initialPrediction={currentPrediction} onCancelEdit={() => setIsEditing(false)} onSuccess={handleEditSuccess} />
          )}
          {!currentPrediction && !isEditing && (
            <PredictionForm gameId={game.id} groupId={groupId} homeTeamCode={game.home_team_code} awayTeamCode={game.away_team_code} matchDate={game.match_date} initialPrediction={null} onSuccess={(created) => { setCurrentPrediction(created); onPredictionChange?.() }} />
          )}
        </div>
      )}

      {/* Barra de ações */}
      {(!hideAnalysisLink || participants.length > 0) && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--color-primary)' }}>
          {!hideAnalysisLink && (
            <Link href={`/jogos/${game.id}/analise`} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', textDecoration: 'none' }}>► VER ANÁLISE</Link>
          )}
          {participants.length > 0 && (
            <button type="button" onClick={() => setIsParticipantsExpanded((prev) => !prev)} aria-expanded={isParticipantsExpanded} aria-controls={`participants-${game.id}`} style={{ flex: 1, border: 'none', borderLeft: !hideAnalysisLink ? '1px solid var(--color-primary)' : 'none', backgroundColor: 'var(--color-primary)', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '11px', fontWeight: 'bold', color: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {isParticipantsExpanded ? 'OCULTAR PALPITES' : 'VER PALPITES'}
              <span style={{ display: 'inline-block', transform: isParticipantsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 250ms ease' }}>▾</span>
            </button>
          )}
        </div>
      )}

      {/* Palpites dos participantes */}
      {participants.length > 0 && (
        <div style={{ display: 'grid', gridTemplateRows: isParticipantsExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease' }}>
          <div style={{ overflow: 'hidden' }}>
            <div id={`participants-${game.id}`}>
              <GameParticipantsList participants={participants} gameStatus={game.status as 'pending' | 'live' | 'finished'} currentUserId={userId} liveGame={{ home_score: game.home_score, away_score: game.away_score }} />
            </div>
          </div>
        </div>
      )}

      {/* Copiar link */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <button type="button" onClick={handleCopyLink} style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '10px', color: copied ? 'var(--color-win)' : 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 150ms ease' }}>
          {copied ? '✓ COPIADO!' : '⎘ COPIAR LINK'}
        </button>
      </div>
    </div>
  )
}
