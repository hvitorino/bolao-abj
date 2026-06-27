'use client'

import { useEffect, useRef, useState } from 'react'
import { usePalpitesAoVivo } from '@/lib/hooks/usePalpitesAoVivo'
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'
import { AcompanharToggle } from '@/components/bolao/AcompanharToggle'
import { CompartilharButton } from '@/components/bolao/CompartilharButton'
import { AcompanharCarrossel } from '@/components/bolao/AcompanharCarrossel'
import { AcompanharRanking } from '@/components/bolao/AcompanharRanking'
import DateChipsNav from '@/components/games/DateChipsNav'
import GameAnaliseDrawer from '@/components/bolao/GameAnaliseDrawer'

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

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  // Modo de visualização — persiste no sessionStorage entre trocas de data
  const [viewMode, setViewMode] = useState<'preencher' | 'acompanhar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('palpites_mode')
      return saved === 'acompanhar' ? 'acompanhar' : 'preencher'
    }
    return 'preencher'
  })

  // Persiste o modo ao alternar
  useEffect(() => {
    sessionStorage.setItem('palpites_mode', viewMode)
  }, [viewMode])

  // Reseta para Preencher quando o grupo ativo muda
  const prevGroupId = useRef(groupId)
  useEffect(() => {
    if (prevGroupId.current !== groupId) {
      prevGroupId.current = groupId
      setViewMode('preencher')
      sessionStorage.removeItem('palpites_mode')
    }
  }, [groupId])

  const gameCount = todayGames.length
  const guessCount = todayGames.filter((g) => g.myPrediction !== null).length

  // Pontuações do usuário atual no dia (para o carrossel)
  const currentUserGameScores =
    rankingWithDetails.find((p) => p.userId === currentUserId)?.games ?? []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Navegação por data e botões de ação — sticky no topo */}
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
          swipeDisabled={selectedGameId !== null}
        />

        {/* Linha com toggle de modo e botão de compartilhar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <AcompanharToggle
            isActive={viewMode === 'acompanhar'}
            onToggle={() => setViewMode((v) => (v === 'acompanhar' ? 'preencher' : 'acompanhar'))}
          />
          <CompartilharButton groupId={groupId} selectedDate={selectedDate} />
        </div>

        {/* Mini-cards de status dos jogos — visíveis apenas no modo Preencher */}
        {viewMode === 'preencher' && (
          <PalpitesLiveCard
            todayGames={todayGames}
            loading={loading}
            onGameClick={setSelectedGameId}
          />
        )}
      </div>

      {/* Conteúdo principal — condicional pelo modo, animado na troca */}
      <div key={viewMode} style={{ animation: 'modeFadeIn 200ms ease-out' }}>
        {viewMode === 'preencher' ? (
          <PalpitesRanking
            currentUserId={currentUserId}
            rankingWithDetails={rankingWithDetails}
            todayGames={todayGames}
            loading={loading}
            error={error}
          />
        ) : (
          <>
            <AcompanharCarrossel
              todayGames={todayGames}
              currentUserGameScores={currentUserGameScores}
              loading={loading}
            />
            <PalpitesRanking
              currentUserId={currentUserId}
              rankingWithDetails={rankingWithDetails}
              todayGames={todayGames}
              loading={loading}
              error={error}
            />
          </>
        )}
      </div>

      {/* Drawer de análise do jogo — apenas ativado pelo PalpitesLiveCard no modo Preencher */}
      <GameAnaliseDrawer
        gameId={selectedGameId}
        groupId={groupId}
        currentUserId={currentUserId}
        onClose={() => setSelectedGameId(null)}
      />
    </div>
  )
}
