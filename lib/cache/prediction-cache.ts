'use client'

import { createClient } from '@/lib/supabase/client'
import { getTeamCodes } from '@/lib/cache/score-cache'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CachedPrediction {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

// ---------------------------------------------------------------------------
// Cache module-level (singleton) — escopado por groupId
// ---------------------------------------------------------------------------

interface GroupCache {
  predictions: Map<string, Map<string, CachedPrediction>> // date → gameId:userId → pred
  channel: ReturnType<ReturnType<typeof createClient>['channel']> | null
  pollingInterval: ReturnType<typeof setInterval> | null
  connectionStatus: 'connecting' | 'connected' | 'error'
  listeners: Set<() => void> // callbacks de invalidação
  loadedDates: Set<string>
  refCount: number
}

const cachesByGroup = new Map<string, GroupCache>()

const POLL_INTERVAL_MS = 60_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrCreateGroupCache(groupId: string): GroupCache {
  let cache = cachesByGroup.get(groupId)
  if (!cache) {
    cache = {
      predictions: new Map(),
      channel: null,
      pollingInterval: null,
      connectionStatus: 'connecting',
      listeners: new Set(),
      loadedDates: new Set(),
      refCount: 0,
    }
    cachesByGroup.set(groupId, cache)
  }
  return cache
}

// ---------------------------------------------------------------------------
// API do cache
// ---------------------------------------------------------------------------

/**
 * Carrega os palpites de uma data para um grupo no cache.
 * Datas já carregadas retornam imediatamente.
 */
export async function ensurePredictions(
  groupId: string,
  date: string
): Promise<Map<string, Map<string, CachedPrediction>>> {
  const cache = getOrCreateGroupCache(groupId)

  const cached = cache.predictions.get(date)
  if (cached) return cache.predictions // retorna todas as dates carregadas

  // Buscar jogos da data para filtrar palpites
  const supabase = createClient()
  const { data: gamesData } = await supabase
    .from('games')
    .select('id')
    .eq('match_day', date)

  const gameIds = (gamesData ?? []).map((g: { id: string }) => g.id)

  if (gameIds.length === 0) {
    // Sem jogos na data — cache vazio
    cache.predictions.set(date, new Map())
    cache.loadedDates.add(date)
    return cache.predictions
  }

  const { data: predictionsData, error } = await supabase
    .from('predictions')
    .select('user_id, game_id, home_score, away_score')
    .eq('group_id', groupId)
    .in('game_id', gameIds)

  if (error) throw new Error(`Erro ao buscar palpites: ${error.message}`)

  const flatMap = new Map<string, CachedPrediction>()
  for (const row of (predictionsData ?? []) as CachedPrediction[]) {
    flatMap.set(`${row.game_id}:${row.user_id}`, row)
  }

  cache.predictions.set(date, flatMap)
  cache.loadedDates.add(date)

  // Iniciar Realtime se ainda não iniciado
  ensurePredictionRealtime(groupId)

  // Iniciar polling se ainda não iniciado e há jogos pending na data
  startPredictionPolling(groupId)

  return cache.predictions
}

/**
 * Retorna palpites cacheados (ou vazio se ainda não carregados).
 */
export function getCachedPredictions(
  groupId: string
): Map<string, Map<string, CachedPrediction>> {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return new Map()

  // Merge de todas as datas carregadas, convertendo flat → nested
  const nested = new Map<string, Map<string, CachedPrediction>>()
  for (const dateMap of cache.predictions.values()) {
    for (const [key, pred] of dateMap) {
      const [gameId, userId] = key.split(':')
      if (!nested.has(gameId)) {
        nested.set(gameId, new Map())
      }
      nested.get(gameId)!.set(userId, pred)
    }
  }
  return nested
}

/**
 * Retorna os palpites apenas do usuário atual.
 */
export function getMyPredictions(
  groupId: string,
  currentUserId: string
): Map<string, CachedPrediction> {
  const all = getCachedPredictions(groupId)
  const mine = new Map<string, CachedPrediction>()
  for (const [gameId, userMap] of all) {
    const pred = userMap.get(currentUserId)
    if (pred) mine.set(gameId, pred)
  }
  return mine
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

function ensurePredictionRealtime(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  if (cache.channel) return

  const supabase = createClient()

  cache.channel = supabase
    .channel(`predictions-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'predictions',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const eventType = payload.eventType ?? 'UPDATE'
        const ts = new Date().toLocaleTimeString('pt-BR')
        const row = (payload.new as CachedPrediction | null) ?? (payload.old as CachedPrediction | null)
        const score = row ? `${row.home_score}×${row.away_score}` : '?×?'
        const teams = row ? getTeamCodes(row.game_id) : null
        const matchup = teams ? `${teams.home} x ${teams.away}` : '? x ?'
        console.log(`%c[PredictionCache] %c◄ RECEBIDO %c${eventType} %c| ${matchup} %c| palpite ${score} %c| ${ts}`,
          'color:#FFDF00;font-weight:bold', 'color:#00d26a', 'color:#f0f4f8', 'color:#f0f4f8', 'color:#5a7a6a', 'color:#5a7a6a')
        // Invalida cache para forçar refetch no próximo acesso
        invalidatePredictionCache(groupId)
      }
    )
    .subscribe((status) => {
      const newStatus =
        status === 'SUBSCRIBED'
          ? 'connected'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
            ? 'error'
            : 'connecting'
      cache.connectionStatus = newStatus
    })
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

function startPredictionPolling(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  if (cache.pollingInterval) return

  cache.pollingInterval = setInterval(() => {
    invalidatePredictionCache(groupId)
  }, POLL_INTERVAL_MS)

  // visibilitychange: ao voltar do sleep, refetch e reseta polling
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      invalidatePredictionCache(groupId)
      // Resetar intervalo
      if (cache.pollingInterval) clearInterval(cache.pollingInterval)
      cache.pollingInterval = setInterval(() => {
        invalidatePredictionCache(groupId)
      }, POLL_INTERVAL_MS)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Guarda referência para cleanup
  ;(cache as unknown as Record<string, unknown>)._visibilityHandler = onVisibility
}

function stopPredictionPolling(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  if (cache.pollingInterval) {
    clearInterval(cache.pollingInterval)
    cache.pollingInterval = null
  }
  const handler = (cache as unknown as Record<string, unknown>)._visibilityHandler as (() => void) | undefined
  if (handler) {
    document.removeEventListener('visibilitychange', handler)
  }
}

function invalidatePredictionCache(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return

  const listenerCount = cache.listeners.size
  const ts = new Date().toLocaleTimeString('pt-BR')
  console.log(`%c[PredictionCache] %c► INVALIDANDO %c| ${listenerCount} listener(s) %c| ${ts}`,
    'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')

  // Limpa todas as datas carregadas para forçar refetch
  cache.predictions.clear()
  cache.loadedDates.clear()

  // Notifica listeners
  for (const listener of cache.listeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// Subscription (para hooks)
// ---------------------------------------------------------------------------

export function subscribeToPredictionInvalidations(
  groupId: string,
  listener: () => void
): () => void {
  const cache = getOrCreateGroupCache(groupId)
  cache.listeners.add(listener)
  return () => {
    cache.listeners.delete(listener)
  }
}

export function acquirePredictionCache(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  cache.refCount++
}

export function releasePredictionCache(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  cache.refCount--
  if (cache.refCount <= 0) {
    cache.refCount = 0
    stopPredictionPolling(groupId)
    if (cache.channel) {
      const supabase = createClient()
      supabase.removeChannel(cache.channel)
      cache.channel = null
    }
    cache.listeners.clear()
  }
}

/**
 * Limpa todo o cache de um grupo (útil ao trocar de grupo).
 */
export function clearPredictionCache(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  stopPredictionPolling(groupId)
  if (cache.channel) {
    const supabase = createClient()
    supabase.removeChannel(cache.channel)
    cache.channel = null
  }
  cachesByGroup.delete(groupId)
}
