'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/jogos', label: 'JOGOS' },
  { href: '/ranking', label: 'RANKING' },
  { href: '/meus-palpites', label: 'PALPITES' },
  { href: '/grupos', label: 'GRUPOS' },
  { href: '/como-pontuar', label: 'REGRAS' },
  { href: '/configuracoes', label: 'CONFIGURAÇÕES' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
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
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: isActive
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              padding: '0.5rem 0',
              transition: 'color 0.15s ease, border-color 0.15s ease',
              display: 'inline-block',
            }}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
