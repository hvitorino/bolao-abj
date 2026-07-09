'use client'

import { createClient } from '@/lib/supabase/client'
import type { ScoreBreakdown } from '@/lib/types/score'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CachedPoints {
  user_id: string
  game_id: string
  group_id: string
  points: number
  breakdown: ScoreBreakdown
}

// ---------------------------------------------------------------------------
// Cache module-level (singleton) — escopado por groupId
// ---------------------------------------------------------------------------

interface GroupCache {
  /** Estrutura nested: gameId → userId → CachedPoints. SEM flat-key. */
  points: Map<string, Map<string, CachedPoints>>
  channel: ReturnType<ReturnType<typeof createClient>['channel']> | null
  pollingInterval: ReturnType<typeof setInterval> | null
  connectionStatus: 'connecting' | 'connected' | 'error'
  /** Listeners de invalidação coarse (qualquer mudança no grupo). */
  listeners: Map<string, () => void>
  /** Listeners granulares: recebem o CachedPoints alterado + eventType. */
  detailListeners: Map<string, (points: CachedPoints, eventType: string) => void>
  /** Datas já carregadas — evita refetch desnecessário. */
  loadedDates: Set<string>
  refCount: number
}

const cachesByGroup = new Map<string, GroupCache>()
let listenerCounter = 0

