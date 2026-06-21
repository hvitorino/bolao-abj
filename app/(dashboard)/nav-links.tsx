'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/perfil', label: 'CAMPANHA' },
  { href: '/jogos', label: 'JOGOS' },
  { href: '/ranking', label: 'RANKING' },
  { href: '/meus-palpites', label: 'PALPITES' },
  { href: '/grupos', label: 'GRUPOS' },
]

const MAIS_ITEMS = [
  { href: '/como-pontuar', label: 'REGRAS' },
  { href: '/configuracoes', label: 'CONFIG' },
]

const MONO = "'JetBrains Mono', 'Courier New', monospace"

const baseLinkStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textDecoration: 'none',
  padding: '0.5rem 0',
  whiteSpace: 'nowrap',
  lineHeight: 1,
}

export function NavLinks() {
  const pathname = usePathname()
  const [maisOpen, setMaisOpen] = useState(false)
  const maisRef = useRef<HTMLDivElement>(null)

  const maisActive = MAIS_ITEMS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + '/')
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (maisRef.current && !maisRef.current.contains(e.target as Node)) {
        setMaisOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
    >
      {/* Itens principais — scroll horizontal em telas muito pequenas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
        }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            pathname === href ||
            pathname.startsWith(href + '?') ||
            pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                ...baseLinkStyle,
                color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
                borderBottom: isActive
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
                display: 'inline-block',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* MAIS — fora do container scrollável para o dropdown não gerar scroll */}
      <div ref={maisRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMaisOpen((o) => !o)}
          style={{
            ...baseLinkStyle,
            background: 'none',
            border: 'none',
            borderBottom: maisActive
              ? '2px solid var(--color-primary)'
              : '2px solid transparent',
            color: maisActive ? 'var(--color-primary)' : 'var(--color-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            margin: 0,
          }}
        >
          MAIS {maisOpen ? '▲' : '▼'}
        </button>

        {maisOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              minWidth: '120px',
              zIndex: 100,
            }}
          >
            {MAIS_ITEMS.map(({ href, label }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMaisOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    fontFamily: MONO,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    textDecoration: 'none',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
                    borderLeft: isActive
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
    </nav>
  )
}
