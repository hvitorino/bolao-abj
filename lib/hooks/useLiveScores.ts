'use client'

import { useEffect, useState } from 'react'
import {
  ensureDate,
  getCachedGames,
  subscribeToGameUpdates,
  subscribeToConnectionStatus,
  acquireGlobalChannel,
  releaseGlobalChannel,
  clearScoreCache,
} from '@/lib/cache/score-cache'
import type { Game } from '@/lib/types/game'
import type { LiveGameScore } from '@/lib/cache/score-cache'

// Re-exporta os helpers para conveniência
export { isLive, getScore } from '@/lib/cache/score-cache'

/**
 * Hook que fornece acesso reativo aos jogos de uma data, usando o ScoreCache
 * centralizado. Substitui useGameRealtime + useScoreRealtime.
 *
 * - Apenas 1 canal Realtime global para tabela `games` (vs N canais antes)
 * - Polling 30s gerenciado por jogo (não por componente)
 * - Cache entre datas — navegar entre datas mantém dados em memória
 * - Compartilhado entre todos os componentes (GameCard, PalpitesLiveCard, etc.)
 *
 * @param selectedDate - data no formato YYYY-MM-DD
 * @param groupId - trocar de grupo limpa o cache
 */
export function useLiveScores(
  selectedDate: string,
  groupId: string
): {
  games: LiveGameScore[]
  loading: boolean
  error: string | null
} {
  const [games, setGames] = useState<LiveGameScore[]>(() => {
    // Inicialização síncrona do cache
    const cached = getCachedGames(selectedDate)
    return cached.map((g) => ({
      ...g,
      lastUpdatedAt: null,
      connectionStatus: 'connecting' as const,
    }))
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  // Limpar cache ao trocar de grupo
  useEffect(() => {
    clearScoreCache()
  }, [groupId])

  // Carregar dados da data
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const gameData = await ensureDate(selectedDate)
        if (cancelled) return
        setGames(
          gameData.map((g) => ({
            ...g,
            lastUpdatedAt: null,
            connectionStatus,
          }))
        )
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar jogos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const cached = getCachedGames(selectedDate)
    if (cached.length > 0) {
      // Cache hit: usar imediatamente (deferido para evitar setState síncrono no effect)
      window.setTimeout(() => {
        setGames(
          cached.map((g) => ({
            ...g,
            lastUpdatedAt: null,
            connectionStatus,
          }))
        )
        setLoading(false)
      }, 0)
    } else {
      void load()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groupId])

  // Subscrever a atualizações do cache e status da conexão
  useEffect(() => {
    acquireGlobalChannel()

    const unsubGame = subscribeToGameUpdates((updatedGame: Game) => {
      setGames((prev) =>
        prev.map((g) =>
          g.id === updatedGame.id
            ? { ...updatedGame, lastUpdatedAt: new Date(), connectionStatus }
            : g
        )
      )
    })

    const unsubConn = subscribeToConnectionStatus((status) => {
      setConnectionStatus(status)
      setGames((prev) => prev.map((g) => ({ ...g, connectionStatus: status })))
    })

    return () => {
      unsubGame()
      unsubConn()
      releaseGlobalChannel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, groupId])

  return { games, loading, error }
}
