'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScoreBreakdown } from '@/lib/types/score'

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
// Helpers de data (BRT = UTC-3)
// ---------------------------------------------------------------------------

/**
 * Retorna os limites ISO 8601 (em UTC) para "ontem em BRT".
 *
 * Exemplo: agora = 2026-06-19T01:30Z (= 22:30 BRT de 18/06)
 *   → nowBRT = 2026-06-18T22:30  → "ontem em BRT" = 2026-06-17
 *   → yesterdayStart = 2026-06-17T03:00Z  (= 00:00 BRT de 17/06)
 *   → yesterdayEnd   = 2026-06-18T03:00Z  (= 00:00 BRT de 18/06)
 */
function getBRTDayBounds(): { yesterdayStart: string; yesterdayEnd: string } {
  const nowUTC = new Date()
  // Deriva a hora atual em BRT subtraindo 3h
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)

  // "Ontem" no calendário BRT
  const yesterdayBRT = new Date(nowBRT)
  yesterdayBRT.setUTCDate(yesterdayBRT.getUTCDate() - 1)

  // 00:00 BRT = 03:00 UTC — início do dia de ontem em BRT (como UTC)
  const ys = new Date(
    Date.UTC(
      yesterdayBRT.getUTCFullYear(),
      yesterdayBRT.getUTCMonth(),
      yesterdayBRT.getUTCDate(),
      3,
      0,
      0,
      0
    )
  )

  // 00:00 BRT do dia seguinte = 03:00 UTC do dia seguinte (= fim do dia ontem BRT)
  const ye = new Date(
    Date.UTC(
      yesterdayBRT.getUTCFullYear(),
      yesterdayBRT.getUTCMonth(),
      yesterdayBRT.getUTCDate() + 1,
      3,
      0,
      0,
      0
    )
  )

  return {
    yesterdayStart: ys.toISOString(),
    yesterdayEnd: ye.toISOString(),
  }
}

/** Formata a data de ontem em BRT como "DD/MM/YYYY". */
function getYesterdayLabelBRT(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yBRT = new Date(nowBRT)
  yBRT.setUTCDate(yBRT.getUTCDate() - 1)
  const dd = String(yBRT.getUTCDate()).padStart(2, '0')
  const mm = String(yBRT.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = yBRT.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
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

  // Critério secundário: artilharia de palpites (soma home_score + away_score)
  const goalsByUser = predictions.reduce(
    (acc, p) => {
      const total = (p.home_score ?? 0) + (p.away_score ?? 0)
      acc[p.user_id] = (acc[p.user_id] ?? 0) + total
      return acc
    },
    {} as Record<string, number>
  )

  const artilheiroEntries = Object.entries(goalsByUser)
    .map(([userId, total]) => ({
      userId,
      total,
      name: nameByUserId[userId] ?? userId,
    }))
    .sort((a, b) => b.total - a.total)

  if (videntes.length > 0 || artilheiroEntries.length > 0) {
    let recipient: string
    let description: string
    let secondaryDescription: string | undefined

    if (videntes.length > 0) {
      // Recipient baseado no líder de acertos exatos
      const topCount = videntes[0].count
      const topVidentes = videntes.filter((v) => v.count === topCount)
      const videnteNames = topVidentes.map((v) => v.name).join(' e ')
      recipient = videnteNames
      description =
        topCount === 1
          ? `${videnteNames} acertou 1 placar exato. Poderes sobrenaturais.`
          : `${videnteNames} acertou ${topCount} placar(es) exato(s). Poderes sobrenaturais.`

      // Dado secundário de artilharia
      if (artilheiroEntries.length > 0) {
        const topGoals = artilheiroEntries[0].total
        const topArtilheiros = artilheiroEntries.filter(
          (a) => a.total === topGoals
        )
        const artNames = topArtilheiros.map((a) => a.name).join(' e ')
        secondaryDescription =
          topArtilheiros.length === 1
            ? `Artilharia dos palpites: ${artNames} apostou ${topGoals} gols no total.`
            : `Artilharia dos palpites: ${artNames} apostaram ${topGoals} gols no total.`
      }
    } else if (artilheiroEntries.length > 0) {
      // Fallback: ninguém acertou placar exato — badge baseado só na artilharia
      const topGoals = artilheiroEntries[0].total
      const topArtilheiros = artilheiroEntries.filter(
        (a) => a.total === topGoals
      )
      const artNames = topArtilheiros.map((a) => a.name).join(' e ')
      recipient = artNames
      description =
        topArtilheiros.length === 1
          ? `Ninguém acertou o placar exato. Mas ${artNames} apostou alto: ${topGoals} gols no total.`
          : `Ninguém acertou o placar exato. Mas ${artNames} apostaram alto: ${topGoals} gols no total.`
    } else {
      // Edge case: sem dados suficientes — não emitir badge
      recipient = ''
      description = ''
    }

    if (recipient) {
      badges.push({
        key: 'mae_dina',
        label: 'MAE DINA',
        recipient,
        description,
        ...(secondaryDescription ? { secondaryDescription } : {}),
      })
    }
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
 * A chave muda quando a data BRT muda, invalidando o cache automaticamente.
 */
function getRecapCacheKey(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = nowBRT.getUTCFullYear()
  const mm = String(nowBRT.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowBRT.getUTCDate()).padStart(2, '0')
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
      const supabase = createClient()
      const { yesterdayStart, yesterdayEnd } = getBRTDayBounds()

      // 1. Jogos finalizados do dia anterior em BRT
      const { data: gamesRaw, error: gamesError } = await supabase
        .from('games')
        .select(
          'id, home_team, away_team, home_team_code, away_team_code, home_score, away_score, match_date'
        )
        .eq('status', 'finished')
        .gte('match_date', yesterdayStart)
        .lt('match_date', yesterdayEnd)

      if (gamesError || !gamesRaw || gamesRaw.length === 0) {
        return null
      }

      const gameIds = gamesRaw.map((g) => g.id)

      // 2. Scores e predictions em paralelo
      const [scoresResult, predictionsResult] = await Promise.all([
        supabase
          .from('scores')
          .select(
            'user_id, game_id, points, breakdown, profiles!inner(name)'
          )
          .in('game_id', gameIds)
          .eq('group_id', groupId),
        supabase
          .from('predictions')
          .select('user_id, game_id, home_score, away_score')
          .in('game_id', gameIds)
          .eq('group_id', groupId),
      ])

      if (scoresResult.error || predictionsResult.error) {
        return null
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scoresRaw: RawScore[] = (scoresResult.data ?? []).map((s: any) => ({
        user_id: s.user_id,
        game_id: s.game_id,
        points: s.points,
        breakdown: s.breakdown as ScoreBreakdown,
        participant_name: s.profiles?.name ?? s.user_id,
      }))

      const predictions: RawPrediction[] = (predictionsResult.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ({
          user_id: p.user_id,
          game_id: p.game_id,
          home_score: p.home_score ?? 0,
          away_score: p.away_score ?? 0,
        })
      )

      // 3. Calcular rankingDay: agrupar scores por user_id
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
            name: p.user_id, // fallback; será sobrescrito se houver score
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

      // 4. Badges
      const badges = calcBadges(rankingDay, scoresRaw, predictions)

      // 5. Montar RecapGame
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
        yesterdayLabel: getYesterdayLabelBRT(),
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
