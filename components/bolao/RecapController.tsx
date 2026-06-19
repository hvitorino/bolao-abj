'use client'

import { useState } from 'react'
import { RecapFloatingButton } from './RecapFloatingButton'
import { DailyRecapModal } from './DailyRecapModal'

interface RecapControllerProps {
  groupId: string
  currentUserId: string
}

export function RecapController({ groupId, currentUserId }: RecapControllerProps) {
  const [forceOpen, setForceOpen] = useState(false)

  return (
    <>
      <RecapFloatingButton
        groupId={groupId}
        currentUserId={currentUserId}
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
