'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { name: string } | { name: string }[] | null
}

function resolveProfile(
  profiles: ChatMessage['profiles']
): { name: string } | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0] ?? null
  return profiles
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatPanelContentProps {
  activeGroupId: string
  activeGroupName: string
  currentUserId: string
  isVisible: boolean
  onUnreadCountChange?: (count: number) => void
}

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ChatPanelContent({
  activeGroupId,
  activeGroupName,
  currentUserId,
  isVisible,
  onUnreadCountChange,
}: ChatPanelContentProps) {
  const supabase = createClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isVisibleRef = useRef(isVisible)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const localStorageKey = `chat_last_read_${activeGroupId}`

  // Sincroniza a ref com o estado (para uso nos closures do Realtime)
  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  // Notifica o pai sobre mudança no unreadCount
  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  // Carrega mensagens
  const loadMessages = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('group_messages')
      .select('id, content, created_at, user_id, profiles(name)')
      .eq('group_id', activeGroupId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && data) {
      const msgs = data as unknown as ChatMessage[]
      setMessages(msgs)
    }
    setIsLoading(false)
    setHasFetched(true)
  }, [activeGroupId, supabase])

  // Subscription Realtime — iniciada na montagem do componente
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${activeGroupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${activeGroupId}`,
        },
        async (payload) => {
          const raw = payload.new as {
            id: string
            content: string
            created_at: string
            user_id: string
          }

          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', raw.user_id)
            .single()

          const newMsg: ChatMessage = {
            ...raw,
            profiles: profileData ?? null,
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          if (!isVisibleRef.current) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeGroupId, supabase])

  // Ao abrir o painel: carregar mensagens (se ainda não carregou), zerar não-lidas, rolar para o fim
  useEffect(() => {
    if (!isVisible) return

    setUnreadCount(0)
    if (typeof window !== 'undefined') {
      localStorage.setItem(localStorageKey, new Date().toISOString())
    }

    if (!hasFetched) {
      loadMessages()
    }

    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
    return () => clearTimeout(timer)
  }, [isVisible, hasFetched, loadMessages, localStorageKey])

  // Scroll automático quando novas mensagens chegam
  useEffect(() => {
    if (isVisible && messages.length > 0 && isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isVisible, isScrolledToBottom])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    setIsScrolledToBottom(distanceFromBottom <= 80)
  }, [])

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000)
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim()
    if (!trimmed || trimmed.length > 500 || isSending) return

    setIsSending(true)
    const { error } = await supabase.from('group_messages').insert({
      group_id: activeGroupId,
      user_id: currentUserId,
      content: trimmed,
    })

    if (error) {
      showError('ERRO AO ENVIAR. TENTE NOVAMENTE.')
    } else {
      setNewMessage('')
      textareaRef.current?.focus()
    }
    setIsSending(false)
  }, [newMessage, isSending, supabase, activeGroupId, currentUserId, showError])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  return (
    <div
      role="region"
      aria-label={`Chat do grupo ${activeGroupName}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: FONT,
      }}
    >
      {/* Área de mensagens */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
          backgroundColor: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
          overflowAnchor: 'auto',
        }}
      >
        {isLoading ? (
          <>
            {['CARREGANDO...', 'CARREGANDO...', 'CARREGANDO...'].map((txt, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONT,
                  fontSize: '11px',
                  color: 'var(--color-muted)',
                  marginBottom: '0.75rem',
                }}
              >
                {txt}
              </div>
            ))}
          </>
        ) : messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT,
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              textAlign: 'center',
            }}
          >
            SEM MENSAGENS. SEJA O PRIMEIRO!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === currentUserId
            const profile = resolveProfile(msg.profiles)
            const name = profile?.name ?? 'ANÔNIMO'
            return (
              <div key={msg.id} style={{ marginBottom: '0.75rem' }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.125rem',
                  }}
                >
                  <span
                    style={{
                      color: isOwn ? 'var(--color-primary)' : 'var(--color-accent)',
                      fontWeight: 'bold',
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ color: 'var(--color-muted)' }}>
                    {' · '}
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: '13px',
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Erro inline */}
      {errorMsg && (
        <div
          style={{
            padding: '0.25rem 0.75rem',
            fontFamily: FONT,
            fontSize: '11px',
            color: 'var(--color-error)',
            backgroundColor: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Input de envio */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          flexShrink: 0,
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="MENSAGEM..."
          maxLength={500}
          rows={2}
          style={{
            fontFamily: FONT,
            fontSize: '12px',
            color: 'var(--color-text)',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            padding: '0.375rem 0.5rem',
            resize: 'none',
            outline: 'none',
            maxHeight: '4.5rem',
            overflowY: 'auto',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }}
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={newMessage.trim() === '' || isSending}
          style={{
            fontFamily: FONT,
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-bg)',
            backgroundColor:
              newMessage.trim() === '' || isSending
                ? 'var(--color-muted)'
                : 'var(--color-primary)',
            border: 'none',
            padding: '0.375rem 0.75rem',
            cursor: newMessage.trim() === '' || isSending ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease',
            alignSelf: 'flex-end',
          }}
        >
          {isSending ? 'ENVIANDO...' : 'ENVIAR'}
        </button>
      </div>
    </div>
  )
}
