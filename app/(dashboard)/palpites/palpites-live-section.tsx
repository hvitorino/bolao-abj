'use client'

import { usePalpitesAoVivo } from '@/lib/hooks/usePalpitesAoVivo'
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'

interface PalpitesLiveSectionProps {
  groupId: string
  currentUserId: string
}

/**
 * Orquestra a aba de palpites ao vivo.
 * Instancia o hook de polling uma única vez e distribui os dados
 * para PalpitesLiveCard (sticky) e PalpitesRanking (FLIP).
 */
export function PalpitesLiveSection({ groupId, currentUserId }: PalpitesLiveSectionProps) {
  const { todayGames, rankingWithDetails, loading, error } = usePalpitesAoVivo(
    groupId,
    currentUserId
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Cards dos jogos de hoje — sticky no topo */}
      <div
        style={{
          position: 'sticky',
          top: 'calc(44px + env(safe-area-inset-top))',
          zIndex: 10,
          backgroundColor: 'var(--color-bg)',
          paddingBottom: '0.5rem',
        }}
      >
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
