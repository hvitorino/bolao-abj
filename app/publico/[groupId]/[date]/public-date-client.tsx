'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateLiveScore } from '@/lib/scoring'
import { ParticipantEntry } from '@/lib/types/participant'
import type { PublicDateGame, ProfileEntry } from '@/lib/types/public-date'
import type { ScoreBreakdown } from '@/lib/types/score'
import PublicDateGameSection from '@/components/bolao/PublicDateGameSection'
import PublicDateRanking from '@/components/bolao/PublicDateRanking'

interface PublicDateClientProps {
  groupId: string
  date: string
  initialGames: PublicDateGame[]
  initialParticipants: ProfileEntry[]
  initialGameParticipants: Record<string, ParticipantEntry[]>
}

export default function PublicDateClient({
  groupId,
  date,
  initialGames,
  initialParticipants,
  initialGameParticipants,
}: PublicDateClientProps) {
  const [games, setGames] = useState<PublicDateGame[]>(initialGames)
  const [gameParticipants, setGameParticipants] = useState<Record<string, ParticipantEntry[]>>(
    initialGameParticipants
  )

  const gameIds = initialGames.map((g) => g.id)

  // Realtime: canal de jogos
  useEffect(() => {
    if (gameIds.length === 0) return

    const supabase = createClient()

    const gamesChannel = supabase
      .channel(`public-date-games-${groupId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          const updated = payload.new as PublicDateGame
          if (!updated?.id || !gameIds.includes(updated.id)) return

          setGames((prev) =>
            prev.map((g) =>
              g.id === updated.id
                ? {
                    ...g,
                    home_score: updated.home_score,
                    away_score: updated.away_score,
                    status: updated.status,
                  }
                : g
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(gamesChannel)
    }
  }, [groupId, date, gameIds.join(',')])

  // Realtime: canal de scores
  useEffect(() => {
    if (gameIds.length === 0) return

    const supabase = createClient()

    const scoresChannel = supabase
      .channel(`public-date-scores-${groupId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
        },
        (payload) => {
          const newScore = payload.new as {
            user_id: string
            game_id: string
            group_id: string
            points: number
            breakdown: ScoreBreakdown
          }
          if (!newScore?.user_id) return
          if (newScore.group_id !== groupId) return
          if (!gameIds.includes(newScore.game_id)) return

          setGameParticipants((prev) => {
            const gameEntry = prev[newScore.game_id]
            if (!gameEntry) return prev
            return {
              ...prev,
              [newScore.game_id]: gameEntry.map((p) =>
                p.userId === newScore.user_id
                  ? { ...p, points: newScore.points, breakdown: newScore.breakdown }
                  : p
              ),
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(scoresChannel)
    }
  }, [groupId, date, gameIds.join(',')])

  // Calcular ranking do dia
  const rankingEntries = initialParticipants.map((participant) => {
    let officialPoints = 0
    let livePoints = 0

    for (const game of games) {
      const entries = gameParticipants[game.id] ?? []
      const entry = entries.find((e) => e.userId === participant.userId)
      if (!entry) continue

      if (game.status === 'finished' && entry.points !== null) {
        officialPoints += entry.points
      } else if (game.status === 'live' && entry.prediction) {
        const liveResult = calculateLiveScore(
          { home_score: game.home_score, away_score: game.away_score },
          entry.prediction
        )
        if (liveResult) {
          livePoints += liveResult.points
        }
      }
    }

    return {
      userId: participant.userId,
      name: participant.name,
      officialPoints,
      livePoints,
      hasLivePoints: livePoints > 0,
    }
  })

  const hasAnyLiveGame = games.some((g) => g.status === 'live')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Ranking do dia */}
      <PublicDateRanking participants={rankingEntries} />

      {/* Uma seção por jogo */}
      {games.map((game) => {
        const entries = gameParticipants[game.id] ?? []
        return (
          <PublicDateGameSection
            key={game.id}
            game={game}
            participants={entries}
            liveHomeScore={game.home_score}
            liveAwayScore={game.away_score}
          />
        )
      })}

      {/* Rodapé geral se há jogos ao vivo */}
      {hasAnyLiveGame && (
        <div
          style={{
            padding: '0.4rem 0',
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
          }}
        >
          PÁGINA ATUALIZA AUTOMATICAMENTE EM TEMPO REAL
        </div>
      )}
    </div>
  )
}
