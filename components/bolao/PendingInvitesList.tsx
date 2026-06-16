'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export interface PendingInvite {
  id: string
  groupId: string
  groupName: string
  invitedByName: string
  createdAt: string // ISO 8601
}

interface PendingInvitesListProps {
  invites: PendingInvite[]
}

type ItemState = 'idle' | 'responding' | 'error'

function formatDate(iso: string): string {
  const date = new Date(iso)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function PendingInvitesList({ invites: initialInvites }: PendingInvitesListProps) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({})
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({})

  async function getAccessToken(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleAccept(invite: PendingInvite) {
    setItemStates((prev) => ({ ...prev, [invite.id]: 'responding' }))
    setErrorMessages((prev) => ({ ...prev, [invite.id]: '' }))

    try {
      const token = await getAccessToken()
      if (!token) {
        setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
        setErrorMessages((prev) => ({ ...prev, [invite.id]: 'Sessão expirada. Faça login novamente.' }))
        return
      }

      const res = await fetch(`/api/invites/${invite.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
        setErrorMessages((prev) => ({ ...prev, [invite.id]: data.message || 'Erro ao aceitar convite.' }))
        return
      }

      router.push(`/jogos?group=${data.group_id}`)
    } catch {
      setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
      setErrorMessages((prev) => ({ ...prev, [invite.id]: 'Erro de conexão. Tente novamente.' }))
    }
  }

  async function handleDecline(invite: PendingInvite) {
    setItemStates((prev) => ({ ...prev, [invite.id]: 'responding' }))
    setErrorMessages((prev) => ({ ...prev, [invite.id]: '' }))

    try {
      const token = await getAccessToken()
      if (!token) {
        setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
        setErrorMessages((prev) => ({ ...prev, [invite.id]: 'Sessão expirada. Faça login novamente.' }))
        return
      }

      const res = await fetch(`/api/invites/${invite.id}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
        setErrorMessages((prev) => ({ ...prev, [invite.id]: data.message || 'Erro ao recusar convite.' }))
        return
      }

      setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    } catch {
      setItemStates((prev) => ({ ...prev, [invite.id]: 'error' }))
      setErrorMessages((prev) => ({ ...prev, [invite.id]: 'Erro de conexão. Tente novamente.' }))
    }
  }

  if (invites.length === 0) {
    return null
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        marginBottom: '1.25rem',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '14px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-text)',
        }}
      >
        CONVITES RECEBIDOS
      </div>

      <div>
        {invites.map((invite, index) => {
          const itemState = itemStates[invite.id] ?? 'idle'
          const isResponding = itemState === 'responding'

          return (
            <div
              key={invite.id}
              style={{
                padding: '0.75rem 1rem',
                borderTop: index > 0 ? '1px solid var(--color-border)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                {invite.groupName.toUpperCase()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Convidado por {invite.invitedByName.toUpperCase()} em {formatDate(invite.createdAt)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isResponding}
                  onClick={() => handleAccept(invite)}
                  style={{ padding: '0.4rem 0.9rem', fontSize: '12px' }}
                >
                  {isResponding ? '...' : '✓ ACEITAR'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={isResponding}
                  onClick={() => handleDecline(invite)}
                  style={{ padding: '0.4rem 0.9rem', fontSize: '12px' }}
                >
                  {isResponding ? '...' : '✗ RECUSAR'}
                </Button>
              </div>
              {itemState === 'error' && errorMessages[invite.id] && (
                <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>
                  ✗ {errorMessages[invite.id]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
