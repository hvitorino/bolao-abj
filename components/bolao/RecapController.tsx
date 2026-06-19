'use client'

import { useEffect, useRef, useState } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'
import { RecapFooterButton } from './RecapFooterButton'
import { RecapBottomSheet } from './RecapBottomSheet'

// ---------------------------------------------------------------------------
// Helper: chave do localStorage em BRT
// ---------------------------------------------------------------------------

function getRecapKey(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = nowBRT.getUTCFullYear()
  const mm = String(nowBRT.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowBRT.getUTCDate()).padStart(2, '0')
  return `bolao_recap_${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecapControllerProps {
  groupId: string
  currentUserId: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecapController({ groupId, currentUserId }: RecapControllerProps) {
  const [forceOpen, setForceOpen] = useState(false)
  const { loading, hasData, data } = useDailyRecap(groupId)
  const decidedRef = useRef(false)

  // Expõe a altura do footer ao GroupChatWidget via CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--recap-footer-h',
      hasData && !loading ? '60px' : '0px'
    )
    return () => {
      document.documentElement.style.setProperty('--recap-footer-h', '0px')
    }
  }, [hasData, loading])

  // Abertura automática no primeiro acesso do dia (via localStorage)
  useEffect(() => {
    if (loading) return
    if (decidedRef.current) return
    decidedRef.current = true

    const key = getRecapKey()
    if (localStorage.getItem(key) === 'shown') return

    localStorage.setItem(key, 'shown')

    if (hasData) {
      queueMicrotask(() => setForceOpen(true))
    }
  }, [loading, hasData])

  return (
    <>
      <RecapFooterButton
        loading={loading}
        hasData={hasData}
        onOpen={() => setForceOpen(true)}
      />
      <RecapBottomSheet
        data={data}
        currentUserId={currentUserId}
        isOpen={forceOpen}
        onClose={() => setForceOpen(false)}
      />
    </>
  )
}
