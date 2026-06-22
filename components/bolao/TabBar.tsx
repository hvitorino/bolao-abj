'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

const MAIN_ITEMS = [
  { href: '/perfil', label: 'CAMPANHA' },
  { href: '/jogos', label: 'JOGOS' },
  { href: '/ranking', label: 'RANKING' },
]

const MAIS_ITEMS = [
  { href: '/grupos', label: 'GRUPOS' },
  { href: '/como-pontuar', label: 'REGRAS' },
  { href: '/configuracoes', label: 'CONFIG' },
]

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

export function TabBar() {
  const pathname = usePathname()
  const [maisOpen, setMaisOpen] = useState(false)
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

  const itemStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: active ? 'var(--color-primary)' : 'var(--color-muted)',
    borderTop: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    height: '100%',
    padding: '0 0.25rem',
  })

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
        {MAIN_ITEMS.map(({ href, label }) => {
          const active = isPathActive(pathname, href)
          return (
            <Link key={href} href={href} style={itemStyle(active)}>
              {label}
            </Link>
          )
        })}

        {/* MAIS — com popover para cima */}
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
                left: 0,
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
    </div>
  )
}
