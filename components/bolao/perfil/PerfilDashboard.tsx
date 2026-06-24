'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CampaignPanel } from './CampaignPanel'
import { PerformancePanel } from './PerformancePanel'
import { TrophiesPanel } from './TrophiesPanel'
import { HistoryPanel } from './HistoryPanel'
import type { CampaignData } from './CampaignPanel'
import type { PerformanceData } from './PerformancePanel'
import type { TrophiesData, Trophy } from './TrophiesPanel'
import type { HistoryData, HistoryItem } from './HistoryPanel'

export type SectionState<T> =
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'populated'; data: T }

interface PerfilDashboardProps {
  groupId: string
  userId: string
  userName: string
}

const HISTORY_PAGE_SIZE = 20

export function PerfilDashboard({ groupId, userId, userName }: PerfilDashboardProps) {
  const [campaign, setCampaign] = useState<SectionState<CampaignData>>({ status: 'loading' })
  const [performance, setPerformance] = useState<SectionState<PerformanceData>>({ status: 'loading' })
  const [trophies, setTrophies] = useState<SectionState<TrophiesData>>({ status: 'loading' })
  const [history, setHistory] = useState<SectionState<HistoryData>>({ status: 'loading' })
  const [historyOffset, setHistoryOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Buscar token JWT uma vez
  const getToken = useCallback(async (): Promise<string | null> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // Fetch paralelo das 4 seções no mount
  useEffect(() => {
    async function fetchAll() {
      const token = await getToken()
      if (!token) {
        setCampaign({ status: 'error', message: 'Sessão expirada.' })
        setPerformance({ status: 'error', message: 'Sessão expirada.' })
        setTrophies({ status: 'error', message: 'Sessão expirada.' })
        setHistory({ status: 'error', message: 'Sessão expirada.' })
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      const qs = `group_id=${encodeURIComponent(groupId)}`

      // Disparar todas em paralelo — cada seção tem seu próprio estado de erro
      await Promise.allSettled([
        fetch(`/api/profile/campaign?${qs}`, { headers })
          .then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            const data: CampaignData = await r.json()
            setCampaign({ status: 'populated', data })
          })
          .catch((e) => setCampaign({ status: 'error', message: String(e) })),

        fetch(`/api/profile/performance?${qs}`, { headers })
          .then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            const data: PerformanceData = await r.json()
            setPerformance({ status: 'populated', data })
          })
          .catch((e) => setPerformance({ status: 'error', message: String(e) })),

        fetch(`/api/profile/trophies?${qs}`, { headers })
          .then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            const data: TrophiesData = await r.json()
            setTrophies({ status: 'populated', data })
          })
          .catch((e) => setTrophies({ status: 'error', message: String(e) })),

        fetch(`/api/profile/history?${qs}&limit=${HISTORY_PAGE_SIZE}&offset=0`, { headers })
          .then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            const data: HistoryData = await r.json()
            setHistory({ status: 'populated', data })
            setHistoryOffset(HISTORY_PAGE_SIZE)
          })
          .catch((e) => setHistory({ status: 'error', message: String(e) })),
      ])
    }

    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId])

  // Carregar mais itens do histórico
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return
    const token = await getToken()
    if (!token) return

    setLoadingMore(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const qs = `group_id=${encodeURIComponent(groupId)}&limit=${HISTORY_PAGE_SIZE}&offset=${historyOffset}`
      const r = await fetch(`/api/profile/history?${qs}`, { headers })
      if (!r.ok) throw new Error(`${r.status}`)
      const newData: HistoryData = await r.json()

      setHistory((prev) => {
        if (prev.status !== 'populated') return prev
        const existingIds = new Set(prev.data.items.map((i: HistoryItem) => i.game_id))
        const newItems = newData.items.filter((i: HistoryItem) => !existingIds.has(i.game_id))
        return {
          status: 'populated',
          data: {
            items: [...prev.data.items, ...newItems],
            total: newData.total,
            has_more: newData.has_more,
          },
        }
      })
      setHistoryOffset((prev) => prev + HISTORY_PAGE_SIZE)
    } catch {
      // falha silenciosa no load more — os itens anteriores permanecem
    } finally {
      setLoadingMore(false)
    }
  }, [groupId, historyOffset, loadingMore, getToken])

  const trophyList: Trophy[] =
    trophies.status === 'populated' ? trophies.data.trophies : []
  const negativeTrophyList: Trophy[] =
    trophies.status === 'populated' ? trophies.data.negativeTrophies : []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      <CampaignPanel state={campaign} userName={userName} />
      <PerformancePanel state={performance} />
      <TrophiesPanel state={trophies} />
      <HistoryPanel
        state={history}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        trophies={trophyList}
        negativeTrophies={negativeTrophyList}
      />
    </div>
  )
}
