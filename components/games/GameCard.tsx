'use client'

import { useEffect, useRef, useState } from 'react'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import {
  subscribeToGameUpdates,
  acquireGlobalChannel,
  releaseGlobalChannel,
} from '@/lib/cache/score-cache'
import {
  getCachedPredictions,
  acquirePredictionCache,
  releasePredictionCache,
  subscribeToPredictionUpdates,
} from '@/lib/cache/prediction-cache'
import {
  getPointsFor,
  acquirePointsCache,
  releasePointsCache,
  subscribeToPointsUpdates,
} from '@/lib/cache/points-cache'
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
 * Wrapper que alimenta GameCardView a partir dos caches centralizados
 * (ScoreCache, PredictionCache, PointsCache).
 *
 * Substitui a dupla useGameRealtime + useScoreRealtime + useParticipantsRealtime
 * com um único fluxo de dados reativo, sem canais por jogo.
 */
export default function GameCard({
  game: initialGame,
  prediction = null,
  score: initialScore = null,
  participants: initialParticipants = [],
  userId,
  groupId,
  hideAnalysisLink = false,
  onPredictionChange,
}: GameCardProps) {
  const [liveGame, setLiveGame] = useState<Game>(initialGame)
  const [liveScore, setLiveScore] = useState<Score | null>(initialScore)
  const [liveParticipants, setLiveParticipants] = useState<ParticipantEntry[]>(initialParticipants)

  // Guard: revelar palpites apenas uma vez quando o jogo sai de pending
  const hasRevealedPredictions = useRef(false)

  // ── 1. Game updates via ScoreCache ──
  useEffect(() => {
    acquireGlobalChannel()
    const unsub = subscribeToGameUpdates('GameCard', (updatedGame) => {
      if (updatedGame.id === initialGame.id) {
        setLiveGame(updatedGame)
      }
    })
    return () => {
      unsub()
      releaseGlobalChannel()
    }
  }, [initialGame.id])

  // ── 2. Score do usuário via PointsCache ──
  useEffect(() => {
    if (!userId) return

    acquirePointsCache(groupId)

    // Leitura inicial síncrona do cache
    const cached = getPointsFor(groupId, initialGame.id, userId)
    if (cached) {
      setLiveScore({
        id: cached.game_id,       // PointsCache não armazena o id real do score
        user_id: cached.user_id,
        game_id: cached.game_id,
        prediction_id: '',        // PointsCache não armazena prediction_id
        points: cached.points,
        breakdown: cached.breakdown,
        calculated_at: '',        // PointsCache não armazena calculated_at
      })
    }

    // Listener granular para atualizações de pontuação deste jogo+usuário
    const unsub = subscribeToPointsUpdates(groupId, 'GameCard', (pts) => {
      if (pts.game_id === initialGame.id && pts.user_id === userId) {
        setLiveScore({
          id: pts.game_id,
          user_id: pts.user_id,
          game_id: pts.game_id,
          prediction_id: '',
          points: pts.points,
          breakdown: pts.breakdown,
          calculated_at: '',
        })
      }
    })

    return () => {
      unsub()
      releasePointsCache(groupId)
    }
  }, [groupId, initialGame.id, userId])

  // ── 3. Participantes: revela palpites quando jogo sai de pending ──
  useEffect(() => {
    if (liveGame.status === 'pending' || hasRevealedPredictions.current) return
    hasRevealedPredictions.current = true

    acquirePredictionCache(groupId)

    // Merge inicial: ler predictions do cache e mesclar nos participantes
    const allPreds = getCachedPredictions(groupId)
    setLiveParticipants((prev) =>
      prev.map((p) => {
        const pred = allPreds.get(initialGame.id)?.get(p.userId)
        if (pred) {
          return {
            ...p,
            prediction: {
              id: p.prediction?.id ?? '',
              home_score: pred.home_score,
              away_score: pred.away_score,
            },
            hasPrediction: true,
          }
        }
        return p
      })
    )

    // Listener granular para novos palpites (ex: edição tardia)
    const unsub = subscribeToPredictionUpdates(groupId, 'GameCard', (pred) => {
      if (pred.game_id === initialGame.id) {
        setLiveParticipants((prev) =>
          prev.map((p) => {
            if (p.userId === pred.user_id) {
              return {
                ...p,
                prediction: {
                  id: p.prediction?.id ?? '',
                  home_score: pred.home_score,
                  away_score: pred.away_score,
                },
                hasPrediction: true,
              }
            }
            return p
          })
        )
      }
    })

    return () => {
      unsub()
      releasePredictionCache(groupId)
    }
  }, [liveGame.status, groupId, initialGame.id])

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
