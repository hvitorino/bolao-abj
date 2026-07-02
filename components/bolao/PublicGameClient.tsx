'use client'

import { useEffect, useState } from 'react'
import { Game } from '@/lib/types/game'
import { ParticipantEntry } from '@/lib/types/participant'
import { subscribeToGameUpdates, acquireGlobalChannel, releaseGlobalChannel } from '@/lib/cache/score-cache'
import PublicScoreCard from '@/components/bolao/PublicScoreCard'
import PublicParticipantsList from '@/components/bolao/PublicParticipantsList'

interface PublicGameClientProps {
  initialGame: Game
  initialParticipants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  groupId: string
}

/**
 * Componente pai Client da página pública de jogo.
 * Usa ScoreCache (1 canal global) em vez de useGameRealtime (1 canal por jogo).
 */
export default function PublicGameClient({
  initialGame,
  initialParticipants,
  gameStatus,
  groupId,
}: PublicGameClientProps) {
  const [liveGame, setLiveGame] = useState<Game>(initialGame)

  useEffect(() => {
    acquireGlobalChannel()
    const unsub = subscribeToGameUpdates((updatedGame) => {
      if (updatedGame.id === initialGame.id) {
        setLiveGame(updatedGame)
      }
    })
    return () => {
      unsub()
      releaseGlobalChannel()
    }
  }, [initialGame.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PublicScoreCard liveGame={liveGame} />
      <PublicParticipantsList
        participants={initialParticipants}
        gameStatus={(liveGame.status as 'pending' | 'live' | 'finished') ?? gameStatus}
        gameId={initialGame.id}
        groupId={groupId}
        liveHomeScore={liveGame.home_score}
        liveAwayScore={liveGame.away_score}
      />
    </div>
  )
}
