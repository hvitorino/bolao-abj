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
  /** Estrutura nested: gameId → userId → CachedPrediction. SEM flat-key nem bucket por data. */
  predictions: Map<string, Map<string, CachedPrediction>>
  channel: ReturnType<ReturnType<typeof createClient>['channel']> | null
  pollingInterval: ReturnType<typeof setInterval> | null
  connectionStatus: 'connecting' | 'connected' | 'error'
  /** Listeners de invalidação coarse (qualquer mudança no grupo). */
  listeners: Map<string, () => void>
  /** Listeners granulares: recebem o CachedPrediction alterado + eventType. */
  detailListeners: Map<string, (pred: CachedPrediction, eventType: string) => void>
  /** Datas já totalmente carregadas do banco — evita refetch e guarda o ensure. */
  loadedDates: Set<string>
  refCount: number
}

const cachesByGroup = new Map<string, GroupCache>()
let listenerCounter = 0
let authRecoverySet = false

const POLL_INTERVAL_MS = 60_000

/**
 * Rede de segurança contra o cold load pós-login: quando a sessão de auth fica
 * disponível (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED), revalida todos os caches
 * ativos. Se o primeiro fetch saiu anon (RLS devolveu vazio para jogos pending) e
 * o guard de loadedDates travou o resultado, isto refaz o fetch já autenticado —
 * invalidatePredictionCache ignora o guard. Registrado uma única vez por app.
 */
function ensureAuthRecovery(): void {
  if (authRecoverySet) return
  authRecoverySet = true
  const supabase = createClient()
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      session &&
      (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
    ) {
      for (const groupId of cachesByGroup.keys()) {
        void invalidatePredictionCache(groupId)
      }
    }
  })
}

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

/** Upsert incondicional no map nested (gameId → userId → pred). */
function setPrediction(cache: GroupCache, pred: CachedPrediction): void {
  if (!cache.predictions.has(pred.game_id)) {
    cache.predictions.set(pred.game_id, new Map())
  }
  cache.predictions.get(pred.game_id)!.set(pred.user_id, pred)
}

/**
 * Busca os palpites de uma data e retorna as linhas, sem tocar no cache.
 * Usado por ensurePredictions e por invalidatePredictionCache (revalidação
 * sem swap-para-vazio).
 */
async function loadPredictionsForDate(
  groupId: string,
  date: string
): Promise<CachedPrediction[]> {
  const supabase = createClient()

  // Aguarda a sessão hidratar antes de consultar palpites. A RLS de predictions
  // é owner-scoped em jogos pending (só o próprio palpite, exige auth.uid()); no
  // cold load pós-login a query pode sair antes do token anexar → volta vazia e
  // o guard de loadedDates travaria o resultado. games/scores são legíveis por
  // anon e mascaram esse problema — por isso só os palpites somem.
  await supabase.auth.getSession()

  const { data: gamesData } = await supabase
    .from('games')
    .select('id')
    .eq('match_day', date)

  const gameIds = (gamesData ?? []).map((g: { id: string }) => g.id)
  if (gameIds.length === 0) return []

  const { data: predictionsData, error } = await supabase
    .from('predictions')
    .select('user_id, game_id, home_score, away_score')
    .eq('group_id', groupId)
    .in('game_id', gameIds)

  if (error) throw new Error(`Erro ao buscar palpites: ${error.message}`)
  return (predictionsData ?? []) as CachedPrediction[]
}

// ---------------------------------------------------------------------------
// API do cache
// ---------------------------------------------------------------------------

/**
 * Carrega os palpites de uma data para um grupo no cache.
 * Datas já carregadas retornam imediatamente (early-return por loadedDates —
 * um bucket pode existir por write-through sem ter sido totalmente carregado).
 */
export async function ensurePredictions(
  groupId: string,
  date: string
): Promise<Map<string, Map<string, CachedPrediction>>> {
  const cache = getOrCreateGroupCache(groupId)

  if (cache.loadedDates.has(date)) return cache.predictions

  const rows = await loadPredictionsForDate(groupId, date)
  for (const row of rows) setPrediction(cache, row)
  cache.loadedDates.add(date)

  // Iniciar Realtime e polling se ainda não iniciados
  ensurePredictionRealtime(groupId)
  startPredictionPolling(groupId)

  return cache.predictions
}

/**
 * Retorna o map nested de palpites cacheados (leitura síncrona, sem fetch).
 */
