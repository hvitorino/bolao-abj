'use client'

import { useLiveScores } from '@/lib/hooks/useLiveScores'
import type { LiveGameScore } from '@/lib/cache/score-cache'
import { usePredictionsRealtime } from '@/lib/hooks/usePredictionsRealtime'
import type { Prediction as PredictionType } from '@/lib/types/prediction'
import type { Score } from '@/lib/types/score'
import type { ParticipantEntry } from '@/lib/types/participant'
import GameCardView from '@/components/games/GameCardView'

interface JogosRealtimeProps {
  selectedDate: string
  groupId: string
  userId: string
  /** Dados server-side: palpites do usuário (usados como fallback inicial) */
  ssrPredictions: Record<string, PredictionType>
  /** Dados server-side: scores do usuário (usados como fallback inicial) */
  ssrScores: Record<string, Score>
  /** Dados server-side: participantes por jogo (usados como fallback inicial) */
  ssrParticipants: Record<string, ParticipantEntry[]>
}

/**
 * Wrapper client-side que conecta ScoreCache + PredictionCache aos componentes
 * de jogos (GameCard). Substitui a dupla useGameRealtime + useScoreRealtime +
 * useParticipantsRealtime com um único fluxo de dados reativo.
 */
export default function JogosRealtime({
  selectedDate,
  groupId,
  userId,
  ssrPredictions,
  ssrScores,
  ssrParticipants,
}: JogosRealtimeProps) {
  // Placar ao vivo — todos os jogos da data, reativos via Realtime + Polling 30s
  const { games: liveGames, loading: scoresLoading } = useLiveScores(selectedDate, groupId)

  // Palpites reativos — Realtime + Polling 60s
  const { predictionsByGame } = usePredictionsRealtime(
    groupId,
    selectedDate,
    userId
  )

  if (scoresLoading && liveGames.length === 0) {
    return (
      <div
        suppressHydrationWarning
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          color: 'var(--color-muted)',
          fontSize: '13px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        CARREGANDO JOGOS...
      </div>
    )
  }

  if (liveGames.length === 0) {
    return (
      <div
        suppressHydrationWarning
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          NENHUM JOGO NESTE DIA
        </span>
      </div>
    )
  }

  // Agrupar jogos por rodada
  const round = liveGames[0]?.round ?? ''

  // Montar participants reativos: mesclar SSR com dados do PredictionCache
  function getParticipantsForGame(gameId: string): ParticipantEntry[] {
    const ssrForGame = ssrParticipants[gameId] ?? []
    const predMap = predictionsByGame.get(gameId)

    if (!predMap || predMap.size === 0) return ssrForGame

    return ssrForGame.map((entry) => {
      const cachedPred = predMap.get(entry.userId)
      if (cachedPred) {
        return {
          ...entry,
          prediction: {
            id: entry.prediction?.id ?? '',
            home_score: cachedPred.home_score,
            away_score: cachedPred.away_score,
          },
          hasPrediction: true,
        }
      }
      return entry
    })
  }

  return (
    <div data-date={selectedDate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1rem',
        }}
      >
        {round && (
          <div
            style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-muted)',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            {round}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {liveGames.map((liveGame: LiveGameScore) => (
            <GameCardView
              key={liveGame.id}
              game={liveGame}
              prediction={ssrPredictions[liveGame.id] ?? null}
              score={ssrScores[liveGame.id] ?? null}
              participants={getParticipantsForGame(liveGame.id)}
              userId={userId}
              groupId={groupId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
