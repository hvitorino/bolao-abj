'use client'

import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/types/game'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LiveGameScore extends Game {
  lastUpdatedAt: Date | null
  connectionStatus: 'connecting' | 'connected' | 'error'
}

// ---------------------------------------------------------------------------
// Cache module-level (singleton)
// ---------------------------------------------------------------------------

const gamesByDate = new Map<string, Game[]>()
const liveTimers = new Map<string, ReturnType<typeof setInterval>>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Referência ao canal Realtime global — criado uma única vez
let globalChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
let subscribers = 0
// Callbacks registrados por componente — cada um recebe o game atualizado
type GameUpdateListener = (game: Game) => void
const listeners = new Set<GameUpdateListener>()

// Estado da conexão Realtime global
let globalConnectionStatus: 'connecting' | 'connected' | 'error' = 'connecting'
const connectionListeners = new Set<(status: 'connecting' | 'connected' | 'error') => void>()

const POLL_INTERVAL_MS = 30_000
const PRE_START_WINDOW_MS = 5 * 60 * 1000 // 5 min antes do início
const ACTIVE_WINDOW_MS = 3 * 60 * 60 * 1000 // 3h após início

// ---------------------------------------------------------------------------
// Funções internas
// ---------------------------------------------------------------------------

function getScoreFingerprint(game: Game): string {
  return `${game.id}:${game.status}:${game.home_score}:${game.away_score}`
}

function isInActiveWindow(game: Game): boolean {
  if (game.status === 'finished') return false
  const matchDate = new Date(game.match_date).getTime()
  const now = Date.now()
  const windowStart = matchDate - PRE_START_WINDOW_MS
  const windowEnd = matchDate + ACTIVE_WINDOW_MS
  return now >= windowStart && now <= windowEnd
}

function isGameLive(game: Game): boolean {
  return game.status === 'live'
}

function schedulePendingTimer(game: Game): void {
  const matchDate = new Date(game.match_date).getTime()
  const fireAt = matchDate - PRE_START_WINDOW_MS
  const delay = Math.max(0, fireAt - Date.now())

  if (pendingTimers.has(game.id)) {
    clearTimeout(pendingTimers.get(game.id))
    pendingTimers.delete(game.id)
  }

  if (delay > 0) {
    const timer = setTimeout(() => {
      pendingTimers.delete(game.id)
      // Quando o timer dispara, verifica se o jogo ainda está no cache e está pending
      // Se sim, começa o polling (que detectará a transição para live)
      for (const [, games] of gamesByDate) {
        const g = games.find((g) => g.id === game.id)
        if (g && g.status === 'pending') {
          startLivePolling(game.id)
          break
        }
      }
    }, delay)
    pendingTimers.set(game.id, timer)
  }
}

function startLivePolling(gameId: string): void {
  if (liveTimers.has(gameId)) return

  const supabase = createClient()
  const timer = setInterval(() => {
    supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          updateGameInCache(data as Game)
        }
      })
  }, POLL_INTERVAL_MS)
  liveTimers.set(gameId, timer)
}

function stopLivePolling(gameId: string): void {
  const timer = liveTimers.get(gameId)
  if (timer) {
    clearInterval(timer)
    liveTimers.delete(gameId)
  }
}

function updateGameInCache(game: Game): void {
  for (const [date, games] of gamesByDate) {
    const idx = games.findIndex((g) => g.id === game.id)
    if (idx !== -1) {
      const oldGame = games[idx]
      games[idx] = game

      // Gerenciar transições de status
      if (oldGame.status !== game.status) {
        if (game.status === 'live') {
          startLivePolling(game.id)
        } else if (game.status === 'finished') {
          stopLivePolling(game.id)
        } else if (game.status === 'pending') {
          schedulePendingTimer(game)
        }
      }

      // Notificar listeners
      for (const listener of listeners) {
        listener(game)
      }
      return
    }
  }
}

