'use client'

import { useState, useEffect } from 'react'
import GameCard from '@/components/games/GameCard'
import MatchupStatsCard from '@/components/bolao/MatchupStatsCard'
import RecentGamesSection from '@/components/bolao/RecentGamesSection'
import type { TeamStats } from '@/components/bolao/MatchupStatsCard'
import type { RecentGame } from '@/components/bolao/RecentGamesSection'
import type { ParticipantEntry } from '@/lib/types/participant'
import type { Game } from '@/lib/types/game'
import type { Prediction } from '@/lib/types/prediction'
import type { Score } from '@/lib/types/score'

interface GameAnaliseDrawerProps {
  gameId: string | null // null = drawer fechado
  groupId: string
  currentUserId: string
  onClose: () => void
}

interface AnaliseData {
  game: {
    id: string
    home_team: string
    away_team: string
    home_team_code: string
    away_team_code: string
    home_score: number | null
    away_score: number | null
    match_date: string
    match_day: string | null
    status: string
    round: string | null
  }
  participants: ParticipantEntry[]
  homeStats: TeamStats
  awayStats: TeamStats
  homeRecentGames: RecentGame[]
  awayRecentGames: RecentGame[]
}

function DrawerSkeleton() {
  const line = (w: number) => (
    <div
      key={w}
      style={{ color: 'var(--color-muted)', fontSize: '12px', marginBottom: '0.5rem' }}
    >
      {'─'.repeat(w)}
    </div>
  )
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        padding: '0.5rem 0',
      }}
    >
      {line(42)}
      {line(36)}
      {line(40)}
      {line(28)}
      {line(38)}
      {line(32)}
    </div>
  )
}

export default function GameAnaliseDrawer({
  gameId,
  groupId,
  currentUserId,
  onClose,
}: GameAnaliseDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [data, setData] = useState<AnaliseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Abertura do drawer quando gameId muda para não-null
  useEffect(() => {
    if (gameId === null) return

    setIsVisible(true)
    setLoading(true)
    setError(null)
    setData(null)

    // Fetch dos dados da análise
    fetch(`/api/analise-data?gameId=${encodeURIComponent(gameId)}&groupId=${encodeURIComponent(groupId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Erro ${res.status}`)
        }
        return res.json() as Promise<AnaliseData>
      })
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })

    // Duplo rAF para garantir que o elemento esteja no DOM antes da transição CSS
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsOpen(true)
      })
    })
  }, [gameId, groupId])

  // Fechamento do drawer
  function handleClose() {
    setIsOpen(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 250)
  }

  // Handler de ESC
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Trava de scroll do body
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isVisible) return null

  // Derivar prediction e score do usuário atual a partir dos participants
  const myParticipant = data?.participants.find((p) => p.userId === currentUserId)

  const myPrediction: Prediction | null =
    myParticipant?.prediction
      ? {
          id: '',
          user_id: currentUserId,
          game_id: data!.game.id,
          home_score: myParticipant.prediction.home_score,
          away_score: myParticipant.prediction.away_score,
          submitted_at: '',
        }
      : null

  const myScore: Score | null =
    myParticipant?.points !== null &&
    myParticipant?.points !== undefined &&
    myParticipant?.breakdown
      ? {
          id: '',
          user_id: currentUserId,
          game_id: data!.game.id,
          prediction_id: '',
          points: myParticipant.points!,
          breakdown: myParticipant.breakdown,
          calculated_at: '',
        }
      : null

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          backgroundColor: isOpen ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
          transition: 'background-color 250ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Análise do jogo"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 51,
          maxHeight: '85vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 250ms ease',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        {/* Header fixo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {data
              ? `${data.game.home_team_code} × ${data.game.away_team_code}`
              : 'ANÁLISE'}
          </span>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            ✕
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
          {loading && <DrawerSkeleton />}
          {error && !loading && (
            <div
              style={{
                color: 'var(--color-error)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '2rem 0',
              }}
            >
              ✗ {error}
            </div>
          )}
          {data && !loading && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <GameCard
                  game={data.game as unknown as Game}
                  prediction={myPrediction}
                  score={myScore}
                  participants={data.participants}
                  userId={currentUserId}
                  groupId={groupId}
                  hideAnalysisLink
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <MatchupStatsCard
                  homeTeam={data.game.home_team}
                  awayTeam={data.game.away_team}
                  homeTeamCode={data.game.home_team_code}
                  awayTeamCode={data.game.away_team_code}
                  homeStats={data.homeStats}
                  awayStats={data.awayStats}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <RecentGamesSection
                  homeTeamCode={data.game.home_team_code}
                  awayTeamCode={data.game.away_team_code}
                  homeRecentGames={data.homeRecentGames}
                  awayRecentGames={data.awayRecentGames}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
