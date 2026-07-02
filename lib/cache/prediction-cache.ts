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
  predictions: Map<string, Map<string, CachedPrediction>>
  channel: ReturnType<ReturnType<typeof createClient>['channel']> | null
  pollingInterval: ReturnType<typeof setInterval> | null
  connectionStatus: 'connecting' | 'connected' | 'error'
  listeners: Map<string, () => void>
  detailListeners: Map<string, (pred: CachedPrediction, eventType: string) => void>
  loadedDates: Set<string>
  refCount: number
}

const cachesByGroup = new Map<string, GroupCache>()
let listenerCounter = 0

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
      listeners: new Map(),
      detailListeners: new Map(),
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

  const ts = new Date().toLocaleTimeString('pt-BR')
  console.log(`%c[PredictionCache] %c● CONECTANDO %c| canal predictions-${groupId.slice(0,8)} %c| ${ts}`,
    'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')

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

        if (eventType === 'DELETE') {
          const deleted = payload.old as CachedPrediction | null
          if (deleted) removePredictionFromCache(groupId, deleted.game_id, deleted.user_id)
        } else if (row && row.game_id && row.user_id) {
          upsertPredictionInCache(groupId, row)
        }

        // Notifica listeners com detalhes do palpite alterado
        if (row) {
          for (const listener of cache.detailListeners.values()) {
            listener(row, eventType)
          }
        }
        // Fallback: listeners antigos que precisam de refetch completo
        for (const listener of cache.listeners.values()) {
          listener()
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
      cache.connectionStatus = newStatus
      const icon = status === 'SUBSCRIBED' ? '✓' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? '✗' : '…'
      const color = status === 'SUBSCRIBED' ? 'color:#00d26a' : 'color:#ff453a'
      console.log(`%c[PredictionCache] %c${icon} ${status} %c| canal predictions-${groupId.slice(0,8)} %c| ${new Date().toLocaleTimeString('pt-BR')}`,
        'color:#FFDF00;font-weight:bold', color, 'color:#f0f4f8', 'color:#5a7a6a')
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

  const names = Array.from(cache.listeners.keys())
  const ts = new Date().toLocaleTimeString('pt-BR')
  if (names.length > 0) {
    console.log(`%c[PredictionCache] %c► INVALIDANDO %c| ${names.join(', ')} %c| ${ts}`,
      'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')
  }

  cache.predictions.clear()
  cache.loadedDates.clear()

  for (const listener of cache.listeners.values()) {
    listener()
  }
}

/**
 * Atualiza diretamente um palpite no cache, sem invalidar tudo.
 */
function upsertPredictionInCache(groupId: string, pred: CachedPrediction): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return

  const key = `${pred.game_id}:${pred.user_id}`
  for (const [, dateMap] of cache.predictions) {
    if (dateMap.has(key)) {
      dateMap.set(key, pred)
      return
    }
  }
}

function removePredictionFromCache(groupId: string, gameId: string, userId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return

  const key = `${gameId}:${userId}`
  for (const [, dateMap] of cache.predictions) {
    dateMap.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Subscription (para hooks)
// ---------------------------------------------------------------------------

export function subscribeToPredictionInvalidations(
  groupId: string,
  source: string,
  listener: () => void
): () => void {
  const cache = getOrCreateGroupCache(groupId)
  const id = `${source}#${++listenerCounter}`
  cache.listeners.set(id, listener)
  return () => {
    cache.listeners.delete(id)
  }
}

/**
 * Registra listener que recebe o palpite alterado + tipo do evento.
 * Usado por hooks que suportam atualização granular (sem refetch completo).
 */
export function subscribeToPredictionUpdates(
  groupId: string,
  source: string,
  listener: (pred: CachedPrediction, eventType: string) => void
): () => void {
  const cache = getOrCreateGroupCache(groupId)
  const id = `${source}#${++listenerCounter}`
  cache.detailListeners.set(id, listener)
  return () => {
    cache.detailListeners.delete(id)
  }
}

export function acquirePredictionCache(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  cache.refCount++
  // Garante que o canal Realtime existe — sem isso, subscribers em páginas
  // que não chamam ensurePredictions (ex: /palpites) nunca recebem eventos.
  ensurePredictionRealtime(groupId)
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
    cache.detailListeners.clear()
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
