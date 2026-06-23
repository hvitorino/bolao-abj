'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'
import { useLiveTodayRanking } from '@/lib/hooks/useLiveTodayRanking'
import { RecapPanelContent } from './RecapPanelContent'
import { LiveTodayPanelContent } from './LiveTodayPanelContent'
import { ChatPanelContent } from './ChatPanelContent'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type PanelId = 'recap' | 'live' | 'chat' | null

interface SidePanelContainerProps {
  groupId: string
  currentUserId: string
  activeGroupName?: string
}

// ---------------------------------------------------------------------------
// Helper: chave do localStorage em ET (UTC-4)
// ---------------------------------------------------------------------------

function getRecapKey(): string {
  const nowUTC = new Date()
  const nowET = new Date(nowUTC.getTime() - 4 * 60 * 60 * 1000)
  const yyyy = nowET.getUTCFullYear()
  const mm = String(nowET.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowET.getUTCDate()).padStart(2, '0')
  return `bolao_recap_${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SidePanelContainer({
  groupId,
  currentUserId,
  activeGroupName = '',
}: SidePanelContainerProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null)
  const [chatEverOpened, setChatEverOpened] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  const decidedRef = useRef(false)

  const { loading, hasData, data } = useDailyRecap(groupId)
  const {
    hasGamesToday,
    entries: liveTodayEntries,
    games: liveTodayGames,
    loading: liveTodayLoading,
  } = useLiveTodayRanking(groupId)

  // Abertura automática do recap (primeira vez no dia)
  useEffect(() => {
    if (loading) return
    if (decidedRef.current) return
    decidedRef.current = true

    const key = getRecapKey()
    if (localStorage.getItem(key) === 'shown') return
    localStorage.setItem(key, 'shown')

    if (hasData) {
      queueMicrotask(() => setOpenPanel('recap'))
    }
  }, [loading, hasData])

  // Ao abrir o painel CHAT pela primeira vez: marcar como "ever opened"
  useEffect(() => {
    if (openPanel === 'chat' && !chatEverOpened) {
      setChatEverOpened(true)
    }
  }, [openPanel, chatEverOpened])

  const handleClose = useCallback(() => {
    setOpenPanel(null)
  }, [])

  const handleUnreadCountChange = useCallback((count: number) => {
    setChatUnreadCount(count)
  }, [])

  // Visibilidade dos pull tabs
  const showRecapTab = !loading && hasData === true
  const showLiveTab = hasGamesToday === true
  const showChatTab = true // sempre visível quando há groupId

  // Posicionamento vertical dos pull tabs (container centrado entre header e tab bar)
  const pullTabContainerStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 'var(--header-h, 44px)',
    bottom: 'var(--tabbar-h, 52px)',
    zIndex: 160,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    pointerEvents: 'none',
  }

  const pullTabBaseStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    width: '28px',
    backgroundColor: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0.75rem 0',
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    border: 'none',
    outline: 'none',
    position: 'relative',
  }

  // Cabeçalho do painel (título + botão FECHAR)
  const panelTitles: Record<Exclude<PanelId, null>, string> = {
    recap: 'ONTEM',
    live: 'AO VIVO',
    chat: `CHAT — ${activeGroupName.toUpperCase()}`,
  }

  return (
    <>
      {/* ── PULL TABS ─────────────────────────────────────────────────────── */}
      <div style={pullTabContainerStyle} aria-hidden={openPanel !== null}>
        {showRecapTab && (
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'recap' ? null : 'recap')}
            aria-label="Abrir resumo de ontem"
            style={{
              ...pullTabBaseStyle,
              background: 'var(--color-secondary)',
              color: '#f0f4f8',
              borderRight: '2px solid var(--color-accent)',
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
            }}
          >
            ONTEM
          </button>
        )}

        {showLiveTab && (
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'live' ? null : 'live')}
            aria-label="Abrir ranking ao vivo"
            style={{
              ...pullTabBaseStyle,
              background: 'var(--color-live)',
              color: '#ffffff',
              borderRight: '2px solid rgba(255,255,255,0.3)',
              borderBottom: 'none',
              borderLeft: 'none',
              borderTop: showRecapTab ? '1px solid rgba(255,255,255,0.15)' : 'none',
            }}
          >
            AO VIVO
          </button>
        )}

        {showChatTab && (
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'chat' ? null : 'chat')}
            aria-label={`Abrir chat do grupo${chatUnreadCount > 0 ? ` (${chatUnreadCount} não lidas)` : ''}`}
            style={{
              ...pullTabBaseStyle,
              background: 'var(--color-primary)',
              color: '#0a0e1a',
              borderRight: '2px solid rgba(0,0,0,0.2)',
              borderBottom: 'none',
              borderLeft: 'none',
              borderTop: (!showRecapTab && !showLiveTab) ? 'none' : '1px solid rgba(0,0,0,0.2)',
            }}
          >
            CHAT
            {chatUnreadCount > 0 && openPanel !== 'chat' && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '14px',
                  height: '14px',
                  padding: '0 2px',
                  backgroundColor: '#0a0e1a',
                  color: '#FFDF00',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  fontFamily: FONT,
                  lineHeight: 1,
                  writingMode: 'horizontal-tb',
                }}
              >
                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── BACKDROP ──────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 'var(--header-h, 44px)',
          bottom: 'var(--tabbar-h, 52px)',
          left: '85vw',
          right: 0,
          zIndex: 149,
          background: 'transparent',
          display: openPanel !== null ? 'block' : 'none',
          cursor: 'default',
        }}
      />

      {/* ── PAINEL LATERAL ────────────────────────────────────────────────── */}
      <div
        role="region"
        aria-label={openPanel !== null ? panelTitles[openPanel] : 'Painel lateral'}
        aria-hidden={openPanel === null}
        style={{
          position: 'fixed',
          top: 'var(--header-h, 44px)',
          bottom: 'var(--tabbar-h, 52px)',
          left: '28px',
          width: 'calc(85vw - 28px)',
          zIndex: 150,
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
          transform: openPanel !== null ? 'translateX(0)' : 'translateX(-100%)',
          transition: openPanel !== null
            ? 'transform 250ms ease-out'
            : 'transform 250ms ease-in',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Cabeçalho do painel */}
        {openPanel !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginRight: '0.5rem',
              }}
            >
              {panelTitles[openPanel]}
            </span>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '13px',
                color: 'var(--color-muted)',
                padding: '0 0.25rem',
                flexShrink: 0,
              }}
              aria-label="Fechar painel"
            >
              [ FECHAR ]
            </button>
          </div>
        )}

        {/* Conteúdo do painel */}
        <div style={{ flex: 1, overflowY: openPanel === 'chat' ? 'hidden' : 'auto' }}>
          {openPanel === 'recap' && (
            <RecapPanelContent
              data={data}
              currentUserId={currentUserId}
              onClose={handleClose}
            />
          )}

          {openPanel === 'live' && (
            <LiveTodayPanelContent
              entries={liveTodayEntries}
              games={liveTodayGames}
              loading={liveTodayLoading}
              currentUserId={currentUserId}
              onClose={handleClose}
            />
          )}

          {/* Chat: lazy-mount — monta na primeira abertura e nunca mais desmonta */}
          {chatEverOpened && (
            <div style={{ display: openPanel === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <ChatPanelContent
                activeGroupId={groupId}
                activeGroupName={activeGroupName}
                currentUserId={currentUserId}
                isVisible={openPanel === 'chat'}
                onUnreadCountChange={handleUnreadCountChange}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
