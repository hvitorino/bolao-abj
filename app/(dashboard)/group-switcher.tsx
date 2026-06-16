'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

interface Group {
  id: string
  name: string
  role: 'admin' | 'member'
}

interface GroupMenuProps {
  groups: Group[]
  activeGroupId: string | undefined
  pendingInvitesCount: number
}

export function GroupMenu({ groups, activeGroupId, pendingInvitesCount }: GroupMenuProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function switchGroup(groupId: string) {
    document.cookie = `${ACTIVE_GROUP_COOKIE}=${groupId}; path=/; max-age=31536000`
    setOpen(false)
    router.refresh()
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const triggerLabel = activeGroup ? activeGroup.name.toUpperCase() : 'MENU'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {pendingInvitesCount > 0 && (
        <Link
          href="/grupos"
          style={{
            ...MONO,
            color: 'var(--color-accent)',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: '1px solid var(--color-accent)',
            padding: '0.2rem 0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          ✉ {pendingInvitesCount} {pendingInvitesCount === 1 ? 'CONVITE' : 'CONVITES'}
        </Link>
      )}

      {groups.length === 0 ? (
        <Link
          href="/grupos"
          style={{
            ...MONO,
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: '1px solid var(--color-primary)',
            padding: '0.2rem 0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          CRIAR/ENTRAR EM UM GRUPO
        </Link>
      ) : (
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              ...MONO,
              color: 'var(--color-muted)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              padding: '0.2rem 0.5rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            {triggerLabel}
            <span style={{ fontSize: '10px', lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
          </button>

          {open && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                zIndex: 100,
                minWidth: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => switchGroup(group.id)}
                  style={{
                    ...MONO,
                    display: 'block',
                    width: '100%',
                    padding: '0.375rem 0.75rem',
                    color: group.id === activeGroup?.id ? 'var(--color-primary)' : 'var(--color-text)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {group.id === activeGroup?.id ? '► ' : '  '}
                  {group.name.toUpperCase()}
                </button>
              ))}

              <button
                onClick={handleLogout}
                style={{
                  ...MONO,
                  display: 'block',
                  width: '100%',
                  padding: '0.375rem 0.75rem',
                  color: 'var(--color-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {'  '}SAIR
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