function ensureGlobalChannel(): void {
  if (globalChannel) return

  const supabase = createClient()

  globalChannel = supabase
    .channel('live-scores-global')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
      },
      (payload) => {
        const updated = payload.new as Partial<Game>
        if (updated.id) {
          // Busca o jogo completo (ou funde com cache existente)
          for (const [, games] of gamesByDate) {
            const existing = games.find((g) => g.id === updated.id)
            if (existing) {
              updateGameInCache({ ...existing, ...updated } as Game)
              return
            }
          }
        }
      }
    )
    .subscribe((status) => {
      const newStatus =
        status === 'SUBSCRIBED'
          ? 'connected'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
            ? 'error'
            : 'connecting'

      globalConnectionStatus = newStatus
      for (const cb of connectionListeners) {
        cb(newStatus)
      }
    })
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Garante que os jogos de uma data estão carregados no cache.
 * Datas já visitadas retornam imediatamente (sem fetch).
 */
export async function ensureDate(date: string): Promise<Game[]> {
  const cached = gamesByDate.get(date)
  if (cached) return cached

  const supabase = createClient()
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('match_day', date)
    .order('match_date', { ascending: true })

  if (error) throw new Error(`Erro ao buscar jogos da data ${date}: ${error.message}`)

  const games = (data ?? []) as Game[]
  gamesByDate.set(date, games)

  // Garantir canal Realtime global
  ensureGlobalChannel()

  // Agendar timers para jogos pending, polling para jogos live
  for (const game of games) {
    if (game.status === 'live') {
      startLivePolling(game.id)
    } else if (game.status === 'pending') {
      schedulePendingTimer(game)
    }
    // finished: nada a fazer
  }

  return games
}

/**
 * Retorna os jogos de uma data do cache (se já carregados) ou array vazio.
 */
export function getCachedGames(date: string): Game[] {
  return gamesByDate.get(date) ?? []
}

/**
 * Retorna true se o jogo está live no cache.
 */
export function isLive(gameId: string): boolean {
  for (const [, games] of gamesByDate) {
    const g = games.find((g) => g.id === gameId)
    if (g) return g.status === 'live'
  }
  return false
}

/**
 * Retorna placar e status de um jogo do cache.
 */
export function getScore(gameId: string): {
  home_score: number | null
  away_score: number | null
  status: string
} | null {
  for (const [, games] of gamesByDate) {
    const g = games.find((g) => g.id === gameId)
    if (g) return { home_score: g.home_score, away_score: g.away_score, status: g.status }
  }
  return null
}

/**
 * Registra um listener que será chamado sempre que um jogo no cache for atualizado.
 * Retorna função de cleanup.
 */
export function subscribeToGameUpdates(listener: GameUpdateListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Registra um listener para mudanças no status da conexão Realtime global.
 * Retorna função de cleanup.
 */
export function subscribeToConnectionStatus(
  cb: (status: 'connecting' | 'connected' | 'error') => void
): () => void {
  // Notifica estado atual imediatamente
  cb(globalConnectionStatus)
  connectionListeners.add(cb)
  return () => {
    connectionListeners.delete(cb)
  }
}

/**
 * Incrementa contador de referências ao canal global.
 * Usado por useLiveScores para gerenciar ciclo de vida.
 */
export function acquireGlobalChannel(): void {
  subscribers++
  ensureGlobalChannel()
}

/**
 * Decrementa contador de referências.
 * Quando chega a zero, limpa todos os timers e canais.
 */
export function releaseGlobalChannel(): void {
  subscribers--
  if (subscribers <= 0) {
    subscribers = 0

    // Limpar canal Realtime
    if (globalChannel) {
      const supabase = createClient()
      supabase.removeChannel(globalChannel)
      globalChannel = null
    }

    // Limpar todos os timers
    for (const [, timer] of liveTimers) clearInterval(timer)
    liveTimers.clear()
    for (const [, timer] of pendingTimers) clearTimeout(timer)
    pendingTimers.clear()

    // Limpar listeners
    listeners.clear()
    connectionListeners.clear()
  }
}

/**
 * Limpa todo o cache (útil ao trocar de grupo).
 */
export function clearScoreCache(): void {
  for (const [, timer] of liveTimers) clearInterval(timer)
  liveTimers.clear()
  for (const [, timer] of pendingTimers) clearTimeout(timer)
  pendingTimers.clear()
  gamesByDate.clear()
}
