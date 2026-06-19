'use client'

import { useState } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'
import { RecapFloatingButton } from './RecapFloatingButton'
import { DailyRecapModal } from './DailyRecapModal'

interface RecapControllerProps {
  groupId: string
  currentUserId: string
}

export function RecapController({ groupId, currentUserId }: RecapControllerProps) {
  const [forceOpen, setForceOpen] = useState(false)
  const { loading, hasData } = useDailyRecap(groupId)

  return (
    <>
      <RecapFloatingButton
        loading={loading}
        hasData={hasData}
        onOpen={() => setForceOpen(true)}
      />
      <DailyRecapModal
        groupId={groupId}
        currentUserId={currentUserId}
        forceOpen={forceOpen}
        onClose={() => setForceOpen(false)}
      />
    </>
  )
}