export function getCachedPredictions(
  groupId: string
): Map<string, Map<string, CachedPrediction>> {
  return cachesByGroup.get(groupId)?.predictions ?? new Map()
}

/**
 * Retorna os palpites apenas do usuário atual (gameId → CachedPrediction).
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
// Write-through público — mantém o cache como fonte única de verdade
// ---------------------------------------------------------------------------

/**
 * Grava um palpite recebido do banco no cache e notifica os assinantes na hora,
 * sem esperar o eco Realtime. Usado por todo caminho cliente que obtém um palpite
 * fora do fluxo do próprio cache (resposta de POST/PATCH, fetch de analise-data,
 * fetch do bracket). No-op se nenhum consumidor adquiriu o cache do grupo.
 */
export function upsertPrediction(groupId: string, pred: CachedPrediction): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return
  setPrediction(cache, pred)
  for (const listener of cache.detailListeners.values()) {
    listener(pred, 'WRITE_THROUGH')
  }
}

/**
 * Write-through em lote (ex: todos os palpites de um jogo vindos de analise-data).
 */
export function upsertPredictions(groupId: string, preds: CachedPrediction[]): void {
  const cache = cachesByGroup.get(groupId)
  if (!cache || preds.length === 0) return
  for (const pred of preds) setPrediction(cache, pred)
  for (const listener of cache.detailListeners.values()) {
    for (const pred of preds) listener(pred, 'WRITE_THROUGH')
  }
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

function ensurePredictionRealtime(groupId: string): void {
  ensureAuthRecovery()
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
          if (deleted && deleted.game_id && deleted.user_id) {
            cache.predictions.get(deleted.game_id)?.delete(deleted.user_id)
          }
        } else if (row && row.game_id && row.user_id) {
          // Upsert incondicional — sem verificação de bucket/data
          setPrediction(cache, row)
        }

        // Notifica listeners com detalhes do palpite alterado
        if (row) {
          for (const listener of cache.detailListeners.values()) {
            listener(row, eventType)
          }
        }
        // Fallback: listeners coarse que precisam de refetch completo
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
    void invalidatePredictionCache(groupId)
  }, POLL_INTERVAL_MS)

  // visibilitychange: ao voltar do sleep, refetch e reseta polling
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void invalidatePredictionCache(groupId)
      // Resetar intervalo
      if (cache.pollingInterval) clearInterval(cache.pollingInterval)
      cache.pollingInterval = setInterval(() => {
        void invalidatePredictionCache(groupId)
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

async function invalidatePredictionCache(groupId: string): Promise<void> {
  const cache = cachesByGroup.get(groupId)
  if (!cache) return

  const names = Array.from(cache.listeners.keys())
  const ts = new Date().toLocaleTimeString('pt-BR')
  if (names.length > 0) {
    console.log(`%c[PredictionCache] %c► REVALIDANDO %c| ${names.join(', ')} %c| ${ts}`,
      'color:#FFDF00;font-weight:bold', 'color:#009c3b', 'color:#f0f4f8', 'color:#5a7a6a')
  }

  // Revalidação SEM esvaziar: refetch das datas carregadas, monta um mapa nested
  // novo e troca atomicamente. O mapa antigo permanece referenciado até o swap —
  // logo getCachedPredictions() nunca retorna vazio no meio do poll.
  const dates = Array.from(cache.loadedDates)
  try {
    const fresh = new Map<string, Map<string, CachedPrediction>>()
    const rowsPerDate = await Promise.all(dates.map((d) => loadPredictionsForDate(groupId, d)))
    for (const rows of rowsPerDate) {
      for (const row of rows) {
        if (!fresh.has(row.game_id)) fresh.set(row.game_id, new Map())
        fresh.get(row.game_id)!.set(row.user_id, row)
      }
    }
    cache.predictions = fresh
    cache.loadedDates = new Set(dates)
  } catch (err) {
    console.error('[PredictionCache] erro ao revalidar, mantendo dados anteriores:', err)
  }

  // Notifica consumidores granulares (recomputam de getCachedPredictions) com as
  // linhas reais — nenhum consumidor ramifica em eventType.
  for (const gameMap of cache.predictions.values()) {
    for (const pred of gameMap.values()) {
      for (const listener of cache.detailListeners.values()) {
        listener(pred, 'REFRESH')
      }
    }
  }
  // Notifica consumidores de agregados de servidor (ex: /api/ranking)
  for (const listener of cache.listeners.values()) {
    listener()
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
