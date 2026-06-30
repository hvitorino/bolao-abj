'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { ChatBottomSheet } from './ChatBottomSheet'
import { createClient } from '@/lib/supabase/client'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

const LINK_ITEMS = [
  { href: '/perfil', label: 'EU' },
  { href: '/ranking', label: 'RANKING' },
  { href: '/palpites', label: 'PALPITES' },
]

const MAIS_ITEMS = [
  { href: '/grupos', label: 'GRUPOS' },
  { href: '/como-pontuar', label: 'REGRAS' },
  { href: '/configuracoes', label: 'CONFIG' },
]

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

function useChatUnreadCount(groupId: string, currentUserId: string): number {
  const [count, setCount] = useState(0)
  const supabase = createClient()
  const localStorageKey = `chat_last_read_${groupId}`

  // Contagem inicial: mensagens de outros desde o último acesso
  useEffect(() => {
    if (!groupId) return
    const lastRead = typeof window !== 'undefined' ? localStorage.getItem(localStorageKey) : null
    if (!lastRead) return
    supabase
      .from('group_messages')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .neq('user_id', currentUserId)
      .gt('created_at', lastRead)
      .then(({ count: c }) => {
        if (c && c > 0) setCount(c)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId])

  // Realtime: incrementa ao chegar mensagem de outro usuário
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`unread-badge-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as { user_id: string }
          if (msg.user_id === currentUserId) return
          setCount((prev) => prev + 1)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId])

  // Reseta quando o chat é aberto
  useEffect(() => {
    function handleChatOpen() {
      setCount(0)
    }
    window.addEventListener('bolao:chat:open', handleChatOpen)
    return () => window.removeEventListener('bolao:chat:open', handleChatOpen)
  }, [])

  return count
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TabBarProps {
  groupId: string        // '' quando o usuário não tem grupo ativo
  currentUserId: string
  activeGroupName: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function TabBar({ groupId, currentUserId, activeGroupName }: TabBarProps) {
  const pathname = usePathname()
  const [maisOpen, setMaisOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const chatUnreadCount = useChatUnreadCount(groupId, currentUserId)
  const maisRef = useRef<HTMLDivElement>(null)

  const maisActive = MAIS_ITEMS.some(({ href }) => isPathActive(pathname, href))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (maisRef.current && !maisRef.current.contains(e.target as Node)) {
        setMaisOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const itemStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    cursor: disabled ? 'default' : 'pointer',
    color: disabled
      ? 'var(--color-muted)'
      : active
        ? 'var(--color-primary)'
        : 'var(--color-muted)',
    borderTop: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    height: '100%',
    padding: '0 0.25rem',
  })

  function handleChatClick() {
    if (!groupId) return
    setChatOpen(true)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'stretch',
          height: '52px',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {/* EU, RANKING, PALPITES — links de navegação */}
        {LINK_ITEMS.map(({ href, label }) => {
          const active = isPathActive(pathname, href)
          return (
            <Link key={href} href={href} style={itemStyle(active)}>
              {label}
            </Link>
          )
        })}

        {/* CHAT — abre bottom sheet */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', position: 'relative' }}>
          <button
            type="button"
            onClick={handleChatClick}
            style={itemStyle(chatOpen, !groupId)}
            aria-label={`Chat${chatUnreadCount > 0 ? ` (${chatUnreadCount} não lidas)` : ''}`}
          >
            CHAT
          </button>
          {!chatOpen && chatUnreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '14px',
                height: '14px',
                padding: '0 2px',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg)',
                fontSize: '9px',
                fontWeight: 'bold',
                fontFamily: FONT,
                lineHeight: 1,
                pointerEvents: 'none',
              }}
            >
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </div>

        {/* MAIS — popover para cima */}
        <div
          ref={maisRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => setMaisOpen((o) => !o)}
            style={itemStyle(maisActive)}
          >
            MAIS
          </button>

          {maisOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                minWidth: '140px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                zIndex: 200,
              }}
            >
              {MAIS_ITEMS.map(({ href, label }) => {
                const active = isPathActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMaisOpen(false)}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      fontFamily: FONT,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textDecoration: 'none',
                      color: active ? 'var(--color-primary)' : 'var(--color-muted)',
                      borderLeft: active
                        ? '2px solid var(--color-primary)'
                        : '2px solid transparent',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ChatBottomSheet — renderizado dentro da TabBar mas posicionado via fixed */}
      {groupId && (
        <ChatBottomSheet
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          groupId={groupId}
          currentUserId={currentUserId}
          activeGroupName={activeGroupName}
        />
      )}
    </div>
  )
}
