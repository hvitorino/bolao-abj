'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface Group {
  id: string
  name: string
  role: 'admin' | 'member'
}

interface GroupSwitcherProps {
  groups: Group[]
  activeGroupId: string | undefined
  pendingInvitesCount: number
}

export function GroupSwitcher({ groups, activeGroupId, pendingInvitesCount }: GroupSwitcherProps) {
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

  if (groups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
        {pendingInvitesCount > 0 && (
          <Link
            href="/grupos"
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
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
        <Link
          href="/grupos"
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
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
      </div>
    )
  }

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
    >
      {pendingInvitesCount > 0 && (
        <Link
          href="/grupos"
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
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

      <button
        onClick={() => groups.length > 1 && setOpen((o) => !o)}
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-muted)',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          padding: '0.2rem 0.5rem',
          cursor: groups.length > 1 ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}
      >
        GRUPO: {activeGroup.name.toUpperCase()}
        {groups.length > 1 && (
          <span style={{ fontSize: '10px', color: 'var(--color-muted)', lineHeight: 1 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {open && groups.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            zIndex: 100,
            minWidth: '100%',
          }}
        >
          {groups.map((group, i) => (
            <button
              key={group.id}
              onClick={() => switchGroup(group.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.375rem 0.75rem',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: group.id === activeGroup?.id ? 'var(--color-primary)' : 'var(--color-text)',
                background: 'transparent',
                border: 'none',
                borderBottom: i < groups.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              {group.id === activeGroup?.id ? '► ' : '  '}
              {group.name.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
