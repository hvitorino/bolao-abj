'use client'

import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import { useGameRealtime } from '@/lib/hooks/useGameRealtime'
import { useScoreRealtime } from '@/lib/hooks/useScoreRealtime'
import { useParticipantsRealtime } from '@/lib/hooks/useParticipantsRealtime'
import GameCardView from '@/components/games/GameCardView'

interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  participants?: ParticipantEntry[]
  userId?: string
  groupId: string
  hideAnalysisLink?: boolean
  onPredictionChange?: () => void
}

/**
 * Wrapper com hooks Realtime para uso standalone (GameAnaliseDrawer, analise/page, GameList).
 *
 * Para o fluxo principal (/jogos), prefira usar GameCardView diretamente via
 * JogosRealtime — os dados já são reativos via ScoreCache, sem necessidade
 * de hooks Realtime individuais.
 */
export default function GameCard({
  game,
  prediction = null,
  score = null,
  participants = [],
  userId,
  groupId,
  hideAnalysisLink = false,
  onPredictionChange,
}: GameCardProps) {
  const liveGameFromHook = useGameRealtime(game.id, game)
  const liveGame = liveGameFromHook.game
  const liveScore = useScoreRealtime(game.id, userId ?? '', score)
  const liveParticipants = useParticipantsRealtime(
    game.id,
    groupId,
    participants,
    liveGame.status as 'pending' | 'live' | 'finished'
  )

  return (
    <GameCardView
      game={liveGame}
      prediction={prediction}
      score={liveScore}
      participants={liveParticipants}
      userId={userId}
      groupId={groupId}
      hideAnalysisLink={hideAnalysisLink}
      onPredictionChange={onPredictionChange}
    />
  )
}
