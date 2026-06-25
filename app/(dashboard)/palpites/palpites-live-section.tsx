'use client'

import { useState } from 'react'
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
  const [copied, setCopied] = useState(false)

  const gameCount = todayGames.length
  const guessCount = todayGames.filter((g) => g.myPrediction !== null).length

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/publico/${groupId}/${selectedDate}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silencioso em contextos sem HTTPS ou sem permissão
    }
  }

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
        {/* Botão de copiar link da data atual */}
        <button
          onClick={handleCopyLink}
          style={{
            width: '100%',
            padding: '0.4rem 0.75rem',
            border: '1px solid var(--color-border)',
            backgroundColor: 'transparent',
            color: copied ? 'var(--color-win)' : 'var(--color-muted)',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          {copied ? '✓ COPIADO!' : '⎘ COPIAR LINK DO DIA'}
        </button>
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
