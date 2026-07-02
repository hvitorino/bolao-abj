'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScoreBreakdown } from '@/lib/types/score'
import { ensureDate, getCachedGames } from '@/lib/cache/score-cache'
import { ensurePredictions, getCachedPredictions } from '@/lib/cache/prediction-cache'
import { ensurePoints, getCachedPoints } from '@/lib/cache/points-cache'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RecapGame {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}

export interface RankingDayEntry {
  user_id: string
  participant_name: string
  points_yesterday: number
  games_predicted: number
}

export interface RecapBadge {
  key: string
  label: string
  recipient: string
  description: string
  secondaryDescription?: string
}

export interface DailyRecapData {
  yesterdayLabel: string
  games: RecapGame[]
  rankingDay: RankingDayEntry[]
  badges: RecapBadge[]
}

// ---------------------------------------------------------------------------
// Helpers de data — baseados em match_day (dia do calendário ESPN, armazenado no DB)
// ---------------------------------------------------------------------------

/**
 * Retorna "ontem" no calendário ESPN (UTC-5, CDT — fuso mais conservador
 * dos locais da Copa 2026) como YYYY-MM-DD, para filtrar por match_day.
 *
 * O filtro é .eq('match_day', yesterday), sem cálculo de bounds UTC.
 */
function getESPNYesterday(): string {
  const nowUTC = new Date()
  const nowESPN = new Date(nowUTC.getTime() - 5 * 60 * 60 * 1000)
  const y = new Date(nowESPN)
  y.setUTCDate(y.getUTCDate() - 1)
  const yyyy = y.getUTCFullYear()
  const mm = String(y.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(y.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Formata ontem no calendário ESPN como "DD/MM/YYYY" para exibição. */
function getYesterdayLabel(): string {
  const d = getESPNYesterday()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

// ---------------------------------------------------------------------------
// Cálculo de badges
// ---------------------------------------------------------------------------

interface RawScore {
  user_id: string
  game_id: string
  points: number
  breakdown: ScoreBreakdown
  participant_name: string
}

interface RawPrediction {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

function calcBadges(
  rankingDay: RankingDayEntry[],
  scores: RawScore[],
  predictions: RawPrediction[]
): RecapBadge[] {
  const badges: RecapBadge[] = []

  // Mapa nome por user_id
  const nameByUserId: Record<string, string> = {}
  for (const r of rankingDay) {
    nameByUserId[r.user_id] = r.participant_name
  }

  // --- Badge 1: CRAQUE DO DIA ---
  if (rankingDay.length > 0) {
    const maxPts = rankingDay[0].points_yesterday
    if (maxPts > 0) {
      const cracques = rankingDay.filter((r) => r.points_yesterday === maxPts)
      const names = cracques.map((r) => r.participant_name).join(' e ')
      badges.push({
        key: 'craque',
        label: 'CRAQUE DO DIA',
        recipient: names,
        description: `${names} dominou o dia com ${maxPts} pontos. Respeito.`,
      })
    }
  }

  // --- Badge 2: MAE DINA (substitui VIDENTE DO DIA + artilharia de palpites) ---

  // Critério primário: acertos de placar exato
  const exactCountByUser = scores.reduce(
    (acc, s) => {
      if (s.breakdown?.exact > 0) acc[s.user_id] = (acc[s.user_id] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const videntes = Object.entries(exactCountByUser)
    .filter(([, count]) => count > 0)
    .map(([userId, count]) => ({
      userId,
      count,
      name: nameByUserId[userId] ?? userId,
    }))
    .sort((a, b) => b.count - a.count)

  if (videntes.length > 0) {
    const topCount = videntes[0].count
    const topVidentes = videntes.filter((v) => v.count === topCount)
    const videnteNames = topVidentes.map((v) => v.name).join(' e ')
    badges.push({
      key: 'mae_dina',
      label: 'MAE DINA',
      recipient: videnteNames,
      description:
        topCount === 1
          ? `${videnteNames} acertou 1 placar exato. Poderes sobrenaturais.`
          : `${videnteNames} acertou ${topCount} placar(es) exato(s). Poderes sobrenaturais.`,
    })
  }

  // --- Badge 3: PE-FRIO ---
  const quemPalpitou = rankingDay.filter((r) => r.games_predicted > 0)
  if (quemPalpitou.length > 1) {
    const minPts = Math.min(...quemPalpitou.map((r) => r.points_yesterday))
    const maxPts = Math.max(...quemPalpitou.map((r) => r.points_yesterday))
    // Só exibir se há distinção entre o menor e o maior
    if (minPts < maxPts) {
      const peFrios = quemPalpitou.filter((r) => r.points_yesterday === minPts)
      const names = peFrios.map((r) => r.participant_name).join(' e ')
      badges.push({
        key: 'pe_frio',
        label: 'PE-FRIO',
        recipient: names,
        description: `${names} foi generoso: deixou os pontos pra turma.`,
      })
    }
  }

  return badges
}

// ---------------------------------------------------------------------------
// Cache localStorage
// ---------------------------------------------------------------------------

/**
 * Retorna a chave de cache para os dados do recap do dia atual em BRT.
 * Formato: `bolao_recap_data_YYYY-MM-DD`
 * A chave muda quando a data ET muda, invalidando o cache automaticamente.
 */
function getRecapCacheKey(): string {
  const nowUTC = new Date()
  const nowET = new Date(nowUTC.getTime() - 4 * 60 * 60 * 1000)
  const yyyy = nowET.getUTCFullYear()
  const mm = String(nowET.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowET.getUTCDate()).padStart(2, '0')
  return `bolao_recap_data_${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useDailyRecap(groupId: string): {
  data: DailyRecapData | null
  loading: boolean
  hasData: boolean
} {
  // Se não há groupId, inicia já sem loading
  const [data, setData] = useState<DailyRecapData | null>(null)
  const [loading, setLoading] = useState(!!groupId)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    if (!groupId) {
      return
    }

    let cancelled = false

    async function fetchFromSupabase(): Promise<DailyRecapData | null> {
      const yesterday = getESPNYesterday()

      // 1. Carregar caches centralizados para ontem (podem já estar populados)
      await Promise.all([
        ensureDate(yesterday),
        ensurePredictions(groupId, yesterday),
        ensurePoints(groupId, yesterday),
      ])

      // 2. Ler jogos finalizados do cache
      const cachedGames = getCachedGames(yesterday)
      const gamesRaw = cachedGames.filter((g) => g.status === 'finished')

      if (gamesRaw.length === 0) {
        return null
      }

      const gameIds = gamesRaw.map((g) => g.id)

      // 3. Ler palpites e pontuações dos caches
      const allPreds = getCachedPredictions(groupId)       // Map<gameId, Map<userId, CachedPrediction>>
      const allPoints = getCachedPoints(groupId)            // Map<gameId, Map<userId, CachedPoints>>

      // 4. Buscar nomes dos participantes (única query direta restante)
      const supabase = createClient()
      const { data: membersData } = await supabase
        .from('group_members')
        .select('user_id, profiles(name)')
        .eq('group_id', groupId)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nameByUserId: Record<string, string> = {}
      for (const m of (membersData ?? [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (m as any).profiles?.name ?? (m as any).user_id
        nameByUserId[(m as any).user_id] = name
      }

      // 5. Construir arrays RawScore e RawPrediction a partir dos caches
      const scoresRaw: RawScore[] = []
      for (const gameId of gameIds) {
        const gamePoints = allPoints.get(gameId)
        if (!gamePoints) continue
        for (const [userId, cached] of gamePoints) {
          scoresRaw.push({
            user_id: userId,
            game_id: gameId,
            points: cached.points,
            breakdown: cached.breakdown,
            participant_name: nameByUserId[userId] ?? userId,
          })
        }
      }

      const predictions: RawPrediction[] = []
      for (const gameId of gameIds) {
        const gamePreds = allPreds.get(gameId)
        if (!gamePreds) continue
        for (const [userId, pred] of gamePreds) {
          predictions.push({
            user_id: userId,
            game_id: gameId,
            home_score: pred.home_score,
            away_score: pred.away_score,
          })
        }
      }

      // 6. Calcular rankingDay: agrupar scores por user_id
      const byUser: Record<
        string,
        { name: string; points: number; gameIds: Set<string> }
      > = {}

      for (const s of scoresRaw) {
        if (!byUser[s.user_id]) {
          byUser[s.user_id] = {
            name: s.participant_name,
            points: 0,
            gameIds: new Set(),
          }
        }
        byUser[s.user_id].points += s.points
        byUser[s.user_id].gameIds.add(s.game_id)
      }

      // Adicionar participantes que só têm predictions (sem score — 0 pts)
      for (const p of predictions) {
        if (!byUser[p.user_id]) {
          byUser[p.user_id] = {
            name: nameByUserId[p.user_id] ?? p.user_id,
            points: 0,
            gameIds: new Set(),
          }
        }
        byUser[p.user_id].gameIds.add(p.game_id)
      }

      const rankingDay: RankingDayEntry[] = Object.entries(byUser)
        .map(([user_id, v]) => ({
          user_id,
          participant_name: v.name,
          points_yesterday: v.points,
          games_predicted: v.gameIds.size,
        }))
        .sort((a, b) => b.points_yesterday - a.points_yesterday)

      // 7. Badges
      const badges = calcBadges(rankingDay, scoresRaw, predictions)

      // 8. Montar RecapGame
      const games: RecapGame[] = gamesRaw.map((g) => ({
        id: g.id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_team_code: g.home_team_code,
        away_team_code: g.away_team_code,
        home_score: g.home_score ?? 0,
        away_score: g.away_score ?? 0,
      }))

      return {
        yesterdayLabel: getYesterdayLabel(),
        games,
        rankingDay,
        badges,
      }
    }

    async function load() {
      const cacheKey = getRecapCacheKey()

      // Tentar cache hit
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        try {
          const cached = JSON.parse(raw) as DailyRecapData
          // Exibir cache instantaneamente — sem setar loading
          setData(cached)
          setHasData(true)
          setLoading(false)

          // Background sync: atualiza silenciosamente sem alterar loading
          const fresh = await fetchFromSupabase()
          if (cancelled) return
          if (fresh !== null) {
            localStorage.setItem(cacheKey, JSON.stringify(fresh))
            setData(fresh)
          }
          // Se fresh === null (sem jogos), mantém o cache exibido — não sobrescreve
          return
        } catch {
          // JSON corrompido — tratar como cache miss e continuar
        }
      }

      // Cache miss — fetch normal com loading indicator
      setLoading(true)
      const recap = await fetchFromSupabase()
      if (cancelled) return

      if (recap === null) {
        setHasData(false)
        setData(null)
        setLoading(false)
        return
      }

      // Salvar no cache somente quando há jogos (recap.games.length > 0)
      if (recap.games.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(recap))
      }

      setData(recap)
      setHasData(true)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [groupId])

  return { data, loading, hasData }
}
