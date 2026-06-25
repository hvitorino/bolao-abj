'use client'

import { Game } from '@/lib/types/game'
import { ParticipantEntry } from '@/lib/types/participant'
import { useGameRealtime } from '@/lib/hooks/useGameRealtime'
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
 * Gerencia o estado do jogo via useGameRealtime e distribui o liveGame
 * como prop para PublicScoreCard e PublicParticipantsList, evitando
 * múltiplas subscriptions ao mesmo canal Supabase Realtime.
 */
export default function PublicGameClient({
  initialGame,
  initialParticipants,
  gameStatus,
  groupId,
}: PublicGameClientProps) {
  const { game: liveGame } = useGameRealtime(initialGame.id, initialGame, 10_000)

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