const POLL_INTERVAL_MS = 60_000

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getOrCreateGroupCache(groupId: string): GroupCache {
  let cache = cachesByGroup.get(groupId)
  if (!cache) {
    cache = {
      points: new Map(),
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

/**
 * Busca as pontuações (jogos 'finished') de uma data e retorna as linhas,
 * sem tocar no cache. Usado por invalidatePointsCache para revalidar sem
 * esvaziar o mapa.
 */
async function loadPointsForDate(
  groupId: string,
  date: string
): Promise<CachedPoints[]> {
  const supabase = createClient()
  const { data: gamesData } = await supabase
    .from('games')
    .select('id')
    .eq('match_day', date)
    .eq('status', 'finished')

  const gameIds = (gamesData ?? []).map((g: { id: string }) => g.id)
  if (gameIds.length === 0) return []

  const { data: scoresData, error } = await supabase
    .from('scores')
    .select('user_id, game_id, group_id, points, breakdown')
    .eq('group_id', groupId)
    .in('game_id', gameIds)

  if (error) throw new Error(`Erro ao buscar pontuações: ${error.message}`)
  return (scoresData ?? []) as CachedPoints[]
}

// ---------------------------------------------------------------------------
// API pública — funções exportadas
// ---------------------------------------------------------------------------

/**
 * Carrega as pontuações de uma data para um grupo no cache.
 * Datas já carregadas retornam imediatamente (early-return).
 * Busca apenas scores de jogos com status 'finished' — scores só existem
 * para jogos finalizados.
 */
export async function ensurePoints(
  groupId: string,
  date: string
): Promise<Map<string, Map<string, CachedPoints>>> {
  const cache = getOrCreateGroupCache(groupId)

  if (cache.loadedDates.has(date)) return cache.points

  const supabase = createClient()

  // 1. Buscar gameIds com status 'finished' na data
  const { data: gamesData } = await supabase
    .from('games')
    .select('id')
    .eq('match_day', date)
    .eq('status', 'finished')

  const gameIds = (gamesData ?? []).map((g: { id: string }) => g.id)

  if (gameIds.length === 0) {
    // Nenhum jogo finalizado na data — marcar como carregada e retornar
    cache.loadedDates.add(date)
    return cache.points
  }

  // 2. Buscar scores filtrados por grupo e jogos
  const { data: scoresData, error } = await supabase
    .from('scores')
    .select('user_id, game_id, group_id, points, breakdown')
    .eq('group_id', groupId)
    .in('game_id', gameIds)

  if (error) throw new Error(`Erro ao buscar pontuações: ${error.message}`)

  // 3. Upsert incondicional no map nested — sem flat-key
  for (const row of (scoresData ?? []) as CachedPoints[]) {
    if (!cache.points.has(row.game_id)) {
      cache.points.set(row.game_id, new Map())
    }
    cache.points.get(row.game_id)!.set(row.user_id, row)
  }

  cache.loadedDates.add(date)

  // 4. Garantir Realtime e polling
  ensurePointsRealtime(groupId)
  startPointsPolling(groupId)

  return cache.points
}

/**
 * Carrega as pontuações de um único jogo para um grupo no cache.
 * Usado por páginas públicas que carregam jogo por jogo (Stage 6).
 */
export async function ensurePointsForGame(
  groupId: string,
  gameId: string
): Promise<void> {
  const cache = getOrCreateGroupCache(groupId)

  const supabase = createClient()
  const { data: scoresData, error } = await supabase
    .from('scores')
    .select('user_id, game_id, group_id, points, breakdown')
    .eq('group_id', groupId)
    .eq('game_id', gameId)

  if (error) throw new Error(`Erro ao buscar pontuações do jogo: ${error.message}`)

  // Upsert incondicional no map nested
  for (const row of (scoresData ?? []) as CachedPoints[]) {
    if (!cache.points.has(row.game_id)) {
      cache.points.set(row.game_id, new Map())
    }
    cache.points.get(row.game_id)!.set(row.user_id, row)
  }

  ensurePointsRealtime(groupId)
}

/**
 * Retorna o map nested de pontuações cacheadas (leitura síncrona).
 * Não executa fetch — retorna o Map diretamente sem reconversão.
 */
export function getCachedPoints(
  groupId: string
): Map<string, Map<string, CachedPoints>> {
  return cachesByGroup.get(groupId)?.points ?? new Map()
}

/**
 * Retorna a pontuação de um usuário em um jogo específico, ou null se não encontrado.
 */
export function getPointsFor(
  groupId: string,
  gameId: string,
  userId: string
): CachedPoints | null {
  return cachesByGroup.get(groupId)?.points.get(gameId)?.get(userId) ?? null
}

/**
 * Registra listener granular que recebe a pontuação alterada + tipo do evento.
 * Usado por hooks que suportam atualização granular (sem refetch completo).
 * @returns função de unsub
 */
export function subscribeToPointsUpdates(
  groupId: string,
  source: string,
  listener: (points: CachedPoints, eventType: string) => void
): () => void {
  const cache = getOrCreateGroupCache(groupId)
  const id = `${source}#${++listenerCounter}`
  cache.detailListeners.set(id, listener)
  return () => {
    cache.detailListeners.delete(id)
  }
}

/**
 * Registra listener de invalidação coarse — disparado em qualquer mudança no grupo.
 * @returns função de unsub
 */
export function subscribeToPointsInvalidations(
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
 * Incrementa refCount e garante canal Realtime.
 * Subscribers que não chamam ensurePoints dependem disso para receber eventos.
 */
export function acquirePointsCache(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  cache.refCount++
  // OBRIGATÓRIO: garante canal Realtime mesmo sem ensurePoints ter sido chamado.
  // Subscribers que não carregam data específica (ex: useRankingRealtime no Stage 2)
  // dependem disso para receber eventos — mesmo motivo do comentário em acquirePredictionCache.
  ensurePointsRealtime(groupId)
}

/**
 * Decrementa refCount. Quando chega a zero, fecha canal e para polling.
 */
export function releasePointsCache(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  cache.refCount--
  if (cache.refCount <= 0) {
    cache.refCount = 0
    stopPointsPolling(groupId)
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
 * Teardown completo do cache de um grupo.
 * Usado ao trocar de grupo ativo.
 */
export function clearPointsCache(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  stopPointsPolling(groupId)
  if (cache.channel) {
    const supabase = createClient()
    supabase.removeChannel(cache.channel)
    cache.channel = null
  }
  cachesByGroup.delete(groupId)
}

// ---------------------------------------------------------------------------
// Realtime — internal
// ---------------------------------------------------------------------------

function ensurePointsRealtime(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  if (cache.channel) return

  const ts = new Date().toLocaleTimeString('pt-BR')
  console.log(
    `%c[PointsCache] %c● CONECTANDO %c| canal points-${groupId.slice(0, 8)} %c| ${ts}`,
    'color:#FFDF00;font-weight:bold',
    'color:#009c3b',
    'color:#f0f4f8',
    'color:#5a7a6a'
  )

  const supabase = createClient()

  cache.channel = supabase
    .channel(`points-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'scores',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const eventType = payload.eventType ?? 'UPDATE'
        const ts = new Date().toLocaleTimeString('pt-BR')

        if (eventType === 'DELETE') {
          const deleted = payload.old as CachedPoints | null
          if (deleted && deleted.game_id && deleted.user_id) {
            const gameMap = cache.points.get(deleted.game_id)
            if (gameMap) gameMap.delete(deleted.user_id)

            console.log(
              `%c[PointsCache] %c◄ RECEBIDO %c${eventType} %c| game ${deleted.game_id.slice(0, 8)} %c| user ${deleted.user_id.slice(0, 8)} %c| ${ts}`,
              'color:#FFDF00;font-weight:bold',
              'color:#ff453a',
              'color:#f0f4f8',
              'color:#f0f4f8',
              'color:#5a7a6a',
              'color:#5a7a6a'
            )

            // Notifica listeners granulares com o row deletado
            for (const listener of cache.detailListeners.values()) {
              listener(deleted, 'DELETE')
            }
            // Notifica listeners de invalidação coarse
            for (const listener of cache.listeners.values()) {
              listener()
            }
          }
          return
        }

        const row = (payload.new as CachedPoints | null) ?? (payload.old as CachedPoints | null)

        if (row && row.game_id && row.user_id) {
          // Upsert incondicional — sem verificação de existência prévia
          if (!cache.points.has(row.game_id)) {
            cache.points.set(row.game_id, new Map())
          }
          cache.points.get(row.game_id)!.set(row.user_id, row)

          console.log(
            `%c[PointsCache] %c◄ RECEBIDO %c${eventType} %c| game ${row.game_id.slice(0, 8)} %c| user ${row.user_id.slice(0, 8)} %c| ${row.points} pts %c| ${ts}`,
            'color:#FFDF00;font-weight:bold',
            'color:#00d26a',
            'color:#f0f4f8',
            'color:#f0f4f8',
            'color:#5a7a6a',
            'color:#5a7a6a',
            'color:#5a7a6a'
          )

          // Notifica listeners granulares
          for (const listener of cache.detailListeners.values()) {
            listener(row, eventType)
          }
          // Notifica listeners de invalidação coarse
          for (const listener of cache.listeners.values()) {
            listener()
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
      cache.connectionStatus = newStatus
      const icon =
        status === 'SUBSCRIBED' ? '✓' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? '✗' : '…'
      const color = status === 'SUBSCRIBED' ? 'color:#00d26a' : 'color:#ff453a'
      console.log(
        `%c[PointsCache] %c${icon} ${status} %c| canal points-${groupId.slice(0, 8)} %c| ${new Date().toLocaleTimeString('pt-BR')}`,
        'color:#FFDF00;font-weight:bold',
        color,
        'color:#f0f4f8',
        'color:#5a7a6a'
      )
    })
}

// ---------------------------------------------------------------------------
// Polling — internal
// ---------------------------------------------------------------------------

function startPointsPolling(groupId: string): void {
  const cache = getOrCreateGroupCache(groupId)
  if (cache.pollingInterval) return

  cache.pollingInterval = setInterval(() => {
    void invalidatePointsCache(groupId)
  }, POLL_INTERVAL_MS)

  // visibilitychange: ao voltar do sleep, refetch imediato e reseta polling
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void invalidatePointsCache(groupId)
      // Resetar intervalo
      if (cache.pollingInterval) clearInterval(cache.pollingInterval)
      cache.pollingInterval = setInterval(() => {
        void invalidatePointsCache(groupId)
      }, POLL_INTERVAL_MS)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Guarda referência para cleanup
  ;(cache as unknown as Record<string, unknown>)._visibilityHandler = onVisibility
}

function stopPointsPolling(groupId: string): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  if (cache.pollingInterval) {
    clearInterval(cache.pollingInterval)
    cache.pollingInterval = null
  }
  const handler = (cache as unknown as Record<string, unknown>)._visibilityHandler as
    | (() => void)
    | undefined
  if (handler) {
    document.removeEventListener('visibilitychange', handler)
  }
}

async function invalidatePointsCache(groupId: string): Promise<void> {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return

  const names = Array.from(cache.listeners.keys())
  const ts = new Date().toLocaleTimeString('pt-BR')
  if (names.length > 0) {
    console.log(
      `%c[PointsCache] %c► REVALIDANDO %c| ${names.join(', ')} %c| ${ts}`,
      'color:#FFDF00;font-weight:bold',
      'color:#009c3b',
      'color:#f0f4f8',
      'color:#5a7a6a'
    )
  }

  // Revalidação SEM esvaziar: refetch das datas carregadas, monta o mapa nested
  // novo e troca atomicamente. O mapa antigo permanece referenciado até o swap —
  // getCachedPoints() nunca retorna vazio no meio do poll.
  const dates = Array.from(cache.loadedDates)
  try {
    const fresh = new Map<string, Map<string, CachedPoints>>()
    const rowsPerDate = await Promise.all(dates.map((d) => loadPointsForDate(groupId, d)))
    for (const rows of rowsPerDate) {
      for (const row of rows) {
        if (!fresh.has(row.game_id)) fresh.set(row.game_id, new Map())
        fresh.get(row.game_id)!.set(row.user_id, row)
      }
    }
    cache.points = fresh
    cache.loadedDates = new Set(dates)
  } catch (err) {
    console.error('[PointsCache] erro ao revalidar, mantendo dados anteriores:', err)
  }

  // Notifica consumidores granulares com as linhas reais — o PublicParticipantsList
  // atualiza o participante pelo payload; os demais recomputam de getCachedPoints.
  for (const gameMap of cache.points.values()) {
    for (const row of gameMap.values()) {
      for (const listener of cache.detailListeners.values()) {
        listener(row, 'REFRESH')
      }
    }
  }
  // Notifica consumidores de agregados de servidor (ex: /api/ranking)
  for (const listener of cache.listeners.values()) {
    listener()
  }
}
