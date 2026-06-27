'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatPanelContent } from './ChatPanelContent'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ChatBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  currentUserId: string
  activeGroupName: string
  onUnreadCountChange?: (count: number) => void
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ChatBottomSheet({
  isOpen,
  onClose,
  groupId,
  currentUserId,
  activeGroupName,
  onUnreadCountChange,
}: ChatBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [everOpened, setEverOpened] = useState(false)

  const touchStartY = useRef<number | null>(null)

  // Abertura: isOpen → true
  // Promise.resolve().then() evita cascata de renders (react-hooks/set-state-in-effect)
  useEffect(() => {
    if (!isOpen) return
    Promise.resolve().then(() => {
      if (!everOpened) setEverOpened(true)
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true)
        })
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Fechamento interno
  function handleClose() {
    setIsAnimatingIn(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 250)
  }

  // Handler ESC
  useEffect(() => {
    if (!isAnimatingIn) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimatingIn])

  // Trava de scroll do body
  useEffect(() => {
    document.body.style.overflow = isAnimatingIn ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isAnimatingIn])

  // Swipe-to-close
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setDragOffset(delta)
  }

  function handleTouchEnd() {
    setIsDragging(false)
    if (dragOffset > 60) {
      setDragOffset(0)
      handleClose()
    } else {
      setDragOffset(0)
    }
    touchStartY.current = null
  }

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          backgroundColor: isAnimatingIn ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
          transition: 'background-color 250ms ease',
        }}
      />

      {/* Painel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chat — ${activeGroupName}`}
        style={{
          position: 'fixed',
          bottom: 'calc(52px + env(safe-area-inset-bottom))',
          left: '1.5rem',
          right: '1.5rem',
          zIndex: 51,
          maxHeight: '72vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          transform: isAnimatingIn
            ? isDragging ? `translateY(${dragOffset}px)` : 'translateY(0)'
            : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 250ms ease',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT,
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 6px',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: 'var(--color-border)',
            }}
          />
        </div>

        {/* Conteúdo — lazy-mount */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {everOpened && (
            <ChatPanelContent
              activeGroupId={groupId}
              activeGroupName={activeGroupName}
              currentUserId={currentUserId}
              isVisible={isAnimatingIn}
              onUnreadCountChange={onUnreadCountChange}
            />
          )}
        </div>
      </div>
    </>
  )
}
