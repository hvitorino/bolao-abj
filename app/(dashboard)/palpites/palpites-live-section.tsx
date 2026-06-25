'use client'

import { usePalpitesAoVivo } from '@/lib/hooks/usePalpitesAoVivo'
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'
import DateChipsNav from '@/components/games/DateChipsNav'

interface PalpitesLiveSectionProps {
  groupId: string
  currentUserId: string
  selectedDate: string
  availableDates: string[]
}

export function PalpitesLiveSection({
  groupId,
  currentUserId,
  selectedDate,
  availableDates,
}: PalpitesLiveSectionProps) {
  const { todayGames, rankingWithDetails, loading, error } = usePalpitesAoVivo(
    groupId,
    currentUserId,
    selectedDate
  )

  const gameCount = todayGames.length
  const guessCount = todayGames.filter((g) => g.myPrediction !== null).length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Navegação por data e cards — sticky no topo */}
      <div
        style={{
          position: 'sticky',
          top: 'calc(44px + env(safe-area-inset-top))',
          zIndex: 20,
          backgroundColor: 'var(--color-bg)',
          paddingTop: '1.5rem',
          marginTop: '-1.5rem',
          paddingBottom: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <DateChipsNav
          currentDate={selectedDate}
          availableDates={availableDates}
          gameCount={gameCount}
          guessCount={guessCount}
          basePath="/palpites"
        />
        <PalpitesLiveCard todayGames={todayGames} loading={loading} />
      </div>

      {/* Ranking com animação FLIP e accordion de breakdown */}
      <PalpitesRanking
        currentUserId={currentUserId}
        rankingWithDetails={rankingWithDetails}
        todayGames={todayGames}
        loading={loading}
        error={error}
      />
    </div>
  )
}
