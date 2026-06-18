'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { name: string } | null
}

interface GroupChatWidgetProps {
  activeGroupId: string
  activeGroupName: string
  currentUserId: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function GroupChatWidget({
  activeGroupId,
  activeGroupName,
  currentUserId,
}: GroupChatWidgetProps) {
  const supabase = createClient()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOpenRef = useRef(isOpen)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const localStorageKey = `chat_last_read_${activeGroupId}`

  // Sincroniza a ref com o estado (para usar dentro do closure do Realtime)
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // Carrega mensagens na primeira abertura
  const loadMessages = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('group_messages')
      .select('id, content, created_at, user_id, profiles(name)')
      .eq('group_id', activeGroupId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && data) {
      setMessages(data as ChatMessage[])

      // Calcula não lidas com base no lastReadAt
      const lastReadAt =
        typeof window !== 'undefined'
          ? localStorage.getItem(localStorageKey)
          : null
      if (lastReadAt) {
        const unread = (data as ChatMessage[]).filter(
          (m) => m.created_at > lastReadAt
        ).length
        setUnreadCount(unread)
      }
    }
    setIsLoading(false)
    setHasFetched(true)
  }, [activeGroupId, localStorageKey, supabase])

  // Subscription Realtime
  useEffect(() => {
    if (!hasFetched) return

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

          // Busca o nome do perfil para a mensagem recebida
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', raw.user_id)
            .single()

          const newMsg: ChatMessage = {
            ...raw,
            profiles: profileData ?? null,
          }

          setMessages((prev) => [...prev, newMsg])

          if (!isOpenRef.current) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [hasFetched, activeGroupId, supabase])

  // Abre o painel
  const handleOpen = useCallback(async () => {
    setIsOpen(true)
    setUnreadCount(0)

    if (typeof window !== 'undefined') {
      localStorage.setItem(localStorageKey, new Date().toISOString())
    }

    if (!hasFetched) {
      await loadMessages()
    }

    // Scroll ao final após animação
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 500)
  }, [hasFetched, loadMessages, localStorageKey])

  // Fecha o painel
  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Scroll automático quando novas mensagens chegam com o painel aberto
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Exibe erro por 3 segundos
  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000)
  }, [])

  // Envio de mensagem
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

  // Cleanup do timer de erro ao desmontar
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  // ── CHIP MINIMIZADO ──────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 50,
        }}
      >
        <button
          onClick={handleOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: '96px',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
            transition: 'border-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor =
              'var(--color-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor =
              'var(--color-border)'
          }}
          aria-label={`Abrir chat do grupo${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        >
          CHAT
          {unreadCount > 0 && (
            <span
              style={{
                display: 'inline-block',
                padding: '0 0.375rem',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-bg)',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                borderRadius: 0,
                lineHeight: '1.4',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    )
  }

  // ── PAINEL EXPANDIDO ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 50,
        width: 'min(320px, calc(100vw - 3rem))',
        maxHeight: 'min(480px, 60vh)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        animation: 'chatOpen 250ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes chatOpen {
          from { transform: scale(0.95) translateY(8px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
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
          CHAT — {activeGroupName.toUpperCase()}
        </span>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'var(--color-muted)',
            padding: '0 0.25rem',
            flexShrink: 0,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-muted)'
          }}
          aria-label="Fechar chat"
        >
          [X]
        </button>
      </div>

      {/* Área de mensagens */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
          backgroundColor: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
          overflowAnchor: 'none',
        }}
      >
        {isLoading ? (
          <>
            {['CARREGANDO...', 'CARREGANDO...', 'CARREGANDO...'].map(
              (txt, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                    fontSize: '11px',
                    color: 'var(--color-muted)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {txt}
                </div>
              )
            )}
          </>
        ) : messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            const name = msg.profiles?.name ?? 'ANÔNIMO'
            return (
              <div
                key={msg.id}
                style={{ marginBottom: '0.75rem' }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.125rem',
                  }}
                >
                  <span
                    style={{
                      color: isOwn
                        ? 'var(--color-primary)'
                        : 'var(--color-accent)',
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
                    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
            cursor:
              newMessage.trim() === '' || isSending ? 'not-allowed' : 'pointer',
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
