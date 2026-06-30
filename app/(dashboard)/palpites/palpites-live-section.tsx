'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePalpitesAoVivo } from '@/lib/hooks/usePalpitesAoVivo'
import { PalpitesLiveCard } from '@/components/bolao/PalpitesLiveCard'
import { PalpitesRanking } from '@/components/bolao/PalpitesRanking'
import { AcompanharToggle } from '@/components/bolao/AcompanharToggle'
import { CompartilharButton } from '@/components/bolao/CompartilharButton'
import { AcompanharCarrossel } from '@/components/bolao/AcompanharCarrossel'
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
  const { todayGames, rankingWithDetails, loading, error, refresh } = usePalpitesAoVivo(
    groupId,
    currentUserId,
    selectedDate
  )

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [bracketExpanded, setBracketExpanded] = useState(false)

  // Modo de visualização — persiste no sessionStorage entre trocas de data
  const [viewMode, setViewMode] = useState<'preencher' | 'acompanhar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('palpites_mode')
      return saved === 'acompanhar' ? 'acompanhar' : 'preencher'
    }
    return 'preencher'
  })

  // Controla o fade-out antes de trocar o modo
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleModeToggle = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    transitionRef.current = setTimeout(() => {
      setViewMode((v) => (v === 'acompanhar' ? 'preencher' : 'acompanhar'))
      setIsTransitioning(false)
    }, 160)
  }, [isTransitioning])

  useEffect(() => () => { if (transitionRef.current) clearTimeout(transitionRef.current) }, [])

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
          swipeDisabled={selectedGameId !== null || bracketExpanded}
        />

        {/* Linha com toggle de modo e botão de compartilhar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <AcompanharToggle
            isActive={viewMode === 'acompanhar'}
            onToggle={handleModeToggle}
          />
          <CompartilharButton groupId={groupId} selectedDate={selectedDate} />
        </div>

        {/* Carrossel/mini-cards — sempre no slot abaixo do toggle para manter distâncias estáveis */}
        <div
          key={viewMode}
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
            transition: isTransitioning
              ? 'opacity 160ms ease, transform 160ms ease'
              : 'none',
            animation: isTransitioning ? 'none' : 'modeFadeIn 200ms ease-out',
          }}
        >
          {viewMode === 'preencher' ? (
            <PalpitesLiveCard
              todayGames={todayGames}
              loading={loading}
              onGameClick={setSelectedGameId}
              groupId={groupId}
              currentUserId={currentUserId}
              onBracketExpandChange={setBracketExpanded}
            />
          ) : (
            <AcompanharCarrossel
              todayGames={todayGames}
              currentUserGameScores={currentUserGameScores}
              loading={loading}
              onGameClick={setSelectedGameId}
              currentUserId={currentUserId}
              onBracketExpandChange={setBracketExpanded}
            />
          )}
        </div>
      </div>

      {/* Conteúdo principal — animado na troca de modo */}
      <div
        key={viewMode}
        style={{
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
          transition: isTransitioning
            ? 'opacity 160ms ease, transform 160ms ease'
            : 'none',
          animation: isTransitioning ? 'none' : 'modeFadeIn 200ms ease-out',
        }}
      >
        <PalpitesRanking
          currentUserId={currentUserId}
          rankingWithDetails={rankingWithDetails}
          todayGames={todayGames}
          loading={loading}
          error={error}
        />
      </div>

      {/* Drawer de análise do jogo — apenas ativado pelo PalpitesLiveCard no modo Preencher */}
      <GameAnaliseDrawer
        gameId={selectedGameId}
        groupId={groupId}
        currentUserId={currentUserId}
        onClose={() => setSelectedGameId(null)}
        onPredictionSubmitted={refresh}
      />
    </div>
  )
}
